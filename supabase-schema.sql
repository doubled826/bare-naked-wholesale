-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Create a sequence for account numbers (starts at 1000)
CREATE SEQUENCE IF NOT EXISTS retailer_account_seq START 1000;

-- 2. Retailers table (Updated to match website and automation)
CREATE TABLE IF NOT EXISTS retailers (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL, -- Changed from business_name to match code
  business_address TEXT NOT NULL,
  phone TEXT NOT NULL,
  logo_url TEXT,
  -- Automatically generates BNP-1000, BNP-1001, etc.
  account_number TEXT UNIQUE DEFAULT ('BNP-' || nextval('retailer_account_seq')::text),
  status TEXT DEFAULT 'pending', -- Added for approval flow
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE retailers
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Products table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  size TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  image_url TEXT,
  category TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Announcements table
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Resources table (training & marketing assets)
CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  file_size INTEGER,
  preview_url TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sample requests table
CREATE TABLE IF NOT EXISTS sample_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  retailer_id UUID REFERENCES retailers(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  fulfilled_order_id UUID REFERENCES orders(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  fulfilled_at TIMESTAMPTZ
);

-- Marketing material requests table
CREATE TABLE IF NOT EXISTS marketing_material_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  retailer_id UUID REFERENCES retailers(id) ON DELETE CASCADE,
  materials_type TEXT NOT NULL DEFAULT 'both'
    CHECK (materials_type IN ('shelf_talker', 'table_tent', 'both')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'fulfilled', 'canceled')),
  fulfilled_order_id UUID REFERENCES orders(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  fulfilled_at TIMESTAMPTZ
);

-- Retail success adoption profile
CREATE TABLE IF NOT EXISTS retailer_success_profiles (
  retailer_id UUID PRIMARY KEY REFERENCES retailers(id) ON DELETE CASCADE,
  samples_acknowledged BOOLEAN NOT NULL DEFAULT false,
  astro_enrolled BOOLEAN NOT NULL DEFAULT false,
  marketing_materials_status TEXT NOT NULL DEFAULT 'not_requested'
    CHECK (marketing_materials_status IN ('not_requested', 'have_materials', 'requested', 'sent')),
  launch_promo_status TEXT NOT NULL DEFAULT 'not_requested'
    CHECK (launch_promo_status IN ('not_requested', 'requested')),
  shelf_placement_status TEXT NOT NULL DEFAULT 'not_set'
    CHECK (shelf_placement_status IN ('not_set', 'front_counter', 'end_cap', 'kibble_aisle', 'raw_freeze_dried_section', 'other')),
  shelf_placement_note TEXT NOT NULL DEFAULT '',
  current_promo_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (current_promo_status IN ('not_started', 'opted_in', 'not_this_time')),
  success_plan_last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Single current Astro promo setting for V1
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

CREATE TABLE IF NOT EXISTS bare_launch_offer_email_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id UUID NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL
    CHECK (template_key IN (
      'bare_launch_offer_day_1',
      'bare_launch_offer_day_4',
      'bare_launch_offer_day_9',
      'bare_launch_offer_final'
    )),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resend_message_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (retailer_id, template_key)
);

CREATE INDEX IF NOT EXISTS idx_bare_launch_offer_email_reminders_retailer
  ON bare_launch_offer_email_reminders(retailer_id, sent_at);

-- Launch promo requests table
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

-- Retailer locations table
CREATE TABLE IF NOT EXISTS retailer_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id UUID REFERENCES retailers(id) ON DELETE CASCADE,
  location_name TEXT NOT NULL,
  business_address TEXT NOT NULL,
  phone TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT UNIQUE NOT NULL,
  retailer_id UUID REFERENCES retailers(id) ON DELETE CASCADE,
  location_id UUID REFERENCES retailer_locations(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending',
  delivery_date DATE,
  promotion_code TEXT,
  include_samples BOOLEAN DEFAULT false,
  include_marketing_materials BOOLEAN DEFAULT false,
  marketing_materials_type TEXT
    CHECK (marketing_materials_type IS NULL OR marketing_materials_type IN ('shelf_talker', 'table_tent', 'both')),
  invoice_url TEXT,
  invoice_sent_at TIMESTAMPTZ,
  invoice_sent_count INTEGER DEFAULT 0,
  tracking_carrier TEXT,
  subtotal DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order items table
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_orders_retailer_id ON orders(retailer_id);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_retailer_locations_retailer_id ON retailer_locations(retailer_id);
CREATE INDEX idx_marketing_material_requests_retailer_status ON marketing_material_requests(retailer_id, status);
CREATE INDEX idx_launch_promo_requests_retailer_status ON launch_promo_requests(retailer_id, status);

-- Enable Row Level Security
ALTER TABLE retailers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE sample_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_material_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE launch_promo_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE retailer_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE retailer_success_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE retailer_success_promo_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE first_order_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE bare_launch_offer_email_reminders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for retailers
CREATE POLICY "Users can view their own retailer profile"
  ON retailers FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own retailer profile"
  ON retailers FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for orders
CREATE POLICY "Users can view their own orders"
  ON orders FOR SELECT
  USING (auth.uid() = retailer_id);

CREATE POLICY "Users can create their own orders"
  ON orders FOR INSERT
  WITH CHECK (auth.uid() = retailer_id);

-- RLS Policies for retailer_locations
CREATE POLICY "Retailers can view their own locations"
  ON retailer_locations FOR SELECT
  USING (auth.uid() = retailer_id);

CREATE POLICY "Retailers can create their own locations"
  ON retailer_locations FOR INSERT
  WITH CHECK (auth.uid() = retailer_id);

CREATE POLICY "Retailers can update their own locations"
  ON retailer_locations FOR UPDATE
  USING (auth.uid() = retailer_id);

CREATE POLICY "Retailers can delete their own locations"
  ON retailer_locations FOR DELETE
  USING (auth.uid() = retailer_id);

CREATE POLICY "Admins can manage retailer locations"
  ON retailer_locations FOR ALL
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

CREATE POLICY "Users can view their own sample requests"
  ON sample_requests FOR SELECT
  USING (auth.uid() = retailer_id);

CREATE POLICY "Users can create their own sample requests"
  ON sample_requests FOR INSERT
  WITH CHECK (auth.uid() = retailer_id);

CREATE POLICY "Admins can manage sample requests"
  ON sample_requests FOR ALL
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

CREATE POLICY "Retailers can view their marketing material requests"
  ON marketing_material_requests FOR SELECT
  USING (auth.uid() = retailer_id);

CREATE POLICY "Retailers can create their marketing material requests"
  ON marketing_material_requests FOR INSERT
  WITH CHECK (auth.uid() = retailer_id);

CREATE POLICY "Retailers can update their marketing material requests"
  ON marketing_material_requests FOR UPDATE
  USING (auth.uid() = retailer_id)
  WITH CHECK (auth.uid() = retailer_id);

CREATE POLICY "Admins can manage marketing material requests"
  ON marketing_material_requests FOR ALL
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

-- RLS Policies for retailer success profiles
CREATE POLICY "Retailers can view their success profile"
  ON retailer_success_profiles FOR SELECT
  USING (auth.uid() = retailer_id);

CREATE POLICY "Retailers can create their success profile"
  ON retailer_success_profiles FOR INSERT
  WITH CHECK (auth.uid() = retailer_id);

CREATE POLICY "Retailers can update their success profile"
  ON retailer_success_profiles FOR UPDATE
  USING (auth.uid() = retailer_id)
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

-- RLS Policies for current success promo
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

CREATE POLICY "Admins can manage Bare Launch Offer email reminders"
  ON bare_launch_offer_email_reminders FOR ALL
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

-- RLS Policies for order_items
CREATE POLICY "Users can view items from their own orders"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.retailer_id = auth.uid()
    )
  );

