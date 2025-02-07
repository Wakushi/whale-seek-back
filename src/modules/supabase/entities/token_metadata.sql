create table token_metadata (
   id text primary key,                    -- CoinGecko ID
   symbol text not null,                   -- Token symbol
   name text not null,                     -- Token name
   contract_addresses jsonb,               -- Contract addresses across chains
   market_cap_rank integer,                -- Market cap ranking (nullable as not all tokens have rank)
   genesis_date timestamptz,               -- Launch date (nullable)
   categories text[],                      -- Token categories array
   links jsonb not null,                   -- Object containing website, social links etc
   platforms jsonb,                        -- Platforms where token exists
   last_updated timestamptz not null default now(),
   created_at timestamptz not null default now()
);

create index token_metadata_symbol_idx on token_metadata (symbol);

create index token_metadata_market_cap_rank_idx on token_metadata (market_cap_rank);