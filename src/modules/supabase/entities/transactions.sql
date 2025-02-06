-- Transactions table to store all tracked transactions
CREATE TABLE transactions (
    id BIGSERIAL PRIMARY KEY,
    transaction_hash VARCHAR(66) UNIQUE NOT NULL,
    block_number VARCHAR(66) NOT NULL,
    from_address VARCHAR(42) NOT NULL,
    to_address VARCHAR(42) NOT NULL,
    contract_address VARCHAR(42),
    value NUMERIC(78, 0) NOT NULL, -- For large numbers
    asset VARCHAR(10) NOT NULL,
    category VARCHAR(20) NOT NULL, -- 'external' or 'token'
    decimals INT NOT NULL,
    raw_value VARCHAR(66) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    network VARCHAR(20) NOT NULL
);

CREATE INDEX idx_transactions_from_address ON transactions(from_address);
CREATE INDEX idx_transactions_to_address ON transactions(to_address);
CREATE INDEX idx_transactions_timestamp ON transactions(timestamp);
CREATE INDEX idx_transactions_asset ON transactions(asset);