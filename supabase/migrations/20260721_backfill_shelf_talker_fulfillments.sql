WITH matched_items AS (
  SELECT
    orders.id AS order_id,
    orders.retailer_id,
    orders.location_id,
    orders.status,
    orders.created_at,
    CASE
      WHEN LOWER(products.name) LIKE '%chicken%' THEN 'chicken'
      WHEN LOWER(products.name) LIKE '%salmon%' THEN 'salmon'
      WHEN LOWER(products.name) LIKE '%beef%' THEN 'beef'
      ELSE NULL
    END AS flavor,
    CASE
      WHEN REGEXP_REPLACE(LOWER(COALESCE(products.size, '')), '\s+', '', 'g') LIKE '6%' THEN '6'
      WHEN REGEXP_REPLACE(LOWER(COALESCE(products.size, '')), '\s+', '', 'g') LIKE '12%' THEN '12'
      ELSE NULL
    END AS size_bucket
  FROM order_items
  JOIN orders ON orders.id = order_items.order_id
  JOIN products ON products.id = order_items.product_id
  WHERE orders.status <> 'canceled'
),
qualified_flavors AS (
  SELECT
    retailer_id,
    location_id,
    flavor,
    MIN(created_at) AS qualified_at
  FROM matched_items
  WHERE flavor IS NOT NULL
    AND size_bucket IS NOT NULL
  GROUP BY retailer_id, location_id, flavor
  HAVING COUNT(DISTINCT size_bucket) = 2
),
candidate_orders AS (
  SELECT
    qualified_flavors.*,
    orders.id AS candidate_order_id,
    orders.status AS candidate_order_status,
    ROW_NUMBER() OVER (
      PARTITION BY qualified_flavors.retailer_id, qualified_flavors.location_id, qualified_flavors.flavor
      ORDER BY
        CASE WHEN orders.status IN ('pending', 'processing') THEN 0 ELSE 1 END,
        orders.created_at DESC
    ) AS row_number
  FROM qualified_flavors
  JOIN orders
    ON orders.retailer_id = qualified_flavors.retailer_id
   AND orders.status <> 'canceled'
   AND (
      (qualified_flavors.location_id IS NULL AND orders.location_id IS NULL)
      OR (
        qualified_flavors.location_id IS NOT NULL
        AND (orders.location_id = qualified_flavors.location_id OR orders.location_id IS NULL)
      )
   )
)
INSERT INTO shelf_talker_fulfillments (
  retailer_id,
  location_id,
  flavor,
  status,
  fulfilled_order_id,
  qualified_at,
  notes
)
SELECT
  candidate_orders.retailer_id,
  candidate_orders.location_id,
  candidate_orders.flavor,
  'queued',
  CASE
    WHEN candidate_orders.candidate_order_status IN ('pending', 'processing')
      THEN candidate_orders.candidate_order_id
    ELSE NULL
  END,
  candidate_orders.qualified_at,
  'Backfilled from historical orders carrying both 6 oz and 12 oz.'
FROM candidate_orders
WHERE candidate_orders.row_number = 1
  AND NOT EXISTS (
    SELECT 1
    FROM shelf_talker_fulfillments existing
    WHERE existing.retailer_id = candidate_orders.retailer_id
      AND existing.flavor = candidate_orders.flavor
      AND existing.status IN ('queued', 'sent')
      AND (
        (existing.location_id IS NULL AND candidate_orders.location_id IS NULL)
        OR existing.location_id = candidate_orders.location_id
      )
  );
