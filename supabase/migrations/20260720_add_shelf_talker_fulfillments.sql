CREATE TABLE IF NOT EXISTS shelf_talker_fulfillments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id UUID NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  location_id UUID REFERENCES retailer_locations(id) ON DELETE SET NULL,
  flavor TEXT NOT NULL
    CHECK (flavor IN ('chicken', 'salmon', 'beef')),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'skipped')),
  fulfilled_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  qualified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fulfilled_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shelf_talker_fulfillments_retailer_flavor_null_location
  ON shelf_talker_fulfillments(retailer_id, flavor)
  WHERE location_id IS NULL AND status IN ('queued', 'sent');

CREATE UNIQUE INDEX IF NOT EXISTS idx_shelf_talker_fulfillments_location_flavor
  ON shelf_talker_fulfillments(location_id, flavor)
  WHERE location_id IS NOT NULL AND status IN ('queued', 'sent');

CREATE INDEX IF NOT EXISTS idx_shelf_talker_fulfillments_retailer_status
  ON shelf_talker_fulfillments(retailer_id, status);

CREATE INDEX IF NOT EXISTS idx_shelf_talker_fulfillments_order
  ON shelf_talker_fulfillments(fulfilled_order_id);

ALTER TABLE shelf_talker_fulfillments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Retailers can view their own shelf talker fulfillments"
  ON shelf_talker_fulfillments FOR SELECT
  USING (auth.uid() = retailer_id);

CREATE POLICY "Admins can manage shelf talker fulfillments"
  ON shelf_talker_fulfillments FOR ALL
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
