-- Table to store basic whale information
create table whale_info (
    whale_address text primary key,        -- Unique wallet address of the whale
    detected_transaction_id text not null  -- Transaction that led to the detection of the whale
    first_seen timestamptz not null,       -- Timestamp when the whale was first discovered
    last_seen timestamptz not null,        -- Timestamp of the whale's most recent activity
    created_at timestamptz not null default now(),  -- Timestamp when the record was created
    updated_at timestamptz not null default now()   -- Timestamp when the record was last updated
);

-- Index for faster lookups by whale address
create index whale_info_whale_address_idx on whale_info (whale_address);

-- Index for querying whales by their first seen timestamp
create index whale_info_first_seen_idx on whale_info (first_seen);

-- Index for querying whales by their last seen timestamp
create index whale_info_last_seen_idx on whale_info (last_seen);