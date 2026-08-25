import type { OfferCandidate } from './offerResolver';

export type TransactionOrderItem = {
  productId: string;
  quantity: number;
  unitPrice: number;
};

export type TransactionOrderInput = {
  orderNumber: string;
  retailerId: string;
  locationId?: string | null;
  deliveryDate?: string | null;
  promotionCode?: string | null;
  subtotal: number;
  promotionDiscountApplied: number;
  includeSamples: boolean;
  includeMarketingMaterials: boolean;
  marketingMaterialsType?: string | null;
  orderSubmissionKey?: string | null;
};

export type OrderTransactionResult = {
  duplicate: boolean;
  order_id: string;
  order_number: string;
  subtotal: number | string;
  promotion_discount_applied: number | string;
  credit_applied: number | string;
  total: number | string;
};

export const buildOrderItemRows = (items: TransactionOrderItem[]) =>
  items.map((item) => ({
    product_id: item.productId,
    quantity: Math.max(1, Number(item.quantity) || 1),
    unit_price: Number(item.unitPrice || 0),
    total_price: Number((Number(item.unitPrice || 0) * (Math.max(1, Number(item.quantity) || 1))).toFixed(2)),
  }));

export const buildDiscountRedemptionRows = (benefits: OfferCandidate[]) =>
  benefits
    .filter((benefit) => benefit.sourceType === 'discount_code' && benefit.sourceId && benefit.amount > 0)
    .map((benefit) => ({
      discount_code_id: benefit.sourceId,
      discount_amount: Number(benefit.amount || 0),
    }));

export const buildBenefitRedemptionRows = (benefits: OfferCandidate[]) =>
  benefits
    .filter((benefit) => benefit.amount > 0)
    .map((benefit) => ({
      source_type: benefit.sourceType,
      source_id: benefit.sourceId,
      source_name: benefit.name,
      benefit_category: benefit.benefitCategory,
      discount_type: benefit.discountType,
      discount_value: Number(benefit.discountValue || 0),
      discount_amount: Number(benefit.amount || 0),
    }));

export async function createOrderWithPromotions({
  adminClient,
  order,
  items,
  appliedBenefits,
}: {
  adminClient: any;
  order: TransactionOrderInput;
  items: TransactionOrderItem[];
  appliedBenefits: OfferCandidate[];
}): Promise<OrderTransactionResult> {
  const { data, error } = await adminClient.rpc('create_order_with_promotions', {
    p_order: {
      order_number: order.orderNumber,
      retailer_id: order.retailerId,
      location_id: order.locationId || null,
      status: 'pending',
      delivery_date: order.deliveryDate || null,
      promotion_code: order.promotionCode || null,
      subtotal: Number(order.subtotal || 0),
      promotion_discount_applied: Number(order.promotionDiscountApplied || 0),
      include_samples: Boolean(order.includeSamples),
      include_marketing_materials: Boolean(order.includeMarketingMaterials),
      marketing_materials_type: order.marketingMaterialsType || null,
      order_submission_key: order.orderSubmissionKey || null,
    },
    p_items: buildOrderItemRows(items),
    p_discount_redemptions: buildDiscountRedemptionRows(appliedBenefits),
    p_benefit_redemptions: buildBenefitRedemptionRows(appliedBenefits),
    p_apply_account_credit: true,
  });

  if (error) throw error;
  return data as OrderTransactionResult;
}
