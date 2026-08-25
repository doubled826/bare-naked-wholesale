CREATE TABLE IF NOT EXISTS wholesale_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  store_name TEXT NOT NULL,
  phone TEXT,
  store_url TEXT,
  store_type TEXT,
  location_count INTEGER,
  currently_buying_wholesale TEXT
    CHECK (currently_buying_wholesale IN ('yes', 'no', 'opening_soon') OR currently_buying_wholesale IS NULL),
  shipping_address_1 TEXT NOT NULL,
  shipping_address_2 TEXT,
  shipping_city TEXT NOT NULL,
  shipping_state TEXT NOT NULL,
  shipping_postal_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'approved', 'sample_pack_pending', 'tracking_added', 'delivered', 'follow_up_due', 'converted', 'closed')),
  source TEXT NOT NULL DEFAULT 'landing_page',
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  gclid TEXT,
  fbclid TEXT,
  landing_page_url TEXT,
  referrer TEXT,
  user_agent TEXT,
  ip_address INET,
  submission_count INTEGER NOT NULL DEFAULT 1,
  last_submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tracking_carrier TEXT,
  tracking_number TEXT,
  tracking_url TEXT,
  tracking_added_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  converted_retailer_id UUID REFERENCES retailers(id) ON DELETE SET NULL,
  converted_at TIMESTAMPTZ,
  notes TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wholesale_leads_status_created
  ON wholesale_leads (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wholesale_leads_converted_retailer
  ON wholesale_leads (converted_retailer_id)
  WHERE converted_retailer_id IS NOT NULL;

DROP TRIGGER IF EXISTS update_wholesale_leads_updated_at ON wholesale_leads;
CREATE TRIGGER update_wholesale_leads_updated_at BEFORE UPDATE ON wholesale_leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE wholesale_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage wholesale leads"
  ON wholesale_leads FOR ALL
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
