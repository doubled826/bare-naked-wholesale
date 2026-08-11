import {
  BARE_LAUNCH_OFFER_CODE,
  BARE_LAUNCH_OFFER_DISCOUNT_RATE,
  BARE_LAUNCH_OFFER_NAME,
  getBareLaunchOfferStatus,
} from './bareLaunchOffer';
import {
  calculateDiscountAmount,
  type DiscountBenefitCategory,
  type DiscountCode,
  type DiscountType,
} from './discountCodes';

export type OfferSourceType = 'welcome_offer' | 'discount_code';

export type OfferCandidate = {
  sourceType: OfferSourceType;
  sourceId: string | null;
  code: string | null;
  name: string;
  applicationMethod?: 'automatic' | 'promo_code' | null;
  benefitCategory: DiscountBenefitCategory;
  discountType: DiscountType;
  discountValue: number;
  amount: number;
  priority: number;
  priorityOverride: boolean;
  stackableWithOtherDiscounts: boolean;
  expiresAt: string | null;
  daysRemaining?: number;
  discount?: DiscountCode | null;
  blockedReason?: 'better_offer' | 'cannot_combine';
  blockedBy?: OfferCandidate | null;
};

export type OfferResolution = {
  candidates: OfferCandidate[];
  appliedBenefits: OfferCandidate[];
  blockedBenefits: OfferCandidate[];
  totalDiscount: number;
  primaryFirstOrderOffer: OfferCandidate | null;
  error: string | null;
  enteredCodeStatus: 'none' | 'invalid' | 'applied' | 'blocked';
  enteredCodeBlockedReason?: 'better_offer' | 'cannot_combine' | null;
  enteredCodeMessage: string | null;
};

export type PublicOfferBenefit = {
  id: string;
  name: string;
  label: string;
  discountType: DiscountType;
  discountValue: number;
  amount: number;
  expiresAt: string | null;
  daysRemaining?: number;
  isFirstOrderBenefit: boolean;
  isWelcomeOffer: boolean;
};

export type RetailerOfferContext = {
  id: string;
  created_at?: string | null;
};

const nowTime = (now: Date) => now.getTime();

const isInsideWindow = (startsAt?: string | null, endsAt?: string | null, now = new Date()) => {
  const current = nowTime(now);
  if (startsAt && new Date(startsAt).getTime() > current) return false;
  if (endsAt && new Date(endsAt).getTime() < current) return false;
  return true;
};

const isRetailerSignupQualified = (discount: DiscountCode, retailer: RetailerOfferContext) => {
  if (discount.qualification_type !== 'retailer_signup_window') return true;
  if (!retailer.created_at || !discount.qualification_starts_at || !discount.qualification_ends_at) return false;

  const createdAt = new Date(retailer.created_at).getTime();
  return createdAt >= new Date(discount.qualification_starts_at).getTime() &&
    createdAt <= new Date(discount.qualification_ends_at).getTime();
};

const compareValue = (a: OfferCandidate, b: OfferCandidate) => {
  if (a.amount !== b.amount) return b.amount - a.amount;
  if (a.discountType !== b.discountType) return a.discountType === 'percent' ? -1 : 1;
  if (a.discountValue !== b.discountValue) return Number(b.discountValue) - Number(a.discountValue);
  return a.name.localeCompare(b.name);
};

export function chooseCompetingCandidate(candidates: OfferCandidate[]) {
  const overrideCandidates = candidates.filter((candidate) => candidate.priorityOverride);
  const pool = overrideCandidates.length > 0 ? overrideCandidates : candidates;

  return [...pool].sort((a, b) => {
    if (overrideCandidates.length > 0 && a.priority !== b.priority) return b.priority - a.priority;
    return compareValue(a, b);
  })[0] || null;
}

