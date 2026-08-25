export type RetailerLifecycleStatus =
  | 'new_no_order'
  | 'new_store'
  | 'active'
  | 'at_risk'
  | 'inactive'
  | 'high_performer';

export type MarketingMaterialsStatus = 'not_requested' | 'have_materials' | 'requested' | 'sent';
export type LaunchPromoStatus =
  | 'not_started'
  | 'not_requested'
  | 'requested'
  | 'dates_needed'
  | 'scheduled'
  | 'active'
  | 'awaiting_sales_summary'
  | 'completed'
  | 'canceled';
export type ShelfPlacementStatus =
  | 'not_set'
  | 'front_counter'
  | 'end_cap'
  | 'kibble_aisle'
  | 'raw_freeze_dried_section'
  | 'other';
export type CurrentPromoStatus = 'not_started' | 'opted_in' | 'not_this_time';

export type RetailerSuccessProfileInput = {
  retailer_id?: string;
  samples_acknowledged?: boolean | null;
  astro_enrolled?: boolean | null;
  marketing_materials_status?: MarketingMaterialsStatus | null;
  launch_promo_status?: LaunchPromoStatus | null;
  private_promo_status?: LaunchPromoStatus | null;
  private_promo_source?: 'welcome_offer' | 'dashboard_request' | 'admin_created' | null;
  private_promo_start_date?: string | null;
  private_promo_end_date?: string | null;
  private_promo_duration_weeks?: number | null;
  private_promo_discount_percent?: number | null;
  private_promo_sales_summary_requested_at?: string | null;
  private_promo_sales_summary_received_at?: string | null;
  private_promo_last_reminder_sent_at?: string | null;
  private_promo_last_email_stage?: string | null;
  shelf_placement_status?: ShelfPlacementStatus | null;
  shelf_placement_note?: string | null;
  current_promo_status?: CurrentPromoStatus | null;
  success_plan_last_updated_at?: string | null;
};

export type RetailerSuccessProfile = {
  retailerId?: string;
  samplesAcknowledged: boolean;
  astroEnrolled: boolean;
  marketingMaterialsStatus: MarketingMaterialsStatus;
  launchPromoStatus: LaunchPromoStatus;
  launchPromoEligible: boolean;
  privatePromoStatus: LaunchPromoStatus;
  privatePromoSource: 'welcome_offer' | 'dashboard_request' | 'admin_created' | null;
  privatePromoStartDate: string | null;
  privatePromoEndDate: string | null;
  privatePromoDurationWeeks: number | null;
  privatePromoDiscountPercent: number;
  shelfPlacementStatus: ShelfPlacementStatus;
  shelfPlacementNote: string;
  currentPromoStatus: CurrentPromoStatus;
  successPlanLastUpdatedAt: string | null;
  hasPlacedOrder: boolean;
  hasOrderedTreats: boolean;
  totalOrders: number;
  firstOrderDate: string | null;
  lastOrderDate: string | null;
  daysSinceLastOrder: number | null;
  totalSpend: number;
};

export type CurrentAstroPromo = {
  promoVisible: boolean;
  promoName: string;
  promoDescription: string;
  promoStartDate: string | null;
  promoEndDate: string | null;
  astroPromoUrl: string;
};

export type RetailerSuccessChecklistItem = {
  id: string;
  title: string;
  description: string;
  complete: boolean;
  statusLabel: 'Done' | 'Not Started' | 'Have Materials' | 'Requested' | 'Sent' | 'Not This Time' | 'Dates Needed' | 'Scheduled' | 'Active' | 'Needs Summary';
  primaryAction?: RetailerSuccessAction;
  secondaryAction?: RetailerSuccessAction;
  tertiaryAction?: RetailerSuccessAction;
};

export type RetailerSuccessAction =
  | 'shop'
  | 'samples_acknowledged'
  | 'astro_link'
  | 'astro_enrolled'
  | 'request_materials'
  | 'materials_have'
  | 'launch_promo'
  | 'treats'
  | 'shelf_placement'
  | 'promo_link'
  | 'promo_opted_in'
  | 'promo_not_this_time';

