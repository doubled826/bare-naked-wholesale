CREATE TABLE IF NOT EXISTS first_order_followups (
  retailer_id UUID PRIMARY KEY REFERENCES retailers(id) ON DELETE CASCADE,
  owner_name TEXT,
  next_follow_up_at TIMESTAMPTZ,
  last_contacted_at TIMESTAMPTZ,
  last_contact_method TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_first_order_followups_next_follow_up
  ON first_order_followups(next_follow_up_at);

ALTER TABLE first_order_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage first order followups"
  ON first_order_followups FOR ALL
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
