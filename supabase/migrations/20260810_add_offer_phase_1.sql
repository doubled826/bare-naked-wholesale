ALTER TABLE discount_codes
  ADD COLUMN IF NOT EXISTS application_method TEXT NOT NULL DEFAULT 'promo_code'
    CHECK (application_method IN ('automatic', 'promo_code')),
  ADD COLUMN IF NOT EXISTS benefit_category TEXT NOT NULL DEFAULT 'order_discount'
    CHECK (benefit_category IN ('order_discount', 'first_order_discount')),
  ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS priority_override BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stackable_with_other_discounts BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS qualification_type TEXT NOT NULL DEFAULT 'none'
    CHECK (qualification_type IN ('none', 'retailer_signup_window')),
  ADD COLUMN IF NOT EXISTS qualification_starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS qualification_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS redemption_starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS redemption_ends_at TIMESTAMPTZ;

UPDATE discount_codes
SET
  redemption_starts_at = COALESCE(redemption_starts_at, starts_at),
  redemption_ends_at = COALESCE(redemption_ends_at, ends_at),
  qualification_starts_at = COALESCE(qualification_starts_at, starts_at),
  qualification_ends_at = COALESCE(qualification_ends_at, ends_at)
WHERE redemption_starts_at IS NULL
  OR redemption_ends_at IS NULL
  OR qualification_starts_at IS NULL
  OR qualification_ends_at IS NULL;

CREATE TABLE IF NOT EXISTS benefit_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id UUID NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('welcome_offer', 'discount_code')),
  source_id TEXT,
  source_name TEXT NOT NULL,
  benefit_category TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed_amount')),
  discount_value DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  redeemed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (order_id, benefit_category)
);

CREATE INDEX IF NOT EXISTS idx_benefit_redemptions_retailer_category
  ON benefit_redemptions(retailer_id, benefit_category, redeemed_at DESC);

ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS bar_message TEXT,
  ADD COLUMN IF NOT EXISTS popup_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS popup_headline TEXT,
  ADD COLUMN IF NOT EXISTS popup_body TEXT,
  ADD COLUMN IF NOT EXISTS cta_label TEXT,
  ADD COLUMN IF NOT EXISTS cta_url TEXT,
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS targeting_type TEXT NOT NULL DEFAULT 'all_retailers'
    CHECK (targeting_type IN ('all_retailers', 'manual', 'new_retailers', 'linked_discount')),
  ADD COLUMN IF NOT EXISTS manual_retailer_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS linked_discount_code_id UUID REFERENCES discount_codes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS inherit_discount_eligibility BOOLEAN NOT NULL DEFAULT false;

UPDATE announcements
SET bar_message = COALESCE(bar_message, message)
WHERE bar_message IS NULL;

CREATE TABLE IF NOT EXISTS announcement_popup_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  retailer_id UUID NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (announcement_id, retailer_id, version)
);

CREATE INDEX IF NOT EXISTS idx_announcement_popup_views_retailer
  ON announcement_popup_views(retailer_id, announcement_id, version);

ALTER TABLE benefit_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_popup_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage benefit redemptions"
  ON benefit_redemptions FOR ALL
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

CREATE POLICY "Retailers can view their own benefit redemptions"
  ON benefit_redemptions FOR SELECT
  TO authenticated
  USING (retailer_id = auth.uid());

CREATE POLICY "Retailers can view their own announcement popup state"
  ON announcement_popup_views FOR SELECT
  TO authenticated
  USING (retailer_id = auth.uid());

CREATE POLICY "Retailers can create their own announcement popup state"
  ON announcement_popup_views FOR INSERT
  TO authenticated
  WITH CHECK (retailer_id = auth.uid());

CREATE POLICY "Retailers can update their own announcement popup state"
  ON announcement_popup_views FOR UPDATE
  TO authenticated
  USING (retailer_id = auth.uid())
  WITH CHECK (retailer_id = auth.uid());

CREATE POLICY "Admins can manage announcement popup state"
  ON announcement_popup_views FOR ALL
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
