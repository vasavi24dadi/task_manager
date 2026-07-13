ALTER TABLE users
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

UPDATE users
SET status = COALESCE(NULLIF(status, ''), 'active')
WHERE status IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