export type RecommendedNextStep = {
  key: string;
  headline: string;
  body: string;
  primaryLabel: string;
  primaryAction: RetailerSuccessAction;
  secondaryLabel?: string;
  secondaryAction?: RetailerSuccessAction;
  tertiaryLabel?: string;
  tertiaryAction?: RetailerSuccessAction;
};

export const DEFAULT_ASTRO_URL = 'https://www.astroloyalty.com/';

const MS_IN_DAY = 1000 * 60 * 60 * 24;

export const defaultCurrentAstroPromo: CurrentAstroPromo = {
  promoVisible: false,
  promoName: '',
  promoDescription: '',
  promoStartDate: null,
  promoEndDate: null,
  astroPromoUrl: DEFAULT_ASTRO_URL,
};

export const defaultRetailerSuccessProfile: RetailerSuccessProfile = {
  samplesAcknowledged: false,
  astroEnrolled: false,
  marketingMaterialsStatus: 'not_requested',
  launchPromoStatus: 'not_requested',
  launchPromoEligible: false,
  privatePromoStatus: 'not_started',
  privatePromoSource: null,
  privatePromoStartDate: null,
  privatePromoEndDate: null,
  privatePromoDurationWeeks: null,
  privatePromoDiscountPercent: 10,
  shelfPlacementStatus: 'not_set',
  shelfPlacementNote: '',
  currentPromoStatus: 'not_started',
  successPlanLastUpdatedAt: null,
  hasPlacedOrder: false,
  hasOrderedTreats: false,
  totalOrders: 0,
  firstOrderDate: null,
  lastOrderDate: null,
  daysSinceLastOrder: null,
  totalSpend: 0,
};

export function normalizeCurrentAstroPromo(row?: any): CurrentAstroPromo {
  if (!row) return defaultCurrentAstroPromo;
  return {
    promoVisible: Boolean(row.promo_visible),
    promoName: row.promo_name || '',
    promoDescription: row.promo_description || '',
    promoStartDate: row.promo_start_date || null,
    promoEndDate: row.promo_end_date || null,
    astroPromoUrl: row.astro_promo_url || DEFAULT_ASTRO_URL,
  };
}

export function getRetailerLifecycleStatus(retailer: {
  totalOrders?: number;
  totalSpend?: number;
  firstOrderDate?: string | Date | null;
  lastOrderDate?: string | Date | null;
  accountCreatedAt?: string | Date | null;
}): RetailerLifecycleStatus {
  const totalOrders = retailer.totalOrders || 0;
  const lastOrderDate = retailer.lastOrderDate ? new Date(retailer.lastOrderDate) : null;
  const daysSinceLastOrder = lastOrderDate
    ? Math.floor((Date.now() - lastOrderDate.getTime()) / MS_IN_DAY)
    : null;

  if (totalOrders === 0) return 'new_no_order';
  if (totalOrders >= 4 && daysSinceLastOrder !== null && daysSinceLastOrder <= 30) return 'high_performer';
  if (totalOrders === 1) return 'new_store';
  if (totalOrders >= 2 && daysSinceLastOrder !== null && daysSinceLastOrder <= 60) return 'active';
  if (totalOrders >= 1 && daysSinceLastOrder !== null && daysSinceLastOrder <= 120) return 'at_risk';
  return 'inactive';
}

export function getLifecycleMessaging(status: RetailerLifecycleStatus) {
  const messages: Record<RetailerLifecycleStatus, { headline: string; subtext: string }> = {
    new_no_order: {
      headline: "Let's get your store set up for success.",
      subtext: 'Start with your first order, then use samples, Astro, and in-store support to help customers discover Bare.',
    },
    new_store: {
      headline: "Your first order is in - now let's help it sell through.",
      subtext: 'Use samples, Astro Loyalty, shelf support, and treats to give Bare the best chance to move in-store.',
    },
    active: {
      headline: 'Keep momentum going.',
      subtext: 'Use these tools to drive repeat purchases, increase basket size, and keep Bare visible in-store.',
    },
    at_risk: {
      headline: 'Need a sales boost?',
      subtext: 'A simple refresh with samples, shelf support, and a reorder can help get Bare moving again.',
    },
    inactive: {
      headline: 'Ready to bring Bare back?',
      subtext: 'Restart with a small reorder, samples at checkout, and simple in-store support.',
    },
    high_performer: {
      headline: "You're doing great - here's how to keep momentum going.",
      subtext: "Build on what's working with treats, seasonal promos, and expanded product placement.",
    },
  };
  return messages[status];
}