CREATE POLICY "Users can create items for their own orders"
  ON order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.retailer_id = auth.uid()
    )
  );

-- RLS Policy for products (public read)
CREATE POLICY "Anyone can view products"
  ON products FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for announcements
CREATE POLICY "Retailers can view active announcements"
  ON announcements FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage announcements"
  ON announcements FOR ALL
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

-- RLS Policies for resources
CREATE POLICY "Retailers can view active resources"
  ON resources FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage resources"
  ON resources FOR ALL
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

-- Onboarding health tables
CREATE TABLE IF NOT EXISTS retailer_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id UUID UNIQUE REFERENCES retailers(id) ON DELETE CASCADE,
  pipedrive_deal_id BIGINT UNIQUE,
  pipedrive_stage_name TEXT,
  first_order_received_at TIMESTAMPTZ,
  second_order_received_at TIMESTAMPTZ,
  third_order_received_at TIMESTAMPTZ,
  next_follow_up_at TIMESTAMPTZ,
  follow_up_status TEXT DEFAULT 'upcoming',
  owner_name TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS retailer_onboarding_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_id UUID NOT NULL REFERENCES retailer_onboarding(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  agreed_value TEXT,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (onboarding_id, item_id)
);

CREATE TABLE IF NOT EXISTS retailer_onboarding_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_id UUID NOT NULL REFERENCES retailer_onboarding(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  source TEXT DEFAULT 'portal',
  pipedrive_note_id BIGINT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_retailer_onboarding_retailer_id ON retailer_onboarding(retailer_id);
CREATE INDEX IF NOT EXISTS idx_retailer_onboarding_follow_up ON retailer_onboarding(next_follow_up_at);
CREATE INDEX IF NOT EXISTS idx_retailer_onboarding_checklist_onboarding_id ON retailer_onboarding_checklist_items(onboarding_id);
CREATE INDEX IF NOT EXISTS idx_retailer_onboarding_notes_onboarding_id ON retailer_onboarding_notes(onboarding_id);

ALTER TABLE retailer_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE retailer_onboarding_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE retailer_onboarding_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage retailer onboarding"
  ON retailer_onboarding FOR ALL
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

CREATE POLICY "Admins can manage onboarding checklist items"
  ON retailer_onboarding_checklist_items FOR ALL
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

CREATE POLICY "Admins can manage onboarding notes"
  ON retailer_onboarding_notes FOR ALL
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

-- Function to generate order numbers
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'ORD-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_retailers_updated_at BEFORE UPDATE ON retailers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON announcements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_resources_updated_at BEFORE UPDATE ON resources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Ensure existing orders can add location_id column when migrating
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES retailer_locations(id) ON DELETE SET NULL;

-- Ensure existing orders can track applied retailer credits
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS credit_applied DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (credit_applied >= 0);

-- Retailer credits
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
CREATE TRIGGER update_retailer_credits_updated_at BEFORE UPDATE ON retailer_credits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert initial products
INSERT INTO products (name, size, price, image_url, category, description) VALUES
  ('Chicken Meal Mixer', '6 oz', 16.67, 'https://cdn.shopify.com/s/files/1/0637/4401/6534/files/Bare-Naked-Meal-Mixer-Chicken-FREEZE-DRIED-RAW-6OZ-FRONT_1.png', 'Toppers', 'Freeze-dried raw chicken topper'),
  ('Chicken Meal Mixer', '12 oz', 30.00, 'https://cdn.shopify.com/s/files/1/0637/4401/6534/files/Bare-Naked-Meal-Mixer-Chicken-FREEZE-DRIED-RAW-6OZ-FRONT_1.png', 'Toppers', 'Freeze-dried raw chicken topper'),
  ('Salmon Meal Mixer', '6 oz', 16.67, 'https://cdn.shopify.com/s/files/1/0637/4401/6534/files/Bare-Naked-Meal-Mixer-Salmon-FREEZE-DRIED-RAW-6OZ-FRONT_1.png', 'Toppers', 'Freeze-dried raw salmon topper'),
  ('Salmon Meal Mixer', '12 oz', 30.00, 'https://cdn.shopify.com/s/files/1/0637/4401/6534/files/Bare-Naked-Meal-Mixer-Salmon-FREEZE-DRIED-RAW-6OZ-FRONT_1.png', 'Toppers', 'Freeze-dried raw salmon topper'),
  ('Beef Meal Mixer', '6 oz', 16.67, 'https://cdn.shopify.com/s/files/1/0637/4401/6534/files/Beef-TrailMix-6OZ.png', 'Toppers', 'Freeze-dried raw beef topper'),
  ('Beef Meal Mixer', '12 oz', 30.00, 'https://cdn.shopify.com/s/files/1/0637/4401/6534/files/Beef-TrailMix-6OZ.png', 'Toppers', 'Freeze-dried raw beef topper'),
  ('Lamb Treats', '3 oz', 12.00, 'https://cdn.shopify.com/s/files/1/0637/4401/6534/files/Lamb.png', 'Treats', 'Premium freeze-dried lamb'),
  ('Minnow Treats', '1.5 oz', 12.00, 'https://cdn.shopify.com/s/files/1/0637/4401/6534/files/Minnows.png', 'Treats', 'Whole freeze-dried minnows'),
  ('Bison Treats', '3 oz', 12.00, 'https://cdn.shopify.com/s/files/1/0637/4401/6534/files/Bison-V2.png', 'Treats', 'Premium freeze-dried bison');

-- ==========================================
-- SIGNUP AUTOMATION (The Handshake)
-- ==========================================

-- 1. Setup the Auto-Account Number Sequence
CREATE SEQUENCE IF NOT EXISTS retailer_account_seq START 1000;

-- 2. Ensure the table column uses the sequence by default
ALTER TABLE public.retailers 
ALTER COLUMN account_number SET DEFAULT ('BNP-' || nextval('retailer_account_seq')::text);

-- 3. The Function: Logic to move metadata into the retailers table
CREATE OR REPLACE FUNCTION public.handle_new_retailer()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.retailers (id, company_name, business_address, phone, status)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'company_name', 'New Retailer'),
    COALESCE(new.raw_user_meta_data->>'business_address', 'No Address Provided'),
    COALESCE(new.raw_user_meta_data->>'phone', 'No Phone Provided'),
    'pending'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. The Trigger: Fires every time a new user signs up in Supabase Auth
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_retailer();

