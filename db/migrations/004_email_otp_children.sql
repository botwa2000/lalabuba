-- Email OTP verification + child profiles

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_verification_attempted_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS email_otp_codes (
  id         BIGSERIAL PRIMARY KEY,
  email      VARCHAR(255) NOT NULL,
  code       CHAR(6)      NOT NULL,
  expires_at TIMESTAMPTZ  NOT NULL,
  used_at    TIMESTAMPTZ,
  attempts   SMALLINT     DEFAULT 0,
  created_at TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_otp_email ON email_otp_codes(email, expires_at);

CREATE TABLE IF NOT EXISTS child_profiles (
  id              SERIAL PRIMARY KEY,
  account_id      INTEGER      NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  nickname        VARCHAR(60)  NOT NULL,
  avatar_index    SMALLINT     DEFAULT 0,
  age_group       VARCHAR(5),
  access_pin_hash VARCHAR(60),
  sort_order      SMALLINT     DEFAULT 0,
  created_at      TIMESTAMPTZ  DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_child_profiles_account ON child_profiles(account_id);
