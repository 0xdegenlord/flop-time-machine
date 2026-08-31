begin;

create or replace function public.ingest_lobby_poll(
    p_expected_epoch_id bigint,
    p_expected_last_saved_seq bigint,
    p_response_first_seq bigint,
    p_response_last_seq bigint,
    p_messages jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
    v_room_id bigint;
    v_epoch_id bigint;
    v_last_saved_seq bigint;
    v_archive_enabled boolean;
    v_message_count integer;
    v_now timestamptz := clock_timestamp();
begin
    if p_expected_last_saved_seq is null or p_expected_last_saved_seq < 0 then
        raise exception 'expected cursor must be a non-negative integer';
    end if;

    if p_messages is null or jsonb_typeof(p_messages) <> 'array' then
        raise exception 'messages must be a JSON array';
    end if;

    v_message_count := jsonb_array_length(p_messages);

    if v_message_count > 200 then
        raise exception 'message batch exceeds the 200-message limit';
    end if;

    insert into public.rooms (name)
    values ('lobby')
    on conflict (name) do nothing;

    select rooms.id, rooms.archive_enabled
    into strict v_room_id, v_archive_enabled
    from public.rooms
    where rooms.name = 'lobby'
    for update;

    if not v_archive_enabled then
        raise exception 'lobby archiving is disabled';
    end if;

    select collector_state.current_epoch_id, collector_state.last_saved_seq
    into v_epoch_id, v_last_saved_seq
    from public.collector_state
    where collector_state.room_id = v_room_id
    for update;

    if not found then
        if p_expected_epoch_id is not null or p_expected_last_saved_seq <> 0 then
            raise exception using
                errcode = '40001',
                message = 'collector state changed before ingestion';
        end if;

        select room_epochs.id
        into v_epoch_id
        from public.room_epochs
        where room_epochs.room_id = v_room_id
          and room_epochs.observed_ended_at is null
        for update;

        if not found then
            insert into public.room_epochs (room_id, epoch_number)
            select v_room_id, coalesce(max(room_epochs.epoch_number), 0) + 1
            from public.room_epochs
            where room_epochs.room_id = v_room_id
            returning id into v_epoch_id;
        end if;

        insert into public.collector_state (
            room_id,
            current_epoch_id,
            last_saved_seq
        )
        values (
            v_room_id,
            v_epoch_id,
            0
        );

        v_last_saved_seq := 0;
    elsif p_expected_epoch_id is distinct from v_epoch_id
       or p_expected_last_saved_seq is distinct from v_last_saved_seq then
        raise exception using
            errcode = '40001',
            message = 'collector state changed before ingestion';
    end if;

    if v_message_count = 0 then
        if p_response_first_seq is not null then
            raise exception 'first_seq must be null for an empty response';
        end if;

        if p_response_last_seq is distinct from v_last_saved_seq then
            raise exception 'empty response last_seq does not match the collector cursor';
        end if;
    else
        if p_response_first_seq is null or p_response_last_seq is null then
            raise exception 'non-empty response requires first_seq and last_seq';
        end if;

        if p_response_first_seq <= v_last_saved_seq then
            raise exception 'response does not begin after the collector cursor';
        end if;

        if p_response_last_seq < p_response_first_seq then
            raise exception 'response last_seq precedes first_seq';
        end if;

        if p_response_last_seq - p_response_first_seq + 1 <> v_message_count then
            raise exception 'response sequence range is not contiguous';
        end if;

        if exists (
            select 1
            from jsonb_array_elements(p_messages) with ordinality as batch(message, ordinal)
            where jsonb_typeof(batch.message) <> 'object'
               or (batch.message ->> 'seq')::bigint
                    <> p_response_first_seq + batch.ordinal - 1
        ) then
            raise exception 'message sequence values are not contiguous';
        end if;

        if p_response_first_seq > v_last_saved_seq + 1 then
            insert into public.sequence_gaps (
                room_epoch_id,
                expected_seq,
                observed_first_seq
            )
            values (
                v_epoch_id,
                v_last_saved_seq + 1,
                p_response_first_seq
            )
            on conflict (room_epoch_id, expected_seq, observed_first_seq) do nothing;
        end if;

        insert into public.messages (
            room_epoch_id,
            seq,
            message_timestamp,
            sender,
            text,
            nonce
        )
        select
            v_epoch_id,
            (batch.message ->> 'seq')::bigint,
            (batch.message ->> 'ts')::timestamptz,
            batch.message ->> 'from',
            batch.message ->> 'text',
            case
                when batch.message ? 'nonce'
                 and batch.message -> 'nonce' <> 'null'::jsonb
                    then (batch.message ->> 'nonce')::numeric(19, 0)
                else null
            end
        from jsonb_array_elements(p_messages) as batch(message)
        on conflict (room_epoch_id, seq) do nothing;

        if exists (
            select 1
            from jsonb_array_elements(p_messages) as batch(message)
            join public.messages
              on messages.room_epoch_id = v_epoch_id
             and messages.seq = (batch.message ->> 'seq')::bigint
            where messages.message_timestamp
                    is distinct from (batch.message ->> 'ts')::timestamptz
               or messages.sender is distinct from batch.message ->> 'from'
               or messages.text is distinct from batch.message ->> 'text'
               or messages.nonce is distinct from case
                    when batch.message ? 'nonce'
                     and batch.message -> 'nonce' <> 'null'::jsonb
                        then (batch.message ->> 'nonce')::numeric(19, 0)
                    else null
                  end
        ) then
            raise exception 'stored message conflicts with the received message';
        end if;

        v_last_saved_seq := p_response_last_seq;
    end if;

    update public.collector_state
    set last_saved_seq = v_last_saved_seq,
        last_attempted_poll_at = v_now,
        last_successful_poll_at = v_now,
        last_error = null,
        updated_at = v_now
    where collector_state.room_id = v_room_id;

    return jsonb_build_object(
        'room_id', v_room_id,
        'epoch_id', v_epoch_id,
        'last_saved_seq', v_last_saved_seq,
        'messages_processed', v_message_count
    );
end;
$$;

create or replace function public.rotate_lobby_epoch(
    p_expected_epoch_id bigint,
    p_expected_last_saved_seq bigint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
    v_room_id bigint;
    v_epoch_id bigint;
    v_last_saved_seq bigint;
    v_next_epoch_id bigint;
    v_now timestamptz := clock_timestamp();
begin
    select rooms.id
    into strict v_room_id
    from public.rooms
    where rooms.name = 'lobby'
      and rooms.archive_enabled
    for update;

    select collector_state.current_epoch_id, collector_state.last_saved_seq
    into strict v_epoch_id, v_last_saved_seq
    from public.collector_state
    where collector_state.room_id = v_room_id
    for update;

    if p_expected_epoch_id is distinct from v_epoch_id
       or p_expected_last_saved_seq is distinct from v_last_saved_seq then
        raise exception using
            errcode = '40001',
            message = 'collector state changed before epoch rotation';
    end if;

    update public.room_epochs
    set observed_ended_at = v_now
    where room_epochs.id = v_epoch_id
      and room_epochs.room_id = v_room_id
      and room_epochs.observed_ended_at is null;

    if not found then
        raise exception 'current room epoch is not open';
    end if;

    insert into public.room_epochs (room_id, epoch_number, observed_started_at)
    select v_room_id, max(room_epochs.epoch_number) + 1, v_now
    from public.room_epochs
    where room_epochs.room_id = v_room_id
    returning id into v_next_epoch_id;

    update public.collector_state
    set current_epoch_id = v_next_epoch_id,
        last_saved_seq = 0,
        updated_at = v_now
    where collector_state.room_id = v_room_id;

    return jsonb_build_object(
        'room_id', v_room_id,
        'epoch_id', v_next_epoch_id,
        'last_saved_seq', 0
    );
end;
$$;

revoke all on function public.ingest_lobby_poll(
    bigint,
    bigint,
    bigint,
    bigint,
    jsonb
) from public, anon, authenticated;

grant execute on function public.ingest_lobby_poll(
    bigint,
    bigint,
    bigint,
    bigint,
    jsonb
) to service_role;

revoke all on function public.rotate_lobby_epoch(
    bigint,
    bigint
) from public, anon, authenticated;

grant execute on function public.rotate_lobby_epoch(
    bigint,
    bigint
) to service_role;

commit;
