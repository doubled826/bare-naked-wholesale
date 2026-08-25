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

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS include_marketing_materials BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_materials_type TEXT
    CHECK (marketing_materials_type IS NULL OR marketing_materials_type IN ('shelf_talker', 'table_tent', 'both'));

CREATE INDEX IF NOT EXISTS idx_marketing_material_requests_retailer_status
  ON marketing_material_requests(retailer_id, status);

ALTER TABLE marketing_material_requests ENABLE ROW LEVEL SECURITY;

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
