export const BARE_LAUNCH_OFFER_NAME = 'The Bare Launch Offer 🚀';
export const BARE_LAUNCH_OFFER_CODE = 'BARE_LAUNCH_OFFER';
export const BARE_LAUNCH_OFFER_DAYS = 14;
export const BARE_LAUNCH_OFFER_DISCOUNT_RATE = 0.1;

const MS_IN_DAY = 1000 * 60 * 60 * 24;

export type BareLaunchOfferStatus = {
  eligible: boolean;
  expiresAt: string | null;
  daysRemaining: number;
  discountRate: number;
};

export function getBareLaunchOfferStatus({
  accountCreatedAt,
  activeOrderCount,
  now = new Date(),
}: {
  accountCreatedAt?: string | Date | null;
  activeOrderCount: number;
  now?: Date;
}): BareLaunchOfferStatus {
  if (!accountCreatedAt || activeOrderCount > 0) {
    return {
      eligible: false,
      expiresAt: null,
      daysRemaining: 0,
      discountRate: BARE_LAUNCH_OFFER_DISCOUNT_RATE,
    };
  }

  const createdAt = new Date(accountCreatedAt);
  if (Number.isNaN(createdAt.getTime())) {
    return {
      eligible: false,
      expiresAt: null,
      daysRemaining: 0,
      discountRate: BARE_LAUNCH_OFFER_DISCOUNT_RATE,
    };
  }

  const expiresAt = new Date(createdAt.getTime() + BARE_LAUNCH_OFFER_DAYS * MS_IN_DAY);
  const msRemaining = expiresAt.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / MS_IN_DAY));

  return {
    eligible: msRemaining > 0,
    expiresAt: expiresAt.toISOString(),
    daysRemaining,
    discountRate: BARE_LAUNCH_OFFER_DISCOUNT_RATE,
  };
}

export function calculateBareLaunchOfferDiscount(subtotal: number) {
  if (subtotal <= 0) return 0;
  return Number((subtotal * BARE_LAUNCH_OFFER_DISCOUNT_RATE).toFixed(2));
}