function isLaunchPromoEligible(totalOrders: number, firstOrderDate: string | null) {
  if (totalOrders === 0) return true;
  if (totalOrders !== 1 || !firstOrderDate) return false;
  const daysSinceFirstOrder = Math.floor((Date.now() - new Date(firstOrderDate).getTime()) / MS_IN_DAY);
  return daysSinceFirstOrder <= 30;
}

export function getRetailerSuccessProfile(
  retailer: { id?: string; created_at?: string | null },
  orders: Array<{
    status?: string | null;
    total?: number | string | null;
    created_at?: string | null;
    include_samples?: boolean | null;
    order_items?: Array<{
      product_id?: string | null;
      product?: { category?: string | null; name?: string | null } | null;
    }>;
  }>,
  storedProfile?: RetailerSuccessProfileInput | null,
): RetailerSuccessProfile {
  const validOrders = orders
    .filter((order) => order.status !== 'canceled')
    .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
  const firstOrderDate = validOrders[0]?.created_at || null;
  const lastOrderDate = validOrders[validOrders.length - 1]?.created_at || null;
  const daysSinceLastOrder = lastOrderDate
    ? Math.floor((Date.now() - new Date(lastOrderDate).getTime()) / MS_IN_DAY)
    : null;
  const hasOrderedTreats = validOrders.some((order) =>
    (order.order_items || []).some((item) => {
      const category = item.product?.category?.toLowerCase() || '';
      const name = item.product?.name?.toLowerCase() || '';
      return category.includes('treat') || name.includes('treat');
    }),
  );

  return {
    retailerId: storedProfile?.retailer_id || retailer.id,
    samplesAcknowledged: Boolean(storedProfile?.samples_acknowledged) || validOrders.some((order) => Boolean(order.include_samples)),
    astroEnrolled: Boolean(storedProfile?.astro_enrolled),
    marketingMaterialsStatus: storedProfile?.marketing_materials_status || 'not_requested',
    launchPromoStatus: storedProfile?.launch_promo_status || 'not_requested',
    launchPromoEligible: isLaunchPromoEligible(validOrders.length, firstOrderDate),
    privatePromoStatus: storedProfile?.private_promo_status || storedProfile?.launch_promo_status || 'not_started',
    privatePromoSource: storedProfile?.private_promo_source || null,
    privatePromoStartDate: storedProfile?.private_promo_start_date || null,
    privatePromoEndDate: storedProfile?.private_promo_end_date || null,
    privatePromoDurationWeeks: storedProfile?.private_promo_duration_weeks || null,
    privatePromoDiscountPercent: Number(storedProfile?.private_promo_discount_percent || 10),
    shelfPlacementStatus: storedProfile?.shelf_placement_status || 'not_set',
    shelfPlacementNote: storedProfile?.shelf_placement_note || '',
    currentPromoStatus: storedProfile?.current_promo_status || 'not_started',
    successPlanLastUpdatedAt: storedProfile?.success_plan_last_updated_at || null,
    hasPlacedOrder: validOrders.length > 0,
    hasOrderedTreats,
    totalOrders: validOrders.length,
    firstOrderDate,
    lastOrderDate,
    daysSinceLastOrder,
    totalSpend: validOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0),
  };
}