export function resolveOfferCandidates(candidates: OfferCandidate[]): OfferResolution {
  const categoryWinners = new Map<DiscountBenefitCategory, OfferCandidate>();
  const blockedBenefits: OfferCandidate[] = [];

  for (const candidate of candidates) {
    const current = categoryWinners.get(candidate.benefitCategory);
    if (!current) {
      categoryWinners.set(candidate.benefitCategory, candidate);
      continue;
    }

    const winner = chooseCompetingCandidate([current, candidate]);
    if (winner?.sourceType === candidate.sourceType && winner.sourceId === candidate.sourceId) {
      blockedBenefits.push({ ...current, blockedReason: 'better_offer', blockedBy: candidate });
      categoryWinners.set(candidate.benefitCategory, candidate);
    } else {
      blockedBenefits.push({ ...candidate, blockedReason: 'better_offer', blockedBy: current });
    }
  }

  const categoryResolved = Array.from(categoryWinners.values()).sort(compareValue);
  const appliedBenefits: OfferCandidate[] = [];

  for (const candidate of categoryResolved) {
    if (
      appliedBenefits.length > 0 &&
      !candidate.stackableWithOtherDiscounts &&
      appliedBenefits.some((applied) => !applied.stackableWithOtherDiscounts)
    ) {
      blockedBenefits.push({ ...candidate, blockedReason: 'cannot_combine', blockedBy: appliedBenefits[0] || null });
      continue;
    }

    appliedBenefits.push(candidate);
  }

  return {
    candidates,
    appliedBenefits,
    blockedBenefits,
    totalDiscount: Number(appliedBenefits.reduce((sum, candidate) => sum + candidate.amount, 0).toFixed(2)),
    primaryFirstOrderOffer: categoryWinners.get('first_order_discount') || null,
    error: null,
    enteredCodeStatus: 'none',
    enteredCodeBlockedReason: null,
    enteredCodeMessage: null,
  };
}

const getDiscountValidationMessage = async ({
  adminClient,
  discount,
  retailer,
  activeOrderCount,
  subtotal,
  now,
}: {
  adminClient: any;
  discount: DiscountCode;
  retailer: RetailerOfferContext;
  activeOrderCount: number;
  subtotal: number;
  now: Date;
}) => {
  if (discount.status !== 'active') return 'This discount is inactive.';
  if (!isInsideWindow(discount.redemption_starts_at || discount.starts_at, discount.redemption_ends_at || discount.ends_at, now)) {
    const startsAt = discount.redemption_starts_at || discount.starts_at;
    return startsAt && new Date(startsAt).getTime() > now.getTime()
      ? 'This discount is not active yet.'
      : 'This discount has expired.';
  }
  if (!isRetailerSignupQualified(discount, retailer)) return 'This retailer is not qualified for this discount.';
  if (subtotal < Number(discount.min_order_subtotal || 0)) {
    return `This discount requires a minimum order subtotal of $${Number(discount.min_order_subtotal).toFixed(2)}.`;
  }
  if (discount.eligibility === 'first_order' && activeOrderCount > 0) return 'This discount is only for first orders.';
  if (discount.eligibility === 'repeat_buyers' && activeOrderCount < 2) return 'This discount is only for repeat buyers.';
  if (discount.eligibility === 'manual' && !(discount.manual_retailer_ids || []).includes(retailer.id)) {
    return 'This retailer is not eligible for this discount.';
  }

  const { count: totalRedemptions, error: totalRedemptionsError } = await adminClient
    .from('discount_redemptions')
    .select('id', { count: 'exact', head: true })
    .eq('discount_code_id', discount.id);
  if (totalRedemptionsError) throw totalRedemptionsError;
  if (discount.max_redemptions && (totalRedemptions || 0) >= discount.max_redemptions) {
    return 'This discount has reached its redemption limit.';
  }

  const { count: retailerRedemptions, error: retailerRedemptionsError } = await adminClient
    .from('discount_redemptions')
    .select('id', { count: 'exact', head: true })
    .eq('discount_code_id', discount.id)
    .eq('retailer_id', retailer.id);
  if (retailerRedemptionsError) throw retailerRedemptionsError;
  if (discount.max_redemptions_per_retailer && (retailerRedemptions || 0) >= discount.max_redemptions_per_retailer) {
    return 'This retailer has already used this discount.';
  }

  return null;
};

