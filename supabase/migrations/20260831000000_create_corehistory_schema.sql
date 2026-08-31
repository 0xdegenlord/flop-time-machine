begin;

create table public.rooms (
    id bigint generated always as identity,
    source_base_url text not null default 'https://technocore.chat',
    name text not null,
    archive_enabled boolean not null default true,
    added_at timestamptz not null default now(),
    constraint rooms_pkey primary key (id),
    constraint rooms_name_key unique (name),
    constraint rooms_source_base_url_check
        check (source_base_url = 'https://technocore.chat'),
    constraint rooms_name_check
        check (name ~ '^[a-z0-9][a-z0-9_-]{0,47}$')
);

create table public.room_epochs (
    id bigint generated always as identity,
    room_id bigint not null,
    epoch_number integer not null,
    observed_started_at timestamptz not null default now(),
    observed_ended_at timestamptz,
    constraint room_epochs_pkey primary key (id),
    constraint room_epochs_room_id_fkey
        foreign key (room_id)
        references public.rooms (id)
        on update restrict
        on delete restrict,
    constraint room_epochs_room_epoch_number_key
        unique (room_id, epoch_number),
    constraint room_epochs_room_id_id_key
        unique (room_id, id),
    constraint room_epochs_epoch_number_check
        check (epoch_number > 0),
    constraint room_epochs_dates_check
        check (
            observed_ended_at is null
            or observed_ended_at >= observed_started_at
        )
);

create unique index room_epochs_one_open_epoch_per_room_idx
    on public.room_epochs (room_id)
    where observed_ended_at is null;

create table public.messages (
    id bigint generated always as identity,
    room_epoch_id bigint not null,
    seq bigint not null,
    message_timestamp timestamptz not null,
    sender text not null,
    text text not null,
    nonce numeric(19, 0),
    collected_at timestamptz not null default now(),
    constraint messages_pkey primary key (id),
    constraint messages_room_epoch_id_fkey
        foreign key (room_epoch_id)
        references public.room_epochs (id)
        on update restrict
        on delete restrict,
    constraint messages_room_epoch_seq_key
        unique (room_epoch_id, seq),
    constraint messages_seq_check
        check (seq > 0),
    constraint messages_sender_check
        check (char_length(sender) > 0),
    constraint messages_text_check
        check (char_length(text) between 1 and 4096),
    constraint messages_nonce_check
        check (nonce is null or nonce > 0)
);

create index messages_timestamp_idx
    on public.messages (message_timestamp);

create index messages_text_search_idx
    on public.messages
    using gin (to_tsvector('simple'::regconfig, text));

create table public.sequence_gaps (
    id bigint generated always as identity,
    room_epoch_id bigint not null,
    expected_seq bigint not null,
    observed_first_seq bigint not null,
    detected_at timestamptz not null default now(),
    cause text,
    constraint sequence_gaps_pkey primary key (id),
    constraint sequence_gaps_room_epoch_id_fkey
        foreign key (room_epoch_id)
        references public.room_epochs (id)
        on update restrict
        on delete restrict,
    constraint sequence_gaps_epoch_expected_observed_key
        unique (room_epoch_id, expected_seq, observed_first_seq),
    constraint sequence_gaps_expected_seq_check
        check (expected_seq > 0),
    constraint sequence_gaps_observed_first_seq_check
        check (observed_first_seq > expected_seq)
);

create table public.collector_state (
    room_id bigint not null,
    current_epoch_id bigint not null,
    last_saved_seq bigint not null default 0,
    last_attempted_poll_at timestamptz,
    last_successful_poll_at timestamptz,
    last_error text,
    updated_at timestamptz not null default now(),
    constraint collector_state_pkey primary key (room_id),
    constraint collector_state_room_id_fkey
        foreign key (room_id)
        references public.rooms (id)
        on update restrict
        on delete restrict,
    constraint collector_state_current_epoch_fkey
        foreign key (room_id, current_epoch_id)
        references public.room_epochs (room_id, id)
        on update restrict
        on delete restrict,
    constraint collector_state_last_saved_seq_check
        check (last_saved_seq >= 0)
);

create index collector_state_current_epoch_idx
    on public.collector_state (current_epoch_id);

alter table public.rooms enable row level security;
alter table public.room_epochs enable row level security;
alter table public.messages enable row level security;
alter table public.sequence_gaps enable row level security;
alter table public.collector_state enable row level security;

commit;
