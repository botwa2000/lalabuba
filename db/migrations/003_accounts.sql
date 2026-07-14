-- Account management: parent accounts + device linking + refresh tokens

CREATE TABLE IF NOT EXISTS accounts (
  id             SERIAL PRIMARY KEY,
  email          VARCHAR(255) UNIQUE NOT NULL,
  password_hash  VARCHAR(100) NOT NULL,
  display_name   VARCHAR(60),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  last_login_at  TIMESTAMPTZ
);

-- One account can own multiple device profiles (phone + tablet, etc.)
CREATE TABLE IF NOT EXISTS account_devices (
  account_id   INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  device_uuid  VARCHAR(36) NOT NULL,
  label        VARCHAR(60),
  linked_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (account_id, device_uuid)
);
CREATE INDEX IF NOT EXISTS idx_account_devices_uuid ON account_devices(device_uuid);

-- Refresh tokens (stored as SHA-256 hashes, never plaintext)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  token_hash   CHAR(64) PRIMARY KEY,
  account_id   INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  device_uuid  VARCHAR(36),
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_account  ON refresh_tokens(account_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires  ON refresh_tokens(expires_at);
