export type DiscountType = 'percent' | 'fixed_amount';
export type DiscountStatus = 'active' | 'inactive';
export type DiscountEligibility = 'all_retailers' | 'first_order' | 'repeat_buyers' | 'manual';
export type DiscountBenefitCategory = 'order_discount' | 'first_order_discount';
export type DiscountQualificationType = 'none' | 'retailer_signup_window';
export type DiscountApplicationMethod = 'automatic' | 'promo_code';

export type DiscountCode = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  application_method?: DiscountApplicationMethod | null;
  discount_type: DiscountType;
  discount_value: number;
  status: DiscountStatus;
  eligibility: DiscountEligibility;
  manual_retailer_ids?: string[] | null;
  min_order_subtotal: number;
  max_redemptions?: number | null;
  max_redemptions_per_retailer?: number | null;
  starts_at?: string | null;
  ends_at?: string | null;
  benefit_category?: DiscountBenefitCategory | null;
  priority?: number | null;
  priority_override?: boolean | null;
  stackable_with_other_discounts?: boolean | null;
  qualification_type?: DiscountQualificationType | null;
  qualification_starts_at?: string | null;
  qualification_ends_at?: string | null;
  redemption_starts_at?: string | null;
  redemption_ends_at?: string | null;
  usage_count?: number | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type DiscountPayload = Omit<DiscountCode, 'id' | 'usage_count' | 'created_by' | 'created_at' | 'updated_at'>;

export const DISCOUNT_CODE_SELECT =
  'id, code, name, description, application_method, discount_type, discount_value, status, eligibility, manual_retailer_ids, min_order_subtotal, max_redemptions, max_redemptions_per_retailer, starts_at, ends_at, benefit_category, priority, priority_override, stackable_with_other_discounts, qualification_type, qualification_starts_at, qualification_ends_at, redemption_starts_at, redemption_ends_at, usage_count, created_by, created_at, updated_at';

export const normalizeDiscountCode = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '');

const toNullableNumber = (value: unknown) => {
  if (value === '' || value === null || value === undefined) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

const toMoney = (value: unknown, fallback = 0) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.max(0, Math.round(numberValue * 100) / 100);
};

