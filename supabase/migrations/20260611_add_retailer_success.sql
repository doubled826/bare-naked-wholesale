CREATE TABLE IF NOT EXISTS retailer_success_profiles (
  retailer_id UUID PRIMARY KEY REFERENCES retailers(id) ON DELETE CASCADE,
  samples_acknowledged BOOLEAN NOT NULL DEFAULT false,
  astro_enrolled BOOLEAN NOT NULL DEFAULT false,
  marketing_materials_status TEXT NOT NULL DEFAULT 'not_requested'
    CHECK (marketing_materials_status IN ('not_requested', 'have_materials', 'requested', 'sent')),
  shelf_placement_status TEXT NOT NULL DEFAULT 'not_set'
    CHECK (shelf_placement_status IN ('not_set', 'front_counter', 'end_cap', 'kibble_aisle', 'raw_freeze_dried_section', 'other')),
  shelf_placement_note TEXT NOT NULL DEFAULT '',
  current_promo_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (current_promo_status IN ('not_started', 'opted_in', 'not_this_time')),
  success_plan_last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS retailer_success_promo_settings (
  id TEXT PRIMARY KEY DEFAULT 'current',
  promo_visible BOOLEAN NOT NULL DEFAULT false,
  promo_name TEXT NOT NULL DEFAULT '',
  promo_description TEXT NOT NULL DEFAULT '',
  promo_start_date DATE,
  promo_end_date DATE,
  astro_promo_url TEXT NOT NULL DEFAULT 'https://www.astroloyalty.com/',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT one_current_retailer_success_promo CHECK (id = 'current')
);

INSERT INTO retailer_success_promo_settings (id)
VALUES ('current')
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_retailer_success_profiles_updated_at
  ON retailer_success_profiles(updated_at DESC);

ALTER TABLE retailer_success_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE retailer_success_promo_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Retailers can view their success profile"
  ON retailer_success_profiles FOR SELECT
  USING (auth.uid() = retailer_id);

CREATE POLICY "Retailers can update their success profile"
  ON retailer_success_profiles FOR UPDATE
  USING (auth.uid() = retailer_id)
  WITH CHECK (auth.uid() = retailer_id);

CREATE POLICY "Retailers can create their success profile"
  ON retailer_success_profiles FOR INSERT
  WITH CHECK (auth.uid() = retailer_id);

CREATE POLICY "Admins can manage retailer success profiles"
  ON retailer_success_profiles FOR ALL
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

CREATE POLICY "Authenticated users can view current success promo"
  ON retailer_success_promo_settings FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage current success promo"
  ON retailer_success_promo_settings FOR ALL
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
