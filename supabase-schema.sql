-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create a sequence for account numbers (starts at 1000)
CREATE SEQUENCE IF NOT EXISTS retailer_account_seq START 1000;

-- 2. Retailers table (Updated to match website and automation)
CREATE TABLE IF NOT EXISTS retailers (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL, -- Changed from business_name to match code
  business_address TEXT NOT NULL,
  phone TEXT NOT NULL,
  -- Automatically generates BNP-1000, BNP-1001, etc.
  account_number TEXT UNIQUE DEFAULT ('BNP-' || nextval('retailer_account_seq')::text),
  invoice_url TEXT,
  invoice_sent_at TIMESTAMPTZ,
  invoice_sent_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', -- Added for approval flow
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- Orders table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT UNIQUE NOT NULL,
  retailer_id UUID REFERENCES retailers(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  delivery_date DATE,
  promotion_code TEXT,
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

-- Enable Row Level Security
ALTER TABLE retailers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

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
