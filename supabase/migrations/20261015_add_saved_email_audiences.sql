CREATE TABLE IF NOT EXISTS email_audiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT email_audiences_name_check CHECK (char_length(trim(name)) BETWEEN 2 AND 80),
  CONSTRAINT email_audiences_conditions_check CHECK (jsonb_typeof(conditions) = 'array')
);

ALTER TABLE email_audiences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email audiences"
  ON email_audiences FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

ALTER TABLE email_campaigns
  ADD COLUMN IF NOT EXISTS audience_id UUID REFERENCES email_audiences(id) ON DELETE SET NULL;

ALTER TABLE email_campaigns
  DROP CONSTRAINT IF EXISTS email_campaigns_audience_filter_check;

ALTER TABLE email_campaigns
  ADD CONSTRAINT email_campaigns_audience_filter_check
  CHECK (
    audience_filter IN (
      'all_retailers',
      'never_ordered',
      'ordered_once',
      'repeat_buyers',
      'lapsed_180_days',
      'saved_audience',
      'manual'
    )
  );

CREATE INDEX IF NOT EXISTS idx_email_campaigns_audience
  ON email_campaigns(audience_id);

CREATE INDEX IF NOT EXISTS idx_email_audiences_updated
  ON email_audiences(updated_at DESC);