export function getRecommendedNextStep(
  _retailer: unknown,
  successProfile: RetailerSuccessProfile,
  currentPromo: CurrentAstroPromo,
): RecommendedNextStep {
  if (successProfile.totalOrders === 0) {
    return {
      key: 'first_order',
      headline: 'Place your first order',
      body: 'Start with the products you want to introduce, then add samples at checkout to help customers try Bare.',
      primaryLabel: 'Shop Products',
      primaryAction: 'shop',
    };
  }
  if (!successProfile.samplesAcknowledged) {
    return {
      key: 'samples',
      headline: 'Add samples at checkout',
      body: 'Free customer samples can be added to any order by checking the sample box at checkout.',
      primaryLabel: 'Got It',
      primaryAction: 'samples_acknowledged',
      secondaryLabel: 'Order Now',
      secondaryAction: 'shop',
    };
  }
  if (!successProfile.astroEnrolled) {
    return {
      key: 'astro',
      headline: 'Enroll in Astro Loyalty',
      body: 'Buy 10, Get 1 Free gives customers a reason to come back.',
      primaryLabel: 'Enroll in Astro',
      primaryAction: 'astro_link',
      secondaryLabel: 'Mark as Enrolled',
      secondaryAction: 'astro_enrolled',
    };
  }
  if (currentPromo.promoVisible && successProfile.currentPromoStatus === 'not_started') {
    return {
      key: 'promo',
      headline: 'Astro seasonal promo available',
      body: 'A Bare-supported seasonal promo is available through Astro. Visit Astro to opt in, then mark it complete here so our team knows your store is participating.',
      primaryLabel: 'Opt In Through Astro',
      primaryAction: 'promo_link',
      secondaryLabel: 'Mark as Opted In',
      secondaryAction: 'promo_opted_in',
      tertiaryLabel: 'Not This Time',
      tertiaryAction: 'promo_not_this_time',
    };
  }
  if (successProfile.marketingMaterialsStatus === 'not_requested') {
    return {
      key: 'materials',
      headline: 'Check your in-store marketing',
      body: 'Shelf talkers and table tents help customers understand Bare at the shelf. Tell us if you already have them, or request them with your next order.',
      primaryLabel: 'Check Materials',
      primaryAction: 'request_materials',
    };
  }
  if (successProfile.launchPromoEligible && ['not_requested', 'dates_needed'].includes(successProfile.privatePromoStatus)) {
    return {
      key: 'launch_promo',
      headline: successProfile.privatePromoStatus === 'dates_needed' ? 'Choose your private promo dates' : 'Schedule your private launch promo',
      body: 'Pick a 2 to 4 week window, mark Bare down 10% during that period, then email us a POS screenshot or sales summary after it ends.',
      primaryLabel: successProfile.privatePromoStatus === 'dates_needed' ? 'Choose Dates' : 'Schedule Promo',
      primaryAction: 'launch_promo',
    };
  }
  if (!successProfile.hasOrderedTreats) {
    return {
      key: 'treats',
      headline: 'Add single-ingredient treats',
      body: 'Treats are an easy add-on that pairs naturally with toppers and helps increase basket size.',
      primaryLabel: 'Add Treats to Order',
      primaryAction: 'treats',
    };
  }
  if (successProfile.shelfPlacementStatus === 'not_set') {
    return {
      key: 'placement',
      headline: 'Choose a high-visibility spot',
      body: 'Bare performs best when customers can easily see it near the front counter, end cap, kibble, or raw/freeze-dried section.',
      primaryLabel: 'Mark Placement',
      primaryAction: 'shelf_placement',
    };
  }
  return {
    key: 'momentum',
    headline: 'Keep momentum going',
    body: "You're set up with the core tools. Reorder best sellers or check back for the next seasonal promo.",
    primaryLabel: 'Shop Products',
    primaryAction: 'shop',
  };
}

