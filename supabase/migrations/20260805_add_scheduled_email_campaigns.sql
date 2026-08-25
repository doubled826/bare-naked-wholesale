ALTER TABLE email_campaigns
  DROP CONSTRAINT IF EXISTS email_campaigns_status_check;

ALTER TABLE email_campaigns
  ADD CONSTRAINT email_campaigns_status_check
  CHECK (status IN ('draft', 'scheduled', 'sending', 'sent'));

ALTER TABLE email_campaigns
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS schedule_error TEXT;

CREATE INDEX IF NOT EXISTS idx_email_campaigns_scheduled
  ON email_campaigns(status, scheduled_at)
  WHERE status = 'scheduled';
