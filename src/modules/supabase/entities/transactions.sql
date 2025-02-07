-- Transactions table to store all tracked transactions
CREATE TABLE transactions (
    id BIGSERIAL PRIMARY KEY,
    transaction_hash VARCHAR(66) UNIQUE NOT NULL,
    block_number VARCHAR(66) NOT NULL,
    whale_address VARCHAR(42) NOT NULL, -- Renamed from from_address
    input_token VARCHAR(42), -- New column
    output_token VARCHAR(42), -- New column
    value NUMERIC(78, 0) NOT NULL, -- For large numbers
    asset VARCHAR(10) NOT NULL,
    decimals INT NOT NULL,
    raw_value VARCHAR(66) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    network VARCHAR(20) NOT NULL,
    protocol VARCHAR(20) NOT NULL, -- New column
    trade_wallet_percentage NUMERIC(5, 2) -- New column, optional
);

-- Indexes
CREATE INDEX idx_transactions_whale_address ON transactions(whale_address);
CREATE INDEX idx_transactions_input_token ON transactions(input_token);
CREATE INDEX idx_transactions_output_token ON transactions(output_token);
CREATE INDEX idx_transactions_timestamp ON transactions(timestamp);
CREATE INDEX idx_transactions_asset ON transactions(asset);
CREATE INDEX idx_transactions_protocol ON transactions(protocol);