ALTER TABLE email_campaign_recipients
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bounced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS complained_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_event_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS resend_email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  svix_id TEXT NOT NULL UNIQUE,
  resend_message_id TEXT,
  event_type TEXT NOT NULL,
  event_created_at TIMESTAMPTZ,
  recipient_email TEXT,
  campaign_id UUID REFERENCES email_campaigns(id) ON DELETE SET NULL,
  campaign_recipient_id UUID REFERENCES email_campaign_recipients(id) ON DELETE SET NULL,
  clicked_url TEXT,
  raw_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resend_email_events_message
  ON resend_email_events(resend_message_id, event_created_at DESC);

CREATE INDEX IF NOT EXISTS idx_resend_email_events_campaign
  ON resend_email_events(campaign_id, event_created_at DESC);

CREATE INDEX IF NOT EXISTS idx_resend_email_events_recipient
  ON resend_email_events(campaign_recipient_id, event_created_at DESC);

ALTER TABLE resend_email_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read Resend email events"
  ON resend_email_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );
