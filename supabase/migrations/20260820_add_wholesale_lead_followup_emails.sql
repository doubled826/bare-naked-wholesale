CREATE TABLE IF NOT EXISTS wholesale_lead_followup_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES wholesale_leads(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  processing_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lead_id, template_key)
);

CREATE INDEX IF NOT EXISTS idx_wholesale_lead_followup_emails_due
  ON wholesale_lead_followup_emails (status, scheduled_for);

CREATE INDEX IF NOT EXISTS idx_wholesale_lead_followup_emails_lead
  ON wholesale_lead_followup_emails (lead_id, template_key);

DROP TRIGGER IF EXISTS update_wholesale_lead_followup_emails_updated_at ON wholesale_lead_followup_emails;
CREATE TRIGGER update_wholesale_lead_followup_emails_updated_at BEFORE UPDATE ON wholesale_lead_followup_emails
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE wholesale_lead_followup_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage wholesale lead followup emails"
  ON wholesale_lead_followup_emails FOR ALL
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
