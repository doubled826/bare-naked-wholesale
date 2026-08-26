ALTER TABLE wholesale_leads
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'not_requested',
  ADD COLUMN IF NOT EXISTS verification_token UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS verification_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_store_url TEXT,
  ADD COLUMN IF NOT EXISTS verification_social_url TEXT,
  ADD COLUMN IF NOT EXISTS verification_google_profile_url TEXT,
  ADD COLUMN IF NOT EXISTS verification_notes TEXT;

UPDATE wholesale_leads
SET verification_token = gen_random_uuid()
WHERE verification_token IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'wholesale_leads_verification_status_check'
  ) THEN
    ALTER TABLE wholesale_leads
      ADD CONSTRAINT wholesale_leads_verification_status_check
      CHECK (verification_status IN ('not_requested', 'requested', 'submitted', 'verified', 'failed'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_wholesale_leads_verification_token
  ON wholesale_leads (verification_token)
  WHERE verification_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wholesale_leads_verification_status_created
  ON wholesale_leads (verification_status, created_at DESC);