-- Conversations (retailer <-> admin)
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  retailer_id UUID UNIQUE REFERENCES retailers(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  last_sender_role TEXT,
  last_read_by_retailer_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('retailer', 'admin')),
  sender_id UUID NOT NULL,
  sender_name TEXT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Community feed posts
CREATE TABLE IF NOT EXISTS feed_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id UUID REFERENCES retailers(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_avatar_url TEXT,
  is_admin BOOLEAN DEFAULT false,
  body TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE feed_posts
  ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE feed_posts
  ADD COLUMN IF NOT EXISTS author_avatar_url TEXT;

-- Community feed comments
CREATE TABLE IF NOT EXISTS feed_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES feed_posts(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES feed_comments(id) ON DELETE CASCADE,
  retailer_id UUID REFERENCES retailers(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  author_avatar_url TEXT,
  is_admin BOOLEAN DEFAULT false,
  body TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE feed_comments
  ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE feed_comments
  ADD COLUMN IF NOT EXISTS parent_comment_id UUID REFERENCES feed_comments(id) ON DELETE CASCADE;
ALTER TABLE feed_comments
  ADD COLUMN IF NOT EXISTS author_avatar_url TEXT;

ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Feed likes
CREATE TABLE IF NOT EXISTS feed_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment')),
  target_id UUID NOT NULL,
  user_id UUID NOT NULL,
  retailer_id UUID REFERENCES retailers(id) ON DELETE SET NULL,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (target_type, target_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_feed_likes_target ON feed_likes(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_feed_likes_user_id ON feed_likes(user_id);

CREATE INDEX IF NOT EXISTS idx_conversations_retailer_id ON conversations(retailer_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_posts_created_at ON feed_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_comments_post_id ON feed_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_feed_comments_parent_id ON feed_comments(parent_comment_id);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_likes ENABLE ROW LEVEL SECURITY;

-- Feed read receipts (retailer unread indicator)
CREATE TABLE IF NOT EXISTS feed_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id UUID UNIQUE REFERENCES retailers(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE feed_reads ENABLE ROW LEVEL SECURITY;

-- Retailer conversation access
CREATE POLICY "Retailers can view their conversation"
  ON conversations FOR SELECT
  USING (auth.uid() = retailer_id);

CREATE POLICY "Retailers can create their conversation"
  ON conversations FOR INSERT
  WITH CHECK (auth.uid() = retailer_id);

CREATE POLICY "Retailers can update their conversation"
  ON conversations FOR UPDATE
  USING (auth.uid() = retailer_id);

-- Admin conversation access
CREATE POLICY "Admins can view conversations"
  ON conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

CREATE POLICY "Admins can update conversations"
  ON conversations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

-- Retailer message access
CREATE POLICY "Retailers can view their messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.retailer_id = auth.uid()
    )
  );

CREATE POLICY "Retailers can create their messages"
  ON messages FOR INSERT
  WITH CHECK (
    sender_role = 'retailer'
    AND sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.retailer_id = auth.uid()
    )
  );

-- Admin message access
CREATE POLICY "Admins can view messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

CREATE POLICY "Admins can create messages"
  ON messages FOR INSERT
  WITH CHECK (
    sender_role = 'admin'
    AND sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

CREATE POLICY "Retailers can delete their messages"
  ON messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.retailer_id = auth.uid()
    )
  );

-- Community feed access (retailers)
CREATE POLICY "Retailers can view all feed posts"
  ON feed_posts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Retailers can create their own feed posts"
  ON feed_posts FOR INSERT
  WITH CHECK (auth.uid() = retailer_id);

CREATE POLICY "Retailers can view all feed comments"
  ON feed_comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Retailers can create their own feed comments"
  ON feed_comments FOR INSERT
  WITH CHECK (auth.uid() = retailer_id);

-- Community feed access (admins)
CREATE POLICY "Admins can manage feed posts"
  ON feed_posts FOR ALL
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

CREATE POLICY "Admins can manage feed comments"
  ON feed_comments FOR ALL
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

-- Feed likes access (retailers)
CREATE POLICY "Retailers can view all feed likes"
  ON feed_likes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Retailers can like as themselves"
  ON feed_likes FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND retailer_id = auth.uid()
    AND is_admin = false
  );

CREATE POLICY "Retailers can remove their own likes"
  ON feed_likes FOR DELETE
  USING (user_id = auth.uid());

-- Feed likes access (admins)
CREATE POLICY "Admins can manage feed likes"
  ON feed_likes FOR ALL
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

-- Feed read access (retailers)
CREATE POLICY "Retailers can view their feed read state"
  ON feed_reads FOR SELECT
  USING (auth.uid() = retailer_id);

CREATE POLICY "Retailers can create their feed read state"
  ON feed_reads FOR INSERT
  WITH CHECK (auth.uid() = retailer_id);

CREATE POLICY "Retailers can update their feed read state"
  ON feed_reads FOR UPDATE
  USING (auth.uid() = retailer_id);

-- Feed read access (admins)
CREATE POLICY "Admins can manage feed reads"
  ON feed_reads FOR ALL
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

-- RPC: Top retailers by revenue (for feed badges)
CREATE OR REPLACE FUNCTION public.get_top_retailers_by_revenue(limit_count integer DEFAULT 10)
RETURNS TABLE(retailer_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT orders.retailer_id
  FROM orders
  WHERE orders.retailer_id IS NOT NULL
    AND orders.status IS DISTINCT FROM 'canceled'
  GROUP BY orders.retailer_id
  ORDER BY SUM(COALESCE(orders.total, 0)) DESC
  LIMIT limit_count;
$$;

GRANT EXECUTE ON FUNCTION public.get_top_retailers_by_revenue(integer) TO authenticated;

-- Storage bucket for feed images
INSERT INTO storage.buckets (id, name, public)
VALUES ('feed-media', 'feed-media', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-media', 'profile-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for feed media
DO $$
BEGIN
  CREATE POLICY "Feed media is public"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'feed-media');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE POLICY "Authenticated can upload feed media"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'feed-media');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE POLICY "Profile media is public"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'profile-media');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE POLICY "Authenticated can upload profile media"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'profile-media');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
