CREATE TABLE IF NOT EXISTS bare_launch_offer_email_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id UUID NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL
    CHECK (template_key IN (
      'bare_launch_offer_day_1',
      'bare_launch_offer_day_4',
      'bare_launch_offer_day_9',
      'bare_launch_offer_final'
    )),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resend_message_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (retailer_id, template_key)
);

CREATE INDEX IF NOT EXISTS idx_bare_launch_offer_email_reminders_retailer
  ON bare_launch_offer_email_reminders(retailer_id, sent_at);

ALTER TABLE bare_launch_offer_email_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage Bare Launch Offer email reminders"
  ON bare_launch_offer_email_reminders FOR ALL
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
