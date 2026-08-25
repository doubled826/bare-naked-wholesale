WITH candidate_orders AS (
  SELECT
    fulfillments.id AS fulfillment_id,
    orders.id AS order_id,
    ROW_NUMBER() OVER (
      PARTITION BY fulfillments.id
      ORDER BY orders.created_at ASC
    ) AS row_number
  FROM shelf_talker_fulfillments fulfillments
  JOIN orders
    ON orders.retailer_id = fulfillments.retailer_id
   AND orders.status IN ('pending', 'processing')
   AND (
      (fulfillments.location_id IS NULL AND orders.location_id IS NULL)
      OR fulfillments.location_id = orders.location_id
   )
  WHERE fulfillments.status = 'queued'
    AND fulfillments.fulfilled_order_id IS NULL
)
UPDATE shelf_talker_fulfillments fulfillments
SET
  fulfilled_order_id = candidate_orders.order_id,
  updated_at = NOW(),
  notes = CONCAT_WS(
    ' ',
    NULLIF(fulfillments.notes, ''),
    'Attached to open order after shelf talker backfill.'
  )
FROM candidate_orders
WHERE candidate_orders.fulfillment_id = fulfillments.id
  AND candidate_orders.row_number = 1;
