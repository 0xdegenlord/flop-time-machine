begin;

create or replace function public.get_lobby_epochs(
    p_limit integer default 50,
    p_before_epoch_number integer default null
)
returns table (
    epoch_id text,
    epoch_number integer,
    observed_started_at timestamptz,
    observed_ended_at timestamptz,
    message_count text,
    first_message_timestamp timestamptz,
    last_message_timestamp timestamptz,
    gap_count text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
    if p_limit is null or p_limit < 1 or p_limit > 100 then
        raise exception 'limit must be between 1 and 100';
    end if;

    if p_before_epoch_number is not null and p_before_epoch_number < 1 then
        raise exception 'epoch cursor must be a positive integer';
    end if;

    return query
    select
        room_epochs.id::text,
        room_epochs.epoch_number,
        room_epochs.observed_started_at,
        room_epochs.observed_ended_at,
        message_stats.message_count::text,
        message_stats.first_message_timestamp,
        message_stats.last_message_timestamp,
        gap_stats.gap_count::text
    from public.rooms
    join lateral (
        select
            selected_epochs.id,
            selected_epochs.epoch_number,
            selected_epochs.observed_started_at,
            selected_epochs.observed_ended_at
        from public.room_epochs as selected_epochs
        where selected_epochs.room_id = rooms.id
          and (
              p_before_epoch_number is null
              or selected_epochs.epoch_number < p_before_epoch_number
          )
        order by selected_epochs.epoch_number desc
        limit p_limit
    ) as room_epochs on true
    cross join lateral (
        select
            count(*) as message_count,
            min(messages.message_timestamp) as first_message_timestamp,
            max(messages.message_timestamp) as last_message_timestamp
        from public.messages
        where messages.room_epoch_id = room_epochs.id
    ) as message_stats
    cross join lateral (
        select count(*) as gap_count
        from public.sequence_gaps
        where sequence_gaps.room_epoch_id = room_epochs.id
    ) as gap_stats
    where rooms.name = 'lobby'
    order by room_epochs.epoch_number desc;
end;
$$;

create or replace function public.get_lobby_messages(
    p_limit integer default 50,
    p_before_epoch_number integer default null,
    p_before_seq bigint default null,
    p_epoch_number integer default null,
    p_query text default null,
    p_from_timestamp timestamptz default null,
    p_to_timestamp timestamptz default null
)
returns table (
    epoch_number integer,
    seq text,
    message_timestamp timestamptz,
    sender text,
    message_text text,
    nonce text,
    collected_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
    v_query text;
    v_tsquery tsquery;
begin
    if p_limit is null or p_limit < 1 or p_limit > 100 then
        raise exception 'limit must be between 1 and 100';
    end if;

    if (p_before_epoch_number is null) <> (p_before_seq is null) then
        raise exception 'epoch and sequence cursors must be provided together';
    end if;

    if p_before_epoch_number is not null and p_before_epoch_number < 1 then
        raise exception 'epoch cursor must be a positive integer';
    end if;

    if p_before_seq is not null and p_before_seq < 1 then
        raise exception 'sequence cursor must be a positive integer';
    end if;

    if p_epoch_number is not null and p_epoch_number < 1 then
        raise exception 'epoch filter must be a positive integer';
    end if;

    if p_from_timestamp is not null
       and p_to_timestamp is not null
       and p_from_timestamp >= p_to_timestamp then
        raise exception 'from timestamp must precede to timestamp';
    end if;

    if p_query is not null then
        v_query := btrim(p_query);

        if v_query = '' then
            raise exception 'search query must not be empty';
        end if;

        if char_length(v_query) > 200 then
            raise exception 'search query must not exceed 200 characters';
        end if;

        if v_query ~ '[[:cntrl:]]' then
            raise exception 'search query must not contain control characters';
        end if;

        v_tsquery := websearch_to_tsquery('simple'::regconfig, v_query);

        if numnode(v_tsquery) = 0 then
            raise exception 'search query must contain a searchable term';
        end if;
    end if;

    if v_tsquery is null then
        return query
        select
            room_epochs.epoch_number,
            messages.seq::text,
            messages.message_timestamp,
            messages.sender,
            messages.text,
            messages.nonce::text,
            messages.collected_at
        from public.rooms
        join public.room_epochs
          on room_epochs.room_id = rooms.id
        join public.messages
          on messages.room_epoch_id = room_epochs.id
        where rooms.name = 'lobby'
          and (
              p_epoch_number is null
              or room_epochs.epoch_number = p_epoch_number
          )
          and (
              p_before_epoch_number is null
              or (room_epochs.epoch_number, messages.seq)
                   < (p_before_epoch_number, p_before_seq)
          )
          and (
              p_from_timestamp is null
              or messages.message_timestamp >= p_from_timestamp
          )
          and (
              p_to_timestamp is null
              or messages.message_timestamp < p_to_timestamp
          )
        order by room_epochs.epoch_number desc, messages.seq desc
        limit p_limit;
    else
        return query
        select
            room_epochs.epoch_number,
            messages.seq::text,
            messages.message_timestamp,
            messages.sender,
            messages.text,
            messages.nonce::text,
            messages.collected_at
        from public.rooms
        join public.room_epochs
          on room_epochs.room_id = rooms.id
        join public.messages
          on messages.room_epoch_id = room_epochs.id
        where rooms.name = 'lobby'
          and to_tsvector('simple'::regconfig, messages.text) @@ v_tsquery
          and (
              p_epoch_number is null
              or room_epochs.epoch_number = p_epoch_number
          )
          and (
              p_before_epoch_number is null
              or (room_epochs.epoch_number, messages.seq)
                   < (p_before_epoch_number, p_before_seq)
          )
          and (
              p_from_timestamp is null
              or messages.message_timestamp >= p_from_timestamp
          )
          and (
              p_to_timestamp is null
              or messages.message_timestamp < p_to_timestamp
          )
        order by room_epochs.epoch_number desc, messages.seq desc
        limit p_limit;
    end if;
end;
$$;

create or replace function public.get_lobby_archive_status()
returns table (
    archive_enabled boolean,
    current_epoch_number integer,
    last_saved_seq text,
    last_successful_poll_at timestamptz,
    latest_message_timestamp timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
    select
        rooms.archive_enabled,
        room_epochs.epoch_number,
        collector_state.last_saved_seq::text,
        collector_state.last_successful_poll_at,
        latest_message.message_timestamp
    from public.rooms
    left join public.collector_state
      on collector_state.room_id = rooms.id
    left join public.room_epochs
      on room_epochs.id = collector_state.current_epoch_id
     and room_epochs.room_id = rooms.id
    left join lateral (
        select messages.message_timestamp
        from public.messages
        where messages.room_epoch_id = room_epochs.id
        order by messages.seq desc
        limit 1
    ) as latest_message on true
    where rooms.name = 'lobby';
$$;

revoke all on function public.get_lobby_epochs(integer, integer)
    from public, anon, authenticated;
grant execute on function public.get_lobby_epochs(integer, integer)
    to anon, authenticated;

revoke all on function public.get_lobby_messages(
    integer,
    integer,
    bigint,
    integer,
    text,
    timestamptz,
    timestamptz
) from public, anon, authenticated;
grant execute on function public.get_lobby_messages(
    integer,
    integer,
    bigint,
    integer,
    text,
    timestamptz,
    timestamptz
) to anon, authenticated;

revoke all on function public.get_lobby_archive_status()
    from public, anon, authenticated;
grant execute on function public.get_lobby_archive_status()
    to anon, authenticated;

commit;
