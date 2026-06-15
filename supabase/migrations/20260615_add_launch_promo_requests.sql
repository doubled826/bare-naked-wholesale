ALTER TABLE retailer_success_profiles
  ADD COLUMN IF NOT EXISTS launch_promo_status TEXT NOT NULL DEFAULT 'not_requested';

ALTER TABLE retailer_success_profiles
  DROP CONSTRAINT IF EXISTS retailer_success_profiles_launch_promo_status_check;

ALTER TABLE retailer_success_profiles
  ADD CONSTRAINT retailer_success_profiles_launch_promo_status_check
  CHECK (launch_promo_status IN ('not_requested', 'requested'));

CREATE TABLE IF NOT EXISTS launch_promo_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  retailer_id UUID REFERENCES retailers(id) ON DELETE CASCADE,
  promo_discount_percent INTEGER NOT NULL DEFAULT 10,
  duration_weeks INTEGER NOT NULL CHECK (duration_weeks IN (2, 3, 4)),
  start_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'completed', 'canceled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_launch_promo_requests_retailer_status
  ON launch_promo_requests(retailer_id, status);

ALTER TABLE launch_promo_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Retailers can view their launch promo requests"
  ON launch_promo_requests FOR SELECT
  USING (auth.uid() = retailer_id);

CREATE POLICY "Retailers can create their launch promo requests"
  ON launch_promo_requests FOR INSERT
  WITH CHECK (auth.uid() = retailer_id);

CREATE POLICY "Retailers can update their launch promo requests"
  ON launch_promo_requests FOR UPDATE
  USING (auth.uid() = retailer_id)
  WITH CHECK (auth.uid() = retailer_id);

CREATE POLICY "Admins can manage launch promo requests"
  ON launch_promo_requests FOR ALL
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
