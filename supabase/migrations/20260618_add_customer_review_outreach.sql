CREATE TABLE IF NOT EXISTS outreach_customer_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  review_text TEXT NOT NULL,
  reviewer_name TEXT,
  rating INTEGER NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  product_name TEXT,
  image_url TEXT,
  fera_review_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outreach_prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'prospect'
    CHECK (status IN ('prospect', 'samples_sent', 'signed_up', 'ordered', 'suppressed')),
  source TEXT,
  pipedrive_deal_id BIGINT,
  last_customer_review_sent_at TIMESTAMPTZ,
  suppressed_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outreach_email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID REFERENCES outreach_customer_reviews(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  cta_mode TEXT NOT NULL DEFAULT 'both'
    CHECK (cta_mode IN ('both', 'samples', 'wholesale')),
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outreach_email_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  send_id UUID NOT NULL REFERENCES outreach_email_sends(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES outreach_prospects(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  store_name TEXT,
  contact_name TEXT,
  resend_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'failed')),
  error TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_customer_reviews_active
  ON outreach_customer_reviews(is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_outreach_prospects_status
  ON outreach_prospects(status, last_customer_review_sent_at);

CREATE INDEX IF NOT EXISTS idx_outreach_email_recipients_send
  ON outreach_email_recipients(send_id);

ALTER TABLE outreach_customer_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_email_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_email_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage outreach customer reviews"
  ON outreach_customer_reviews FOR ALL
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

CREATE POLICY "Admins can manage outreach prospects"
  ON outreach_prospects FOR ALL
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

CREATE POLICY "Admins can manage outreach email sends"
  ON outreach_email_sends FOR ALL
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

CREATE POLICY "Admins can manage outreach email recipients"
  ON outreach_email_recipients FOR ALL
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