export function getRetailerSuccessChecklist(
  _retailer: unknown,
  successProfile: RetailerSuccessProfile,
  currentPromo: CurrentAstroPromo,
): RetailerSuccessChecklistItem[] {
  const items: RetailerSuccessChecklistItem[] = [
    {
      id: 'first_order',
      title: 'First order placed',
      description: 'Your first order gets your store ready to start selling Bare.',
      complete: successProfile.totalOrders >= 1,
      statusLabel: successProfile.totalOrders >= 1 ? 'Done' : 'Not Started',
      primaryAction: 'shop',
    },
    {
      id: 'samples',
      title: 'Samples understood',
      description: 'Free customer samples can be added to any order at checkout.',
      complete: successProfile.samplesAcknowledged,
      statusLabel: successProfile.samplesAcknowledged ? 'Done' : 'Not Started',
      primaryAction: 'samples_acknowledged',
    },
    {
      id: 'astro',
      title: 'Astro enrolled',
      description: 'Astro Loyalty helps drive repeat purchases with Buy 10, Get 1 Free.',
      complete: successProfile.astroEnrolled,
      statusLabel: successProfile.astroEnrolled ? 'Done' : 'Not Started',
      primaryAction: 'astro_link',
      secondaryAction: 'astro_enrolled',
    },
    {
      id: 'materials',
      title: 'Marketing materials checked',
      description: 'Tell us if you already have shelf talkers/table tents, or request them with your next order.',
      complete: ['have_materials', 'requested', 'sent'].includes(successProfile.marketingMaterialsStatus),
      statusLabel: successProfile.marketingMaterialsStatus === 'sent'
        ? 'Sent'
        : successProfile.marketingMaterialsStatus === 'have_materials'
          ? 'Have Materials'
        : successProfile.marketingMaterialsStatus === 'requested'
          ? 'Requested'
          : 'Not Started',
      primaryAction: 'request_materials',
    },
  ];

  if (successProfile.launchPromoEligible) {
    const promoComplete = ['scheduled', 'active', 'awaiting_sales_summary', 'completed'].includes(successProfile.privatePromoStatus) ||
      successProfile.launchPromoStatus === 'requested';
    const promoStatusLabel = successProfile.privatePromoStatus === 'completed'
      ? 'Done'
      : successProfile.privatePromoStatus === 'awaiting_sales_summary'
        ? 'Needs Summary'
        : successProfile.privatePromoStatus === 'active'
          ? 'Active'
          : successProfile.privatePromoStatus === 'scheduled'
            ? 'Scheduled'
            : successProfile.privatePromoStatus === 'dates_needed'
              ? 'Dates Needed'
          : promoComplete
            ? 'Requested'
            : 'Not Started';
    items.push({
      id: 'launch_promo',
      title: 'Private promo scheduled',
      description: 'Choose a 2 to 4 week window, mark Bare down 10%, then send us a POS sales summary after the promo ends.',
      complete: promoComplete,
      statusLabel: promoStatusLabel,
      primaryAction: 'launch_promo',
    });
  }

  items.push(
    {
      id: 'treats',
      title: 'Treats added',
      description: 'Single-ingredient treats are an easy add-on to help increase basket size.',
      complete: successProfile.hasOrderedTreats,
      statusLabel: successProfile.hasOrderedTreats ? 'Done' : 'Not Started',
      primaryAction: 'treats',
    },
    {
      id: 'placement',
      title: 'Shelf placement marked',
      description: 'Bare performs best near the front counter, end cap, kibble, or raw/freeze-dried section.',
      complete: successProfile.shelfPlacementStatus !== 'not_set',
      statusLabel: successProfile.shelfPlacementStatus !== 'not_set' ? 'Done' : 'Not Started',
      primaryAction: 'shelf_placement',
    },
  );

  if (currentPromo.promoVisible) {
    items.push({
      id: 'promo',
      title: 'Current Astro promo checked',
      description: 'Seasonal promos are managed through Astro and can help create urgency.',
      complete: ['opted_in', 'not_this_time'].includes(successProfile.currentPromoStatus),
      statusLabel: successProfile.currentPromoStatus === 'opted_in'
        ? 'Done'
        : successProfile.currentPromoStatus === 'not_this_time'
          ? 'Not This Time'
          : 'Not Started',
      primaryAction: 'promo_link',
      secondaryAction: 'promo_opted_in',
      tertiaryAction: 'promo_not_this_time',
    });
  }

  return items;
}