const toDiscountCandidate = (discount: DiscountCode, subtotal: number): OfferCandidate => ({
  sourceType: 'discount_code',
  sourceId: discount.id,
  code: discount.code,
  name: discount.name,
  applicationMethod: discount.application_method || 'promo_code',
  benefitCategory: discount.benefit_category || 'order_discount',
  discountType: discount.discount_type,
  discountValue: Number(discount.discount_value || 0),
  amount: calculateDiscountAmount(discount, subtotal),
  priority: Number(discount.priority || 0),
  priorityOverride: Boolean(discount.priority_override),
  stackableWithOtherDiscounts: Boolean(discount.stackable_with_other_discounts),
  expiresAt: discount.redemption_ends_at || discount.ends_at || null,
  discount,
});

export const formatOfferBenefitValue = (candidate: Pick<OfferCandidate, 'discountType' | 'discountValue'>) =>
  candidate.discountType === 'percent'
    ? `${Number(candidate.discountValue)}%`
    : `$${Number(candidate.discountValue).toFixed(Number.isInteger(Number(candidate.discountValue)) ? 0 : 2)} off`;

export const formatOfferBenefitLabel = (candidate: Pick<OfferCandidate, 'name' | 'discountType' | 'discountValue'>) =>
  `${candidate.name} (${formatOfferBenefitValue(candidate)})`;

export const toPublicOfferBenefit = (candidate: OfferCandidate): PublicOfferBenefit => ({
  id: `${candidate.sourceType}:${candidate.sourceId || candidate.name}`,
  name: candidate.name,
  label: formatOfferBenefitLabel(candidate),
  discountType: candidate.discountType,
  discountValue: Number(candidate.discountValue || 0),
  amount: Number(candidate.amount || 0),
  expiresAt: candidate.expiresAt,
  daysRemaining: candidate.daysRemaining,
  isFirstOrderBenefit: candidate.benefitCategory === 'first_order_discount',
  isWelcomeOffer: candidate.sourceType === 'welcome_offer',
});

