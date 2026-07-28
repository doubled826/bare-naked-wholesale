CREATE TABLE IF NOT EXISTS discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percent'
    CHECK (discount_type IN ('percent', 'fixed_amount')),
  discount_value DECIMAL(10,2) NOT NULL
    CHECK (discount_value > 0),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  eligibility TEXT NOT NULL DEFAULT 'all_retailers'
    CHECK (eligibility IN ('all_retailers', 'first_order', 'repeat_buyers', 'manual')),
  manual_retailer_ids UUID[] NOT NULL DEFAULT '{}',
  min_order_subtotal DECIMAL(10,2) NOT NULL DEFAULT 0
    CHECK (min_order_subtotal >= 0),
  max_redemptions INTEGER
    CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  max_redemptions_per_retailer INTEGER
    CHECK (max_redemptions_per_retailer IS NULL OR max_redemptions_per_retailer > 0),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (discount_type <> 'percent' OR discount_value <= 100),
  CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at <= ends_at)
);

CREATE TABLE IF NOT EXISTS discount_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_code_id UUID NOT NULL REFERENCES discount_codes(id) ON DELETE CASCADE,
  retailer_id UUID NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0
    CHECK (discount_amount >= 0),
  redeemed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (discount_code_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_discount_codes_status
  ON discount_codes(status, starts_at, ends_at);

CREATE INDEX IF NOT EXISTS idx_discount_redemptions_discount
  ON discount_redemptions(discount_code_id, redeemed_at DESC);

CREATE INDEX IF NOT EXISTS idx_discount_redemptions_retailer
  ON discount_redemptions(discount_code_id, retailer_id);

CREATE OR REPLACE FUNCTION update_discount_usage_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE discount_codes
    SET usage_count = usage_count + 1,
        updated_at = NOW()
    WHERE id = NEW.discount_code_id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    UPDATE discount_codes
    SET usage_count = GREATEST(usage_count - 1, 0),
        updated_at = NOW()
    WHERE id = OLD.discount_code_id;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS discount_redemption_usage_count ON discount_redemptions;
CREATE TRIGGER discount_redemption_usage_count
AFTER INSERT OR DELETE ON discount_redemptions
FOR EACH ROW EXECUTE FUNCTION update_discount_usage_count();

CREATE TRIGGER update_discount_codes_updated_at BEFORE UPDATE ON discount_codes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage discount codes"
  ON discount_codes FOR ALL
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

CREATE POLICY "Admins can manage discount redemptions"
  ON discount_redemptions FOR ALL
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