export function calculateSuccessPlanProgress(checklistItems: RetailerSuccessChecklistItem[]) {
  const completed = checklistItems.filter((item) => item.complete).length;
  const total = checklistItems.length;
  return {
    completed,
    total,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

export function getRetailerSuccessInsights(
  retailers: Array<{ id: string; company_name?: string; created_at?: string | null }>,
  orders: Array<any>,
  successProfiles: RetailerSuccessProfileInput[],
  currentPromo: CurrentAstroPromo,
) {
  const profileByRetailer = new Map(successProfiles.map((profile) => [profile.retailer_id, profile]));
  const ordersByRetailer = new Map<string, any[]>();
  orders.forEach((order) => {
    if (!order.retailer_id) return;
    const existing = ordersByRetailer.get(order.retailer_id) || [];
    existing.push(order);
    ordersByRetailer.set(order.retailer_id, existing);
  });

  const retailerRows = retailers.map((retailer) => {
    const profile = getRetailerSuccessProfile(retailer, ordersByRetailer.get(retailer.id) || [], profileByRetailer.get(retailer.id));
    const lifecycleStatus = getRetailerLifecycleStatus({
      totalOrders: profile.totalOrders,
      totalSpend: profile.totalSpend,
      firstOrderDate: profile.firstOrderDate,
      lastOrderDate: profile.lastOrderDate,
      accountCreatedAt: retailer.created_at,
    });
    const checklist = getRetailerSuccessChecklist(retailer, profile, currentPromo);
    const progress = calculateSuccessPlanProgress(checklist);
    const recommendedNextStep = getRecommendedNextStep(retailer, profile, currentPromo);
    return {
      retailer,
      profile,
      lifecycleStatus,
      checklist,
      progress,
      recommendedNextStep,
    };
  });

  const totalRetailers = retailerRows.length;
  const percent = (count: number) => totalRetailers > 0 ? Math.round((count / totalRetailers) * 100) : 0;
  const byLifecycle = retailerRows.reduce<Record<RetailerLifecycleStatus, number>>((acc, row) => {
    acc[row.lifecycleStatus] += 1;
    return acc;
  }, {
    new_no_order: 0,
    new_store: 0,
    active: 0,
    at_risk: 0,
    inactive: 0,
    high_performer: 0,
  });

  return {
    totalRetailers,
    byLifecycle,
    samplesAcknowledgedPercent: percent(retailerRows.filter((row) => row.profile.samplesAcknowledged).length),
    astroEnrolledPercent: percent(retailerRows.filter((row) => row.profile.astroEnrolled).length),
    marketingMaterialsPercent: percent(retailerRows.filter((row) => ['have_materials', 'requested', 'sent'].includes(row.profile.marketingMaterialsStatus)).length),
    treatsOrderedPercent: percent(retailerRows.filter((row) => row.profile.hasOrderedTreats).length),
    shelfPlacementPercent: percent(retailerRows.filter((row) => row.profile.shelfPlacementStatus !== 'not_set').length),
    currentPromoOptedInPercent: currentPromo.promoVisible
      ? percent(retailerRows.filter((row) => row.profile.currentPromoStatus === 'opted_in').length)
      : 0,
    currentPromoNotRespondedCount: currentPromo.promoVisible
      ? retailerRows.filter((row) => row.profile.currentPromoStatus === 'not_started').length
      : 0,
    missingAstro: retailerRows.filter((row) => !row.profile.astroEnrolled),
    missingSamples: retailerRows.filter((row) => !row.profile.samplesAcknowledged),
    missingMarketingMaterials: retailerRows.filter((row) => row.profile.marketingMaterialsStatus === 'not_requested'),
    missingTreats: retailerRows.filter((row) => !row.profile.hasOrderedTreats),
    missingShelfPlacement: retailerRows.filter((row) => row.profile.shelfPlacementStatus === 'not_set'),
    missingPromoResponse: currentPromo.promoVisible
      ? retailerRows.filter((row) => row.profile.currentPromoStatus === 'not_started')
      : [],
    retailerRows,
  };
}