export async function getOfferResolution({
  adminClient,
  retailer,
  activeOrderCount,
  subtotal,
  promotionCode,
  now = new Date(),
}: {
  adminClient: any;
  retailer: RetailerOfferContext;
  activeOrderCount: number;
  subtotal: number;
  promotionCode?: string | null;
  now?: Date;
}): Promise<OfferResolution> {
  const candidates: OfferCandidate[] = [];

  const welcomeOffer = getBareLaunchOfferStatus({
    accountCreatedAt: retailer.created_at,
    activeOrderCount,
    now,
  });

  if (welcomeOffer.eligible) {
    candidates.push({
      sourceType: 'welcome_offer',
      sourceId: BARE_LAUNCH_OFFER_CODE,
      code: BARE_LAUNCH_OFFER_CODE,
      name: BARE_LAUNCH_OFFER_NAME,
      applicationMethod: 'automatic',
      benefitCategory: 'first_order_discount',
      discountType: 'percent',
      discountValue: BARE_LAUNCH_OFFER_DISCOUNT_RATE * 100,
      amount: Number((Math.max(0, subtotal) * BARE_LAUNCH_OFFER_DISCOUNT_RATE).toFixed(2)),
      priority: 10,
      priorityOverride: false,
      stackableWithOtherDiscounts: false,
      expiresAt: welcomeOffer.expiresAt,
      daysRemaining: welcomeOffer.daysRemaining,
      discount: null,
    });
  }

  const normalizedCode = String(promotionCode || '').trim().toUpperCase();
  const { data: automaticDiscounts, error: automaticError } = await adminClient
    .from('discount_codes')
    .select('*')
    .eq('application_method', 'automatic');

  if (automaticError) throw automaticError;

  for (const discount of (automaticDiscounts || []) as DiscountCode[]) {
    const validationMessage = await getDiscountValidationMessage({
      adminClient,
      discount,
      retailer,
      activeOrderCount,
      subtotal,
      now,
    });

    if (!validationMessage) {
      candidates.push(toDiscountCandidate(discount, subtotal));
    }
  }

  let enteredDiscountId: string | null = null;
  let enteredCodeStatus: OfferResolution['enteredCodeStatus'] = normalizedCode ? 'invalid' : 'none';
  let enteredCodeMessage: string | null = null;

  if (normalizedCode) {
    const { data: discount, error } = await adminClient
      .from('discount_codes')
      .select('*')
      .eq('code', normalizedCode)
      .maybeSingle();

    if (error) throw error;
    if (!discount) {
      return {
        ...resolveOfferCandidates(candidates),
        error: 'Discount code not found.',
        enteredCodeStatus: 'invalid',
        enteredCodeBlockedReason: null,
        enteredCodeMessage: 'Discount code not found.',
      };
    }

    const typedDiscount = discount as DiscountCode;
    const validationMessage = await getDiscountValidationMessage({
      adminClient,
      discount: typedDiscount,
      retailer,
      activeOrderCount,
      subtotal,
      now,
    });

    if (validationMessage) {
      return {
        ...resolveOfferCandidates(candidates),
        error: validationMessage.replace('This discount', 'This discount code'),
        enteredCodeStatus: 'invalid',
        enteredCodeBlockedReason: null,
        enteredCodeMessage: validationMessage.replace('This discount', 'This discount code'),
      };
    }

    enteredDiscountId = typedDiscount.id;
    if (!candidates.some((candidate) => candidate.sourceId === typedDiscount.id)) {
      candidates.push(toDiscountCandidate(typedDiscount, subtotal));
    }
  }

  const resolution = resolveOfferCandidates(candidates);

  if (enteredDiscountId) {
    const appliedEntered = resolution.appliedBenefits.find((benefit) => benefit.sourceId === enteredDiscountId);
    const blockedEntered = resolution.blockedBenefits.find((benefit) => benefit.sourceId === enteredDiscountId);
    if (appliedEntered) {
      enteredCodeStatus = 'applied';
      enteredCodeMessage = `${formatOfferBenefitLabel(appliedEntered)} was applied.`;
    } else if (blockedEntered) {
      enteredCodeStatus = 'blocked';
      const blockedReason = blockedEntered.blockedReason || 'cannot_combine';
      const strongerOffer = blockedEntered.blockedBy || resolution.appliedBenefits[0];
      if (blockedReason === 'better_offer' && strongerOffer) {
        enteredCodeMessage = `${formatOfferBenefitLabel(strongerOffer)} is already the better discount.`;
      } else {
        enteredCodeMessage = 'This promo code cannot be combined with your current offer.';
      }
      return {
        ...resolution,
        enteredCodeStatus,
        enteredCodeBlockedReason: blockedReason,
        enteredCodeMessage,
      };
    }
  }

  return {
    ...resolution,
    enteredCodeStatus,
    enteredCodeBlockedReason: null,
    enteredCodeMessage,
  };
}

export async function recordBenefitRedemptions({
  adminClient,
  retailerId,
  orderId,
  benefits,
}: {
  adminClient: any;
  retailerId: string;
  orderId: string;
  benefits: OfferCandidate[];
}) {
  const rows = benefits
    .filter((benefit) => benefit.amount > 0)
    .map((benefit) => ({
      retailer_id: retailerId,
      order_id: orderId,
      source_type: benefit.sourceType,
      source_id: benefit.sourceId,
      source_name: benefit.name,
      benefit_category: benefit.benefitCategory,
      discount_type: benefit.discountType,
      discount_value: benefit.discountValue,
      discount_amount: benefit.amount,
    }));

  if (rows.length === 0) return;

  const { error } = await adminClient
    .from('benefit_redemptions')
    .insert(rows);

  if (error) throw error;
}
