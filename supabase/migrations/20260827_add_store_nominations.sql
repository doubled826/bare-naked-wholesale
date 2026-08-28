CREATE TABLE IF NOT EXISTS store_nominations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_name TEXT NOT NULL,
  consumer_email TEXT NOT NULL,
  consumer_phone TEXT,
  store_name TEXT NOT NULL,
  store_address TEXT,
  store_city TEXT,
  store_state TEXT,
  store_postal_code TEXT,
  store_url TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'reviewing', 'contacted', 'converted', 'dismissed')),
  admin_notes TEXT,
  source TEXT,
  landing_page_url TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  ip_address TEXT,
  user_agent TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_nominations_created_at
  ON store_nominations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_store_nominations_status
  ON store_nominations(status, created_at DESC);

ALTER TABLE store_nominations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view store nominations"
  ON store_nominations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

CREATE POLICY "Admins can update store nominations"
  ON store_nominations FOR UPDATE
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

CREATE POLICY "Admins can delete store nominations"
  ON store_nominations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS update_store_nominations_updated_at ON store_nominations;
CREATE TRIGGER update_store_nominations_updated_at BEFORE UPDATE ON store_nominations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
