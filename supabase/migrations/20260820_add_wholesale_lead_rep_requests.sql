CREATE TABLE IF NOT EXISTS wholesale_lead_rep_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES wholesale_leads(id) ON DELETE CASCADE,
  contact_method TEXT NOT NULL
    CHECK (contact_method IN ('call', 'text', 'email')),
  best_time_of_day TEXT NOT NULL
    CHECK (best_time_of_day IN ('morning', 'afternoon', 'evening', 'anytime')),
  notes TEXT,
  notification_sent_at TIMESTAMPTZ,
  notification_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wholesale_lead_rep_requests_lead
  ON wholesale_lead_rep_requests (lead_id, created_at DESC);

DROP TRIGGER IF EXISTS update_wholesale_lead_rep_requests_updated_at ON wholesale_lead_rep_requests;
CREATE TRIGGER update_wholesale_lead_rep_requests_updated_at BEFORE UPDATE ON wholesale_lead_rep_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE wholesale_lead_rep_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage wholesale lead rep requests"
  ON wholesale_lead_rep_requests FOR ALL
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
