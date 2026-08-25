-- Retailer credits for future orders
-- Run this in the Supabase SQL editor before shipping the app changes.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS credit_applied DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (credit_applied >= 0);

CREATE TABLE IF NOT EXISTS retailer_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id UUID NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'partially_applied', 'fully_applied', 'voided')),
  total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
  remaining_amount DECIMAL(10,2) NOT NULL CHECK (remaining_amount >= 0 AND remaining_amount <= total_amount),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  voided_at TIMESTAMPTZ,
  voided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS retailer_credit_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_id UUID NOT NULL REFERENCES retailer_credits(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_size TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
  total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS retailer_credit_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_id UUID NOT NULL REFERENCES retailer_credits(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  applied_amount DECIMAL(10,2) NOT NULL CHECK (applied_amount > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (credit_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_retailer_credits_retailer_id ON retailer_credits(retailer_id);
CREATE INDEX IF NOT EXISTS idx_retailer_credits_status ON retailer_credits(status);
CREATE INDEX IF NOT EXISTS idx_retailer_credits_available ON retailer_credits(retailer_id, created_at) WHERE remaining_amount > 0 AND status IN ('available', 'partially_applied');
CREATE INDEX IF NOT EXISTS idx_retailer_credit_items_credit_id ON retailer_credit_items(credit_id);
CREATE INDEX IF NOT EXISTS idx_retailer_credit_applications_credit_id ON retailer_credit_applications(credit_id);
CREATE INDEX IF NOT EXISTS idx_retailer_credit_applications_order_id ON retailer_credit_applications(order_id);

ALTER TABLE retailer_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE retailer_credit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE retailer_credit_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Retailers can view their own credits"
  ON retailer_credits FOR SELECT
  USING (auth.uid() = retailer_id);

CREATE POLICY "Admins can manage retailer credits"
  ON retailer_credits FOR ALL
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

CREATE POLICY "Retailers can view their own credit items"
  ON retailer_credit_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM retailer_credits
      WHERE retailer_credits.id = retailer_credit_items.credit_id
        AND retailer_credits.retailer_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage retailer credit items"
  ON retailer_credit_items FOR ALL
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

CREATE POLICY "Retailers can view their own credit applications"
  ON retailer_credit_applications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = retailer_credit_applications.order_id
        AND orders.retailer_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage retailer credit applications"
  ON retailer_credit_applications FOR ALL
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

CREATE OR REPLACE FUNCTION sync_retailer_credit_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'voided' THEN
    RETURN NEW;
  END IF;

  IF NEW.remaining_amount <= 0 THEN
    NEW.status = 'fully_applied';
  ELSIF NEW.remaining_amount < NEW.total_amount THEN
    NEW.status = 'partially_applied';
  ELSE
    NEW.status = 'available';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_retailer_credit_status_before_write ON retailer_credits;
CREATE TRIGGER sync_retailer_credit_status_before_write
  BEFORE INSERT OR UPDATE ON retailer_credits
  FOR EACH ROW EXECUTE FUNCTION sync_retailer_credit_status();

DROP TRIGGER IF EXISTS update_retailer_credits_updated_at ON retailer_credits;
CREATE TRIGGER update_retailer_credits_updated_at
  BEFORE UPDATE ON retailer_credits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