const toNullableDate = (value: unknown) => {
  if (!value || typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export function sanitizeDiscountPayload(input: Partial<DiscountPayload>): DiscountPayload {
  const discountType = input.discount_type === 'fixed_amount' ? 'fixed_amount' : 'percent';
  const status = input.status === 'inactive' ? 'inactive' : 'active';
  const applicationMethod: DiscountApplicationMethod = input.application_method === 'automatic' ? 'automatic' : 'promo_code';
  const eligibility: DiscountEligibility = ['all_retailers', 'first_order', 'repeat_buyers', 'manual'].includes(input.eligibility || '')
    ? (input.eligibility as DiscountEligibility)
    : 'all_retailers';
  const manualRetailerIds = Array.isArray(input.manual_retailer_ids)
    ? input.manual_retailer_ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : [];
  const benefitCategory: DiscountBenefitCategory = input.benefit_category === 'first_order_discount'
    ? 'first_order_discount'
    : 'order_discount';
  const qualificationType: DiscountQualificationType = input.qualification_type === 'retailer_signup_window'
    ? 'retailer_signup_window'
    : 'none';
  const startsAt = toNullableDate(input.starts_at);
  const endsAt = toNullableDate(input.ends_at);
  const redemptionStartsAt = toNullableDate(input.redemption_starts_at) || startsAt;
  const redemptionEndsAt = toNullableDate(input.redemption_ends_at) || endsAt;
  const normalizedCode = normalizeDiscountCode(input.code || '');
  const generatedCode = normalizeDiscountCode(`AUTO_${String(input.name || 'DISCOUNT')}_${Date.now().toString(36).toUpperCase()}`).slice(0, 48);

  return {
    code: normalizedCode || (applicationMethod === 'automatic' ? generatedCode : ''),
    name: String(input.name || '').trim(),
    description: input.description ? String(input.description).trim() : null,
    application_method: applicationMethod,
    discount_type: discountType,
    discount_value: toMoney(input.discount_value),
    status,
    eligibility,
    manual_retailer_ids: eligibility === 'manual' ? manualRetailerIds : [],
    min_order_subtotal: toMoney(input.min_order_subtotal),
    max_redemptions: toNullableNumber(input.max_redemptions),
    max_redemptions_per_retailer: toNullableNumber(input.max_redemptions_per_retailer),
    starts_at: startsAt,
    ends_at: endsAt,
    benefit_category: benefitCategory,
    priority: Math.trunc(Number(input.priority || 0)),
    priority_override: Boolean(input.priority_override),
    stackable_with_other_discounts: Boolean(input.stackable_with_other_discounts),
    qualification_type: qualificationType,
    qualification_starts_at: toNullableDate(input.qualification_starts_at),
    qualification_ends_at: toNullableDate(input.qualification_ends_at),
    redemption_starts_at: redemptionStartsAt,
    redemption_ends_at: redemptionEndsAt,
  };
}

export function getDiscountValidationError(discount: DiscountPayload) {
  if (discount.application_method !== 'automatic' && !discount.code) return 'Enter a discount code.';
  if (discount.code && discount.code.length < 3) return 'Discount codes must be at least 3 characters.';
  if (!discount.name) return 'Enter a discount name.';
  if (discount.discount_value <= 0) return 'Enter a discount value greater than zero.';
  if (discount.discount_type === 'percent' && discount.discount_value > 100) return 'Percent discounts cannot be greater than 100%.';
  if (discount.max_redemptions != null && discount.max_redemptions < 1) return 'Total redemption limit must be at least 1.';
  if (discount.max_redemptions_per_retailer != null && discount.max_redemptions_per_retailer < 1) {
    return 'Per-retailer limit must be at least 1.';
  }
  if (discount.eligibility === 'manual' && (discount.manual_retailer_ids || []).length === 0) {
    return 'Choose at least one retailer for a manual discount.';
  }
  if (discount.starts_at && discount.ends_at && new Date(discount.starts_at) > new Date(discount.ends_at)) {
    return 'Start date must be before end date.';
  }
  if (discount.qualification_starts_at && discount.qualification_ends_at && new Date(discount.qualification_starts_at) > new Date(discount.qualification_ends_at)) {
    return 'Qualification start must be before qualification end.';
  }
  if (discount.redemption_starts_at && discount.redemption_ends_at && new Date(discount.redemption_starts_at) > new Date(discount.redemption_ends_at)) {
    return 'Redemption start must be before redemption end.';
  }
  if (discount.qualification_type === 'retailer_signup_window' && (!discount.qualification_starts_at || !discount.qualification_ends_at)) {
    return 'Signup-window qualification needs a qualification start and end.';
  }
  return null;
}

export function calculateDiscountAmount(discount: Pick<DiscountCode, 'discount_type' | 'discount_value'>, subtotal: number) {
  const safeSubtotal = Math.max(0, Number(subtotal) || 0);
  const rawAmount = discount.discount_type === 'percent'
    ? safeSubtotal * (Number(discount.discount_value) / 100)
    : Number(discount.discount_value);

  return Math.min(safeSubtotal, Math.max(0, Math.round(rawAmount * 100) / 100));
}

const getDiscountWindowError = (discount: Pick<DiscountCode, 'status' | 'starts_at' | 'ends_at'>) => {
  const now = Date.now();
  if (discount.status !== 'active') return 'This discount code is inactive.';
  if (discount.starts_at && new Date(discount.starts_at).getTime() > now) return 'This discount code is not active yet.';
  if (discount.ends_at && new Date(discount.ends_at).getTime() < now) return 'This discount code has expired.';
  return null;
};

const getEligibilityError = (discount: DiscountCode, retailerId: string, activeOrderCount: number) => {
  if (discount.eligibility === 'first_order' && activeOrderCount > 0) return 'This discount code is only for first orders.';
  if (discount.eligibility === 'repeat_buyers' && activeOrderCount < 2) return 'This discount code is only for repeat buyers.';
  if (discount.eligibility === 'manual' && !(discount.manual_retailer_ids || []).includes(retailerId)) {
    return 'This retailer is not eligible for this discount code.';
  }
  return null;
};

export async function findApplicableDiscount({
  adminClient,
  code,
  retailerId,
  subtotal,
}: {
  adminClient: any;
  code?: string | null;
  retailerId: string;
  subtotal: number;
}): Promise<{ discount: DiscountCode | null; amount: number; error: string | null }> {
  const normalizedCode = normalizeDiscountCode(code || '');
  if (!normalizedCode) return { discount: null, amount: 0, error: null };

  const { data: discount, error } = await adminClient
    .from('discount_codes')
    .select(DISCOUNT_CODE_SELECT)
    .eq('code', normalizedCode)
    .maybeSingle();

  if (error) throw error;
  if (!discount) return { discount: null, amount: 0, error: 'Discount code not found.' };

  const typedDiscount = discount as DiscountCode;
  const windowError = getDiscountWindowError(typedDiscount);
  if (windowError) return { discount: typedDiscount, amount: 0, error: windowError };

  if (subtotal < Number(typedDiscount.min_order_subtotal || 0)) {
    return { discount: typedDiscount, amount: 0, error: `This discount requires a minimum order subtotal of $${Number(typedDiscount.min_order_subtotal).toFixed(2)}.` };
  }

  const { count: activeOrderCount, error: orderCountError } = await adminClient
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('retailer_id', retailerId)
    .neq('status', 'canceled');

  if (orderCountError) throw orderCountError;

  const eligibilityError = getEligibilityError(typedDiscount, retailerId, activeOrderCount || 0);
  if (eligibilityError) return { discount: typedDiscount, amount: 0, error: eligibilityError };

  const { count: totalRedemptions, error: totalRedemptionsError } = await adminClient
    .from('discount_redemptions')
    .select('id', { count: 'exact', head: true })
    .eq('discount_code_id', typedDiscount.id);

  if (totalRedemptionsError) throw totalRedemptionsError;

  if (typedDiscount.max_redemptions && (totalRedemptions || 0) >= typedDiscount.max_redemptions) {
    return { discount: typedDiscount, amount: 0, error: 'This discount code has reached its redemption limit.' };
  }

  const { count: retailerRedemptions, error: retailerRedemptionsError } = await adminClient
    .from('discount_redemptions')
    .select('id', { count: 'exact', head: true })
    .eq('discount_code_id', typedDiscount.id)
    .eq('retailer_id', retailerId);

  if (retailerRedemptionsError) throw retailerRedemptionsError;

  if (typedDiscount.max_redemptions_per_retailer && (retailerRedemptions || 0) >= typedDiscount.max_redemptions_per_retailer) {
    return { discount: typedDiscount, amount: 0, error: 'This retailer has already used this discount code.' };
  }

  return {
    discount: typedDiscount,
    amount: calculateDiscountAmount(typedDiscount, subtotal),
    error: null,
  };
}

export async function recordDiscountRedemption({
  adminClient,
  discount,
  retailerId,
  orderId,
  discountAmount,
}: {
  adminClient: any;
  discount: DiscountCode | null;
  retailerId: string;
  orderId: string;
  discountAmount: number;
}) {
  if (!discount || discountAmount <= 0) return;

  const { error } = await adminClient
    .from('discount_redemptions')
    .insert({
      discount_code_id: discount.id,
      retailer_id: retailerId,
      order_id: orderId,
      discount_amount: discountAmount,
    });

  if (error) throw error;
}
