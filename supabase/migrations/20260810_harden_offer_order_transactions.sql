ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS promotion_discount_applied DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (promotion_discount_applied >= 0),
  ADD COLUMN IF NOT EXISTS order_submission_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_retailer_submission_key
  ON orders(retailer_id, order_submission_key)
  WHERE order_submission_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_benefit_redemptions_order
  ON benefit_redemptions(order_id);

CREATE OR REPLACE FUNCTION create_order_with_promotions(
  p_order JSONB,
  p_items JSONB,
  p_discount_redemptions JSONB DEFAULT '[]'::JSONB,
  p_benefit_redemptions JSONB DEFAULT '[]'::JSONB,
  p_apply_account_credit BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_existing_order orders%ROWTYPE;
  v_retailer_id UUID := (p_order->>'retailer_id')::UUID;
  v_order_number TEXT := p_order->>'order_number';
  v_submission_key TEXT := NULLIF(p_order->>'order_submission_key', '');
  v_subtotal NUMERIC := COALESCE((p_order->>'subtotal')::NUMERIC, 0);
  v_promotion_discount NUMERIC := LEAST(v_subtotal, GREATEST(0, COALESCE((p_order->>'promotion_discount_applied')::NUMERIC, 0)));
  v_credit_limit NUMERIC := GREATEST(0, v_subtotal - v_promotion_discount);
  v_credit_applied NUMERIC := 0;
  v_credit_remaining NUMERIC;
  v_apply_amount NUMERIC;
  v_discount RECORD;
  v_credit RECORD;
BEGIN
  IF v_retailer_id IS NULL THEN
    RAISE EXCEPTION 'Missing retailer_id';
  END IF;

  IF v_order_number IS NULL OR length(v_order_number) = 0 THEN
    RAISE EXCEPTION 'Missing order_number';
  END IF;

  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order must include at least one item';
  END IF;

  IF v_submission_key IS NOT NULL THEN
    SELECT *
    INTO v_existing_order
    FROM orders
    WHERE retailer_id = v_retailer_id
      AND order_submission_key = v_submission_key
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'duplicate', true,
        'order_id', v_existing_order.id,
        'order_number', v_existing_order.order_number,
        'subtotal', v_existing_order.subtotal,
        'promotion_discount_applied', v_existing_order.promotion_discount_applied,
        'credit_applied', v_existing_order.credit_applied,
        'total', v_existing_order.total
      );
    END IF;
  END IF;

  FOR v_discount IN
    SELECT dc.*
    FROM discount_codes dc
    WHERE dc.id IN (
      SELECT DISTINCT (row->>'discount_code_id')::UUID
      FROM jsonb_array_elements(p_discount_redemptions) row
      WHERE row->>'discount_code_id' IS NOT NULL
    )
    FOR UPDATE OF dc
  LOOP
    IF v_discount.max_redemptions IS NOT NULL AND (
      SELECT COUNT(*)
      FROM discount_redemptions
      WHERE discount_code_id = v_discount.id
    ) >= v_discount.max_redemptions THEN
      RAISE EXCEPTION 'Discount redemption limit reached';
    END IF;

    IF v_discount.max_redemptions_per_retailer IS NOT NULL AND (
      SELECT COUNT(*)
      FROM discount_redemptions
      WHERE discount_code_id = v_discount.id
        AND retailer_id = v_retailer_id
    ) >= v_discount.max_redemptions_per_retailer THEN
      RAISE EXCEPTION 'Retailer discount redemption limit reached';
    END IF;
  END LOOP;

  BEGIN
    INSERT INTO orders (
      order_number,
      retailer_id,
      location_id,
      status,
      delivery_date,
      promotion_code,
      subtotal,
      promotion_discount_applied,
      credit_applied,
      total,
      include_samples,
      include_marketing_materials,
      marketing_materials_type,
      order_submission_key
    )
    VALUES (
      v_order_number,
      v_retailer_id,
      NULLIF(p_order->>'location_id', '')::UUID,
      COALESCE(NULLIF(p_order->>'status', ''), 'pending'),
      NULLIF(p_order->>'delivery_date', '')::DATE,
      NULLIF(p_order->>'promotion_code', ''),
      v_subtotal,
      v_promotion_discount,
      0,
      GREATEST(0, v_subtotal - v_promotion_discount),
      COALESCE((p_order->>'include_samples')::BOOLEAN, false),
      COALESCE((p_order->>'include_marketing_materials')::BOOLEAN, false),
      NULLIF(p_order->>'marketing_materials_type', ''),
      v_submission_key
    )
    RETURNING * INTO v_order;
  EXCEPTION WHEN unique_violation THEN
    IF v_submission_key IS NULL THEN
      RAISE;
    END IF;

    SELECT *
    INTO v_existing_order
    FROM orders
    WHERE retailer_id = v_retailer_id
      AND order_submission_key = v_submission_key
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE;
    END IF;

    RETURN jsonb_build_object(
      'duplicate', true,
      'order_id', v_existing_order.id,
      'order_number', v_existing_order.order_number,
      'subtotal', v_existing_order.subtotal,
      'promotion_discount_applied', v_existing_order.promotion_discount_applied,
      'credit_applied', v_existing_order.credit_applied,
      'total', v_existing_order.total
    );
  END;

  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price)
  SELECT
    v_order.id,
    (item->>'product_id')::UUID,
    GREATEST(1, COALESCE((item->>'quantity')::INTEGER, 1)),
    GREATEST(0, COALESCE((item->>'unit_price')::NUMERIC, 0)),
    GREATEST(0, COALESCE((item->>'total_price')::NUMERIC, 0))
  FROM jsonb_array_elements(p_items) item;

  INSERT INTO discount_redemptions (discount_code_id, retailer_id, order_id, discount_amount)
  SELECT
    (row->>'discount_code_id')::UUID,
    v_retailer_id,
    v_order.id,
    GREATEST(0, COALESCE((row->>'discount_amount')::NUMERIC, 0))
  FROM jsonb_array_elements(p_discount_redemptions) row;

  INSERT INTO benefit_redemptions (
    retailer_id,
    order_id,
    source_type,
    source_id,
    source_name,
    benefit_category,
    discount_type,
    discount_value,
    discount_amount
  )
  SELECT
    v_retailer_id,
    v_order.id,
    row->>'source_type',
    NULLIF(row->>'source_id', ''),
    row->>'source_name',
    row->>'benefit_category',
    row->>'discount_type',
    COALESCE((row->>'discount_value')::NUMERIC, 0),
    GREATEST(0, COALESCE((row->>'discount_amount')::NUMERIC, 0))
  FROM jsonb_array_elements(p_benefit_redemptions) row;

  IF p_apply_account_credit AND v_credit_limit > 0 THEN
    v_credit_remaining := v_credit_limit;

    FOR v_credit IN
      SELECT id, remaining_amount
      FROM retailer_credits
      WHERE retailer_id = v_retailer_id
        AND status IN ('available', 'partially_applied')
        AND remaining_amount > 0
      ORDER BY created_at ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_credit_remaining <= 0;

      v_apply_amount := LEAST(v_credit.remaining_amount, v_credit_remaining);
      CONTINUE WHEN v_apply_amount <= 0;

      INSERT INTO retailer_credit_applications (credit_id, order_id, applied_amount)
      VALUES (v_credit.id, v_order.id, v_apply_amount);

      UPDATE retailer_credits
      SET remaining_amount = GREATEST(0, remaining_amount - v_apply_amount)
      WHERE id = v_credit.id;

      v_credit_applied := v_credit_applied + v_apply_amount;
      v_credit_remaining := v_credit_remaining - v_apply_amount;
    END LOOP;
  END IF;

  UPDATE orders
  SET
    credit_applied = v_credit_applied,
    total = GREATEST(0, v_subtotal - v_promotion_discount - v_credit_applied)
  WHERE id = v_order.id
  RETURNING * INTO v_order;

  RETURN jsonb_build_object(
    'duplicate', false,
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'subtotal', v_order.subtotal,
    'promotion_discount_applied', v_order.promotion_discount_applied,
    'credit_applied', v_order.credit_applied,
    'total', v_order.total
  );
END;
$$;

REVOKE ALL ON FUNCTION create_order_with_promotions(JSONB, JSONB, JSONB, JSONB, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION create_order_with_promotions(JSONB, JSONB, JSONB, JSONB, BOOLEAN) FROM authenticated;
GRANT EXECUTE ON FUNCTION create_order_with_promotions(JSONB, JSONB, JSONB, JSONB, BOOLEAN) TO service_role;
