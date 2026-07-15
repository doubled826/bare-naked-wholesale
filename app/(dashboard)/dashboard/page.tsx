'use client';

import { useEffect, useRef, useState } from 'react';
import { 
  Package, 
  TrendingUp, 
  DollarSign,
  ShoppingBag,
  ArrowRight,
  Clock,
  CheckCircle,
  Calendar,
  Truck,
  Sparkles,
  Gift,
  Megaphone,
  MessageCircle,
  MapPin,
  ExternalLink,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  BARE_LAUNCH_OFFER_NAME,
  getBareLaunchOfferStatus,
  type BareLaunchOfferStatus,
} from '@/lib/bareLaunchOffer';
import type { Announcement } from '@/types';
import {
  DEFAULT_ASTRO_URL,
  calculateSuccessPlanProgress,
  defaultCurrentAstroPromo,
  getLifecycleMessaging,
  getRecommendedNextStep,
  getRetailerLifecycleStatus,
  getRetailerSuccessChecklist,
  getRetailerSuccessProfile,
  type CurrentAstroPromo,
  type RetailerSuccessAction,
  type RetailerSuccessProfileInput,
  type ShelfPlacementStatus,
  type CurrentPromoStatus,
  type MarketingMaterialsStatus,
  type LaunchPromoStatus,
} from '@/lib/retailerSuccess';

const statusConfig: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  pending: { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100', label: 'Processing' },
  processing: { icon: Package, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Processing' },
  shipped: { icon: Truck, color: 'text-sky-600', bg: 'bg-sky-100', label: 'Shipped' },
  delivered: { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-100', label: 'Delivered' },
  canceled: { icon: Clock, color: 'text-bone-500', bg: 'bg-bone-100', label: 'Canceled' },
};

const getLocalSuccessProfileKey = (retailerId?: string) =>
  retailerId ? `retailer-success-profile:${retailerId}` : null;

const getBareLaunchOfferDismissedKey = (retailerId?: string) =>
  retailerId ? `bare-launch-offer-session-dismissed:${retailerId}` : null;

export default function DashboardPage() {
  const { retailer, orders, products, addNotification } = useAppStore();
  const supabase = createClientComponentClient();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [successProfileRow, setSuccessProfileRow] = useState<RetailerSuccessProfileInput | null>(null);
  const [currentPromo, setCurrentPromo] = useState<CurrentAstroPromo>(defaultCurrentAstroPromo);
  const [successSavingAction, setSuccessSavingAction] = useState<string | null>(null);
  const [isMarkingPlacement, setIsMarkingPlacement] = useState(false);
  const [isRequestingMaterials, setIsRequestingMaterials] = useState(false);
  const [isRequestingLaunchPromo, setIsRequestingLaunchPromo] = useState(false);
  const [isConfirmingLaunchPromoCancel, setIsConfirmingLaunchPromoCancel] = useState(false);
  const [showBareLaunchOfferModal, setShowBareLaunchOfferModal] = useState(false);
  const [bareLaunchOfferDismissed, setBareLaunchOfferDismissed] = useState(false);
  const [successNotice, setSuccessNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const pendingSuccessSaveRef = useRef(false);
  const launchOfferTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get the business name - check both possible field names
  const businessName = retailer?.company_name || retailer?.business_name || '';

  // Calculate analytics
  const activeOrders = orders.filter(order => order.status !== 'canceled');
  const bareLaunchOffer = getBareLaunchOfferStatus({
    accountCreatedAt: retailer?.created_at,
    activeOrderCount: activeOrders.length,
  });
  const totalOrders = activeOrders.length;
  const totalItems = activeOrders.reduce((sum, order) => {
    const orderItems = order.order_items as Array<{ quantity: number }> | undefined;
    const items = orderItems?.reduce((itemSum: number, item) => itemSum + item.quantity, 0) || 0;
    return sum + items;
  }, 0);
  const totalWholesale = activeOrders.reduce((sum, order) => sum + Number(order.total), 0);
  
  // Calculate MSRP and profit
  let totalMSRP = 0;
  activeOrders.forEach(order => {
    const orderItems = order.order_items as Array<{ product_id: string; quantity: number }> | undefined;
    orderItems?.forEach((item) => {
      const product = products.find(p => p.id === item.product_id);
      if (product && product.msrp) {
        totalMSRP += Number(product.msrp) * item.quantity;
      }
    });
  });
  const potentialProfit = totalMSRP - totalWholesale;

  const recentOrders = orders.slice(0, 3);
  const enrichedOrders = orders.map((order) => ({
    ...order,
    order_items: (order.order_items || []).map((item) => ({
      ...item,
      product: item.product || products.find((product) => product.id === item.product_id) || null,
    })),
  }));
  const successProfile = getRetailerSuccessProfile(retailer || {}, enrichedOrders, successProfileRow);
  const lifecycleStatus = getRetailerLifecycleStatus({
    totalOrders: successProfile.totalOrders,
    totalSpend: successProfile.totalSpend,
    firstOrderDate: successProfile.firstOrderDate,
    lastOrderDate: successProfile.lastOrderDate,
    accountCreatedAt: retailer?.created_at,
  });
  const lifecycleMessaging = getLifecycleMessaging(lifecycleStatus);
  const recommendedNextStep = getRecommendedNextStep(retailer, successProfile, currentPromo);
  const checklistItems = getRetailerSuccessChecklist(retailer, successProfile, currentPromo);
  const progress = calculateSuccessPlanProgress(checklistItems);

  useEffect(() => {
    const loadAnnouncements = async () => {
      try {
        const { data } = await supabase
          .from('announcements')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false });
        setAnnouncements(data || []);
      } catch (error) {
        console.error('Announcements error:', error);
      } finally {
        setAnnouncementsLoading(false);
      }
    };
    loadAnnouncements();
  }, [supabase]);

  useEffect(() => {
    const loadRetailerSuccess = async () => {
      const localProfileKey = getLocalSuccessProfileKey(retailer?.id);
      const localProfile = localProfileKey ? window.localStorage.getItem(localProfileKey) : null;

      if (localProfile) {
        setSuccessProfileRow(JSON.parse(localProfile));
      }

      try {
        const response = await fetch('/api/retailer-success');
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || 'Unable to load success plan');
        if (!pendingSuccessSaveRef.current && data.profile) {
          setSuccessProfileRow(data.profile);
          if (localProfileKey) window.localStorage.removeItem(localProfileKey);
        } else if (!pendingSuccessSaveRef.current && !data.profile && !localProfile) {
          setSuccessProfileRow(null);
        }
        setCurrentPromo(data.currentPromo || defaultCurrentAstroPromo);
      } catch (error) {
        console.error('Retailer success error:', error);
      }
    };

    loadRetailerSuccess();
  }, [retailer?.id]);

  useEffect(() => {
    const dismissedKey = getBareLaunchOfferDismissedKey(retailer?.id);
    const isDismissed = dismissedKey ? window.sessionStorage.getItem(dismissedKey) === 'true' : false;
    if (launchOfferTimerRef.current) {
      clearTimeout(launchOfferTimerRef.current);
      launchOfferTimerRef.current = null;
    }
    setBareLaunchOfferDismissed(isDismissed);
    setShowBareLaunchOfferModal(false);
    if (bareLaunchOffer.eligible && !isDismissed) {
      launchOfferTimerRef.current = setTimeout(() => {
        setShowBareLaunchOfferModal(true);
        launchOfferTimerRef.current = null;
      }, 1250);
    }

    return () => {
      if (launchOfferTimerRef.current) {
        clearTimeout(launchOfferTimerRef.current);
        launchOfferTimerRef.current = null;
      }
    };
  }, [bareLaunchOffer.eligible, retailer?.id]);

  const dismissBareLaunchOffer = () => {
    const dismissedKey = getBareLaunchOfferDismissedKey(retailer?.id);
    if (launchOfferTimerRef.current) {
      clearTimeout(launchOfferTimerRef.current);
      launchOfferTimerRef.current = null;
    }
    if (dismissedKey) window.sessionStorage.setItem(dismissedKey, 'true');
    setBareLaunchOfferDismissed(true);
    setShowBareLaunchOfferModal(false);
  };

  const handleBareLaunchOfferOrder = () => {
    dismissBareLaunchOffer();
    window.location.href = '/catalog?offer=bare-launch';
  };

  const showSuccessNotice = (notice: { type: 'success' | 'error'; message: string }) => {
    setSuccessNotice(notice);
    setTimeout(() => setSuccessNotice(null), 3500);
  };

  const updateSuccessProfile = async (
    updates: Partial<RetailerSuccessProfileInput>,
    message?: string,
    extraPayload?: Record<string, unknown>,
    options?: { allowLocalFallback?: boolean },
  ) => {
    const previousProfile = successProfileRow;
    const optimisticProfile: RetailerSuccessProfileInput = {
      retailer_id: retailer?.id,
      samples_acknowledged: successProfile.samplesAcknowledged,
      astro_enrolled: successProfile.astroEnrolled,
      marketing_materials_status: successProfile.marketingMaterialsStatus,
      launch_promo_status: successProfile.launchPromoStatus,
      shelf_placement_status: successProfile.shelfPlacementStatus,
      shelf_placement_note: successProfile.shelfPlacementNote,
      current_promo_status: successProfile.currentPromoStatus,
      success_plan_last_updated_at: successProfile.successPlanLastUpdatedAt,
      ...previousProfile,
      ...updates,
    };

    setSuccessSavingAction(Object.keys(updates)[0] || 'success');
    pendingSuccessSaveRef.current = true;
    setSuccessProfileRow(optimisticProfile);
    try {
      const response = await fetch('/api/retailer-success', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updates, ...extraPayload }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Unable to update success plan');
      setSuccessProfileRow(data.profile);
      const localProfileKey = getLocalSuccessProfileKey(retailer?.id);
      if (localProfileKey) window.localStorage.removeItem(localProfileKey);
      if (data?.notificationWarning) {
        addNotification({ type: 'error', message: data.notificationWarning });
        showSuccessNotice({ type: 'error', message: data.notificationWarning });
        return;
      }
      if (message) {
        addNotification({ type: 'success', message });
        showSuccessNotice({ type: 'success', message });
      }
    } catch (error) {
      console.error('Retailer success save error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unable to update your success plan. Please try again.';
      const localProfileKey = getLocalSuccessProfileKey(retailer?.id);
      if (localProfileKey && options?.allowLocalFallback !== false) {
        window.localStorage.setItem(localProfileKey, JSON.stringify(optimisticProfile));
        showSuccessNotice({
          type: 'success',
          message: message
            ? `${message} Saved locally for this browser; database sync will work after the Retail Success migration is applied.`
            : 'Saved locally for this browser; database sync will work after the Retail Success migration is applied.',
        });
        return;
      }

      setSuccessProfileRow(previousProfile);
      addNotification({ type: 'error', message: errorMessage });
      showSuccessNotice({ type: 'error', message: errorMessage });
    } finally {
      pendingSuccessSaveRef.current = false;
      setSuccessSavingAction(null);
    }
  };

  const handleSuccessAction = (action: RetailerSuccessAction) => {
    if (action === 'shop') {
      window.location.href = '/catalog';
      return;
    }
    if (action === 'treats') {
      window.location.href = '/catalog';
      return;
    }
    if (action === 'astro_link') {
      window.open(DEFAULT_ASTRO_URL, '_blank', 'noopener,noreferrer');
      return;
    }
    if (action === 'promo_link') {
      window.open(currentPromo.astroPromoUrl || DEFAULT_ASTRO_URL, '_blank', 'noopener,noreferrer');
      return;
    }
    if (action === 'samples_acknowledged') {
      updateSuccessProfile({ samples_acknowledged: true }, 'Samples noted. Add them from the checkout sample box on any order.');
      return;
    }
    if (action === 'astro_enrolled') {
      updateSuccessProfile({ astro_enrolled: true }, 'Astro enrollment marked complete.');
      return;
    }
    if (action === 'request_materials') {
      setIsRequestingMaterials(true);
      return;
    }
    if (action === 'materials_have') {
      updateSuccessProfile({ marketing_materials_status: 'have_materials' as MarketingMaterialsStatus }, 'Marketing materials marked as already on hand.');
      return;
    }
    if (action === 'launch_promo') {
      setIsRequestingLaunchPromo(true);
      return;
    }
    if (action === 'shelf_placement') {
      setIsMarkingPlacement(true);
      return;
    }
    if (action === 'promo_opted_in') {
      updateSuccessProfile({ current_promo_status: 'opted_in' as CurrentPromoStatus }, 'Current Astro promo marked as opted in.');
      return;
    }
    if (action === 'promo_not_this_time') {
      updateSuccessProfile({ current_promo_status: 'not_this_time' as CurrentPromoStatus }, 'Current Astro promo marked as not this time.');
    }
  };

  const handleShelfPlacement = (status: ShelfPlacementStatus) => {
    updateSuccessProfile({ shelf_placement_status: status }, 'Shelf placement saved.');
    setIsMarkingPlacement(false);
  };

  const handleMarketingMaterialsRequest = (materials: MarketingMaterialsSelection) => {
    updateSuccessProfile(
      { marketing_materials_status: 'requested' as MarketingMaterialsStatus },
      'Marketing materials requested. We will include them with your next order.',
      { marketing_materials_request: materials },
      { allowLocalFallback: false },
    );
    setIsRequestingMaterials(false);
  };

  const handleMarketingMaterialsOnHand = () => {
    updateSuccessProfile({ marketing_materials_status: 'have_materials' as MarketingMaterialsStatus }, 'Marketing materials marked as already on hand.');
    setIsRequestingMaterials(false);
  };

  const handleLaunchPromoRequest = (request: LaunchPromoRequestInput) => {
    updateSuccessProfile(
      { launch_promo_status: 'requested' as LaunchPromoStatus },
      'Launch promo requested. Our team will follow up with next steps.',
      { launch_promo_request: request },
      { allowLocalFallback: false },
    );
    setIsRequestingLaunchPromo(false);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:p-6 lg:p-8">
      {showBareLaunchOfferModal && (
        <BareLaunchOfferModal
          offer={bareLaunchOffer}
          businessName={businessName}
          onClose={dismissBareLaunchOffer}
          onOrder={handleBareLaunchOfferOrder}
        />
      )}

      {/* Header */}
      <div className="mb-5 sm:mb-8">
        <h1 className="page-title">
          Welcome back{businessName ? `, ${businessName}` : ''}! 👋
        </h1>
        <p className="mt-1 text-sm text-bark-500/70 sm:text-base">
          Here&apos;s what&apos;s happening with your account
        </p>
      </div>

      <WholesalePerksBanner />

      {bareLaunchOffer.eligible && bareLaunchOfferDismissed && (
        <BareLaunchOfferCard
          offer={bareLaunchOffer}
          onOrder={handleBareLaunchOfferOrder}
        />
      )}

      {successNotice && (
        <div className={cn(
          'mb-6 rounded-xl border px-4 py-3 text-sm font-medium',
          successNotice.type === 'success'
            ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
            : 'border-red-100 bg-red-50 text-red-700',
        )}>
          {successNotice.message}
        </div>
      )}

      {/* Stats Grid */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:mb-8 lg:grid-cols-4 lg:gap-6">
        <StatCard
          icon={Package}
          label="Total Orders"
          value={totalOrders}
          color="brown"
        />
        <StatCard
          icon={ShoppingBag}
          label="Items Ordered"
          value={totalItems.toLocaleString()}
          color="cream"
        />
        <StatCard
          icon={DollarSign}
          label="Total Spent"
          value={formatCurrency(totalWholesale)}
          color="blue"
        />
        <StatCard
          icon={TrendingUp}
          label="Potential Profit"
          value={formatCurrency(potentialProfit)}
          color="green"
        />
      </div>

      {currentPromo.promoVisible && (
        <CurrentPromoCard
          currentPromo={currentPromo}
          currentPromoStatus={successProfile.currentPromoStatus}
          onAction={handleSuccessAction}
          isSaving={Boolean(successSavingAction)}
        />
      )}

      {/* Main content grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <RecommendedNextStepCard
            step={recommendedNextStep}
            onAction={handleSuccessAction}
            isSaving={Boolean(successSavingAction)}
          />

          <RetailSuccessPlanCard
            headline={lifecycleMessaging.headline}
            subtext={lifecycleMessaging.subtext}
            progress={progress}
            checklistItems={checklistItems}
            onAction={handleSuccessAction}
            onUndo={(itemId) => {
              if (itemId === 'launch_promo') {
                setIsConfirmingLaunchPromoCancel(true);
                return;
              }
              const undo = undoableChecklistItems[itemId];
              if (undo) updateSuccessProfile(undo.updates, undo.message);
            }}
            isSaving={Boolean(successSavingAction)}
          />
        </div>

        <div className="space-y-6">
          <NeedHelpCard />
          {!announcementsLoading && announcements.length > 0 && (
            <div className="card p-6">
              <h2 className="section-title mb-4">Announcements</h2>
              <div className="space-y-4">
                {announcements.map((announcement) => (
                  <div key={announcement.id} className="p-4 bg-cream-200 rounded-xl">
                    <p className="font-semibold text-bark-500">{announcement.title}</p>
                    <p className="text-sm text-bark-500/70 mt-1">{announcement.message}</p>
                    <p className="text-xs text-bark-500/50 mt-2">{formatDate(announcement.created_at)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {isMarkingPlacement && (
        <ShelfPlacementModal
          onClose={() => setIsMarkingPlacement(false)}
          onSelect={handleShelfPlacement}
        />
      )}

      {isRequestingMaterials && (
        <MarketingMaterialsModal
          onClose={() => setIsRequestingMaterials(false)}
          onHaveMaterials={handleMarketingMaterialsOnHand}
          onSubmit={handleMarketingMaterialsRequest}
          isSaving={Boolean(successSavingAction)}
        />
      )}

      {isRequestingLaunchPromo && (
        <LaunchPromoModal
          onClose={() => setIsRequestingLaunchPromo(false)}
          onSubmit={handleLaunchPromoRequest}
          isSaving={Boolean(successSavingAction)}
        />
      )}

      {isConfirmingLaunchPromoCancel && (
        <ConfirmLaunchPromoCancelModal
          onClose={() => setIsConfirmingLaunchPromoCancel(false)}
          onConfirm={() => {
            const undo = undoableChecklistItems.launch_promo;
            if (undo) updateSuccessProfile(undo.updates, undo.message);
            setIsConfirmingLaunchPromoCancel(false);
          }}
          isSaving={Boolean(successSavingAction)}
        />
      )}

      {/* Recent Orders */}
      <div className="mt-6">
        <div className="card overflow-hidden">
          <div className="p-6 border-b border-cream-200">
            <div className="flex items-center justify-between">
              <h2 className="section-title">
                Recent Orders
              </h2>
              <Link
                href="/orders"
                className="text-sm text-bark-500 hover:text-bark-600 font-medium flex items-center gap-1"
              >
                View all
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {recentOrders.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-12 h-12 text-bark-500/30 mx-auto mb-4" />
              <p className="text-bark-500/70">No orders yet</p>
              <Link href="/catalog" className="btn-primary mt-4 inline-flex">
                Start Shopping
              </Link>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <table className="w-full">
                  <thead className="bg-cream-200">
                    <tr>
                      <th className="table-header px-6 py-3">Order #</th>
                      <th className="table-header px-6 py-3">Date</th>
                      <th className="table-header px-6 py-3">Items</th>
                      <th className="table-header px-6 py-3">Total</th>
                      <th className="table-header px-6 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream-200">
                    {recentOrders.map((order) => {
                      const status = statusConfig[order.status] || statusConfig.pending;
                      const StatusIcon = status.icon;
                      const orderItems = order.order_items as Array<{ quantity: number }> | undefined;
                      const itemCount = orderItems?.reduce((sum: number, item) => sum + item.quantity, 0) || 0;
                      return (
                        <tr key={order.id} className="hover:bg-cream-200/50 transition-colors">
                          <td className="table-cell px-6 font-medium text-bark-500">
                            {order.order_number}
                          </td>
                          <td className="table-cell px-6">
                            {formatDate(order.created_at)}
                          </td>
                          <td className="table-cell px-6">
                            {itemCount} items
                          </td>
                          <td className="table-cell px-6 font-medium">
                            {formatCurrency(Number(order.total))}
                          </td>
                          <td className="table-cell px-6">
                            <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium', status.color)}>
                              <StatusIcon className="w-4 h-4" />
                              {status.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile list */}
              <div className="md:hidden divide-y divide-cream-200">
                {recentOrders.map((order) => {
                  const status = statusConfig[order.status] || statusConfig.pending;
                  const StatusIcon = status.icon;
                  return (
                    <div key={order.id} className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-bark-500 text-sm">
                          {order.order_number}
                        </span>
                        <span className={cn('inline-flex items-center gap-1 text-xs font-medium', status.color)}>
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-bark-500/70">
                        <span>{formatDate(order.created_at)}</span>
                        <span className="font-medium text-bark-500">
                          {formatCurrency(Number(order.total))}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const perkItems = [
  'Free shipping',
  'No minimums',
  'Free customer samples',
  'Astro promos + loyalty rewards',
  'In-store marketing support',
  'Sell-through support',
];

const actionLabels: Partial<Record<RetailerSuccessAction, string>> = {
  shop: 'Shop Products',
  samples_acknowledged: 'Got It',
  astro_link: 'Enroll in Astro',
  astro_enrolled: 'Mark as Enrolled',
  request_materials: 'Request Materials',
  materials_have: 'I Have Them',
  launch_promo: 'Request Launch Promo',
  treats: 'Add Treats to Order',
  shelf_placement: 'Mark Placement',
  promo_link: 'Opt In Through Astro',
  promo_opted_in: 'Mark as Opted In',
  promo_not_this_time: 'Not This Time',
};

type MarketingMaterialsSelection = 'shelf_talker' | 'table_tent' | 'both';
type LaunchPromoRequestInput = {
  start_date: string;
  duration_weeks: number;
};

const marketingMaterialsLabels: Record<MarketingMaterialsSelection, string> = {
  shelf_talker: 'Shelf talker',
  table_tent: 'Table tent',
  both: 'Shelf talker + table tent',
};

const undoableChecklistItems: Partial<Record<string, {
  updates: Partial<RetailerSuccessProfileInput>;
  message: string;
}>> = {
  samples: {
    updates: { samples_acknowledged: false },
    message: 'Samples understanding marked incomplete.',
  },
  astro: {
    updates: { astro_enrolled: false },
    message: 'Astro enrollment marked incomplete.',
  },
  materials: {
    updates: { marketing_materials_status: 'not_requested' },
    message: 'Marketing materials request reset.',
  },
  launch_promo: {
    updates: { launch_promo_status: 'not_requested' },
    message: 'Launch promo request reset.',
  },
  placement: {
    updates: { shelf_placement_status: 'not_set', shelf_placement_note: '' },
    message: 'Shelf placement reset.',
  },
  promo: {
    updates: { current_promo_status: 'not_started' },
    message: 'Current promo response reset.',
  },
};

function BareLaunchOfferModal({
  offer,
  businessName,
  onClose,
  onOrder,
}: {
  offer: BareLaunchOfferStatus;
  businessName: string;
  onClose: () => void;
  onOrder: () => void;
}) {
  return (
    <div className="bare-launch-backdrop fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-bark-500/45 p-3 py-4 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="bare-launch-modal relative my-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-amber-200 bg-cream-100 shadow-2xl">
        <div className="absolute right-6 top-6 hidden h-24 w-24 rounded-full border border-amber-200/70 bg-amber-100/60 sm:block" />
        <div className="absolute -left-8 -top-8 h-32 w-32 rounded-full border border-cream-300 bg-white/50" />
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-lg p-2 text-bark-500/60 hover:bg-cream-200 hover:text-bark-500"
          aria-label="Close Bare Launch Offer for now"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="relative grid max-h-[calc(100vh-2rem)] gap-0 overflow-y-auto lg:grid-cols-[1fr_0.82fr]">
          <div className="p-5 sm:p-8">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-800 sm:mb-5">
              <Sparkles className="h-4 w-4" />
              {offer.daysRemaining} {offer.daysRemaining === 1 ? 'day' : 'days'} left
            </div>
            <p className="text-sm font-semibold text-bark-500/70">
              Welcome{businessName ? `, ${businessName}` : ''}.
            </p>
            <h2 className="mt-2 pr-8 text-[2rem] font-bold leading-tight text-bark-500 sm:pr-0 sm:text-4xl" style={{ fontFamily: 'var(--font-poppins)' }}>
              Your Bare Launch Offer is live!
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-bark-500/75 sm:mt-4 sm:text-base">
              Place your first wholesale order in the next 14 days and we will help you launch Bare with a little extra momentum.
            </p>

            <div className="mt-5 grid gap-3 sm:mt-6 sm:grid-cols-3">
              <OfferPill icon={Gift} label="10% off first order" description="Auto-applied at checkout" />
              <OfferPill icon={Package} label="Free samples" description="Ready for your launch order" />
              <OfferPill icon={Megaphone} label="Private promo support" description="Backed by the Bare team" />
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:mt-7 sm:flex-row sm:items-center">
              <button type="button" onClick={onOrder} className="btn-primary">
                Claim Launch Offer
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-bark-500/20 px-5 py-3 font-semibold text-bark-500 hover:bg-cream-200"
              >
                Later Today
              </button>
            </div>
            <p className="mt-3 text-xs text-bark-500/60">
              No code needed. The 10% discount applies automatically at checkout while the offer is active.
            </p>
          </div>

          <div className="flex min-h-[260px] flex-col justify-between bg-bark-500 p-5 text-white sm:p-8">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-cream-200/80">Bare launch support</p>
              <div className="mt-4 flex items-end gap-2 sm:mt-5">
                <span className="text-6xl font-bold leading-none sm:text-7xl" style={{ fontFamily: 'var(--font-poppins)' }}>10</span>
                <span className="pb-1.5 text-3xl font-bold sm:pb-2">%</span>
                <span className="pb-2 text-base font-semibold text-cream-200 sm:pb-3 sm:text-lg">off</span>
              </div>
              <p className="mt-4 text-sm leading-6 text-cream-100/85 sm:mt-5">
                A full launch offer for your first Bare order: discount support, customer samples, and a private promo plan for your store.
              </p>
            </div>
            <div className="mt-5 space-y-3 rounded-xl bg-white/10 p-4 sm:mt-8">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-4 w-4 shrink-0 text-amber-200" />
                <span className="text-sm font-semibold">First-order discount</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-4 w-4 shrink-0 text-amber-200" />
                <span className="text-sm font-semibold">Sampling campaign</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-4 w-4 shrink-0 text-amber-200" />
                <span className="text-sm font-semibold">Promo support</span>
              </div>
            </div>
            <div className="mt-5 rounded-xl bg-white/10 p-4 sm:mt-8">
              <p className="text-xs uppercase tracking-wide text-cream-200/80">Always included</p>
              <p className="mt-1 text-sm font-semibold">Free shipping, no minimums, Astro Rewards, and private promotions.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BareLaunchOfferCard({
  offer,
  onOrder,
}: {
  offer: BareLaunchOfferStatus;
  onOrder: () => void;
}) {
  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-amber-200 bg-amber-50 shadow-sm lg:mb-8">
      <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 sm:h-12 sm:w-12">
            <Gift className="h-6 w-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-bark-500 sm:text-xl" style={{ fontFamily: 'var(--font-poppins)' }}>
                {BARE_LAUNCH_OFFER_NAME}
              </h2>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-amber-800">
                {offer.daysRemaining} {offer.daysRemaining === 1 ? 'day' : 'days'} left
              </span>
            </div>
            <p className="mt-1 text-sm text-bark-500/75">
              Claim 10% off your first order, a free sampling campaign, and private promo support.
            </p>
          </div>
        </div>
        <button type="button" onClick={onOrder} className="btn-primary w-full shrink-0 sm:w-auto">
          Order Now
          <ArrowRight className="ml-2 h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function OfferPill({
  icon: Icon,
  label,
  description,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-cream-200 bg-cream-200/70 p-4">
      <Icon className="mb-3 h-5 w-5 text-bark-500" />
      <p className="font-bold text-bark-500">{label}</p>
      <p className="mt-1 text-xs leading-5 text-bark-500/70">{description}</p>
    </div>
  );
}

function WholesalePerksBanner() {
  const marqueeItems = [...perkItems, ...perkItems];

  return (
    <div className="mb-6 rounded-2xl border border-cream-200 bg-cream-100 p-3 shadow-sm sm:mb-8 sm:p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-bark-500 sm:text-sm sm:normal-case sm:tracking-normal">
          Wholesale perks included with every account
        </p>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:hidden">
          {perkItems.map((perk) => (
            <div
              key={perk}
              className="flex shrink-0 items-center gap-2 rounded-full bg-cream-200 px-3 py-2 text-xs font-medium text-bark-500"
            >
              <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{perk}</span>
            </div>
          ))}
        </div>
        <div className="relative hidden min-w-0 overflow-hidden sm:block">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-cream-100 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-cream-100 to-transparent" />
          <div className="flex w-max gap-5 overflow-x-auto pb-1 perks-marquee">
            {marqueeItems.map((perk, index) => (
              <div
                key={`${perk}-${index}`}
                className="flex shrink-0 items-center gap-2 rounded-full bg-cream-200 px-4 py-2 text-sm text-bark-500"
                aria-hidden={index >= perkItems.length}
              >
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                <span>{perk}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CurrentPromoCard({
  currentPromo,
  currentPromoStatus,
  onAction,
  isSaving,
}: {
  currentPromo: CurrentAstroPromo;
  currentPromoStatus: CurrentPromoStatus;
  onAction: (action: RetailerSuccessAction) => void;
  isSaving: boolean;
}) {
  const isOptedIn = currentPromoStatus === 'opted_in';
  const isNotThisTime = currentPromoStatus === 'not_this_time';
  const hasResponded = isOptedIn || isNotThisTime;

  if (hasResponded) {
    return (
      <div className={cn(
        'mb-6 rounded-2xl border p-4 shadow-sm sm:p-6 lg:mb-8',
        isOptedIn ? 'border-emerald-200 bg-emerald-50' : 'border-cream-300 bg-cream-100',
      )}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11',
              isOptedIn ? 'bg-emerald-100 text-emerald-700' : 'bg-cream-200 text-bark-500',
            )}>
              {isOptedIn ? <CheckCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-bark-500/60 font-semibold">
                {isOptedIn ? "You're opted in" : 'Promo marked not this time'}
              </p>
              <h2 className="mt-1 text-lg font-bold leading-tight text-bark-500 sm:text-xl">
                {isOptedIn
                  ? `Nice, your store is set for ${currentPromo.promoName || 'the current Astro promo'}.`
                  : `No problem, we marked ${currentPromo.promoName || 'this promo'} as not this time.`}
              </h2>
              <p className="text-sm text-bark-500/70 mt-2 max-w-3xl">
                {isOptedIn
                  ? 'We marked your store as participating. Keep an eye on Astro for promo details and make sure your team knows what is running.'
                  : 'You can still opt in through Astro if plans change, then mark your store as opted in here.'}
              </p>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row lg:shrink-0">
            <button onClick={() => onAction('promo_link')} className={cn(
              'inline-flex items-center justify-center rounded-xl px-4 py-2 font-semibold',
              isOptedIn
                ? 'border border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                : 'bg-bark-500 text-white hover:bg-bark-600',
            )}>
              Open Astro
              <ExternalLink className="w-4 h-4 ml-2" />
            </button>
            {isNotThisTime && (
              <button disabled={isSaving} onClick={() => onAction('promo_opted_in')} className="rounded-xl border border-bark-500/20 px-4 py-2 font-semibold text-bark-500 hover:bg-cream-200 disabled:opacity-50">
                Mark as Opted In
              </button>
            )}
            <button disabled={isSaving} onClick={() => onAction(isOptedIn ? 'promo_not_this_time' : 'promo_opted_in')} className="rounded-xl px-4 py-2 font-semibold text-bark-500/70 hover:bg-cream-200 disabled:opacity-50">
              {isOptedIn ? 'Not This Time' : 'Change to Opted In'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-2xl border border-amber-200 bg-cream-100 p-4 shadow-sm sm:p-6 lg:mb-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 sm:h-11 sm:w-11">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-bark-500/60 font-semibold">Astro Seasonal Promo Available</p>
            <h2 className="mt-1 text-lg font-bold leading-tight text-bark-500 sm:text-xl">Opt into {currentPromo.promoName || 'the current promo'}</h2>
            <p className="text-sm text-bark-500/70 mt-2 max-w-3xl">
              {currentPromo.promoDescription || 'This promotion is managed through Astro. Visit Astro to opt in, then mark it complete here so our team knows your store is participating.'}
            </p>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row lg:shrink-0">
          <button onClick={() => onAction('promo_link')} className="btn-primary inline-flex items-center justify-center">
            Opt In Through Astro
            <ExternalLink className="w-4 h-4 ml-2" />
          </button>
          <button disabled={isSaving} onClick={() => onAction('promo_opted_in')} className="rounded-xl border border-bark-500/20 px-4 py-2 font-semibold text-bark-500 hover:bg-cream-200 disabled:opacity-50">
            Mark as Opted In
          </button>
          <button disabled={isSaving} onClick={() => onAction('promo_not_this_time')} className="rounded-xl px-4 py-2 font-semibold text-bark-500/70 hover:bg-cream-200 disabled:opacity-50">
            Not This Time
          </button>
        </div>
      </div>
    </div>
  );
}

function RecommendedNextStepCard({
  step,
  onAction,
  isSaving,
}: {
  step: ReturnType<typeof getRecommendedNextStep>;
  onAction: (action: RetailerSuccessAction) => void;
  isSaving: boolean;
}) {
  return (
    <div className="rounded-2xl border border-bark-500/10 bg-cream-100 p-5 shadow-md sm:p-7">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-amber-600 sm:h-5 sm:w-5" />
        <p className="text-xs font-semibold uppercase tracking-wide text-bark-500/60 sm:text-sm">Recommended Next Step</p>
      </div>
      <h2 className="text-xl font-bold leading-tight text-bark-500 sm:text-2xl lg:text-3xl">{step.headline}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-bark-500/70 sm:text-base">{step.body}</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button disabled={isSaving} onClick={() => onAction(step.primaryAction)} className="btn-primary inline-flex items-center justify-center">
          {step.primaryLabel}
          {['astro_link', 'promo_link'].includes(step.primaryAction) ? <ExternalLink className="w-4 h-4 ml-2" /> : <ArrowRight className="w-4 h-4 ml-2" />}
        </button>
        {step.secondaryAction && step.secondaryLabel && (
          <button disabled={isSaving} onClick={() => onAction(step.secondaryAction!)} className="rounded-xl border border-bark-500/20 px-4 py-2 font-semibold text-bark-500 hover:bg-cream-200 disabled:opacity-50">
            {step.secondaryLabel}
          </button>
        )}
        {step.tertiaryAction && step.tertiaryLabel && (
          <button disabled={isSaving} onClick={() => onAction(step.tertiaryAction!)} className="rounded-xl px-4 py-2 font-semibold text-bark-500/70 hover:bg-cream-200 disabled:opacity-50">
            {step.tertiaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function RetailSuccessPlanCard({
  headline,
  subtext,
  progress,
  checklistItems,
  onAction,
  onUndo,
  isSaving,
}: {
  headline: string;
  subtext: string;
  progress: ReturnType<typeof calculateSuccessPlanProgress>;
  checklistItems: ReturnType<typeof getRetailerSuccessChecklist>;
  onAction: (action: RetailerSuccessAction) => void;
  onUndo: (itemId: string) => void;
  isSaving: boolean;
}) {
  return (
    <div className="rounded-2xl border border-cream-200 bg-cream-100 p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="section-title">The Bare Retail Roadmap</h2>
          <p className="text-sm text-bark-500/70 mt-1">Your simple checklist for helping customers discover Bare, try it, and come back for more.</p>
          <div className="mt-5">
            <h3 className="text-xl font-bold text-bark-500">{headline}</h3>
            <p className="text-sm text-bark-500/70 mt-1">{subtext}</p>
          </div>
        </div>
        <div className="shrink-0 text-left sm:text-right">
          <p className="text-sm font-semibold text-bark-500">{progress.completed} of {progress.total} steps complete</p>
          <p className="text-xs text-bark-500/60 mt-1">{progress.percentage}% complete</p>
        </div>
      </div>
      <div className="mt-5 h-3 rounded-full bg-cream-200 overflow-hidden">
        <div className="h-full rounded-full bg-bark-500 transition-all" style={{ width: `${progress.percentage}%` }} />
      </div>
      <div className="mt-6 divide-y divide-cream-200">
        {checklistItems.map((item) => {
          const canUndo = Boolean(item.complete && undoableChecklistItems[item.id]);
          const iconClassName = cn(
            'mt-0.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors',
            item.complete ? 'bg-emerald-100 text-emerald-700' : 'bg-cream-200 text-bark-500/60',
            canUndo && 'hover:bg-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-cream-100 cursor-pointer',
          );

          return (
            <div key={item.id} className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                {canUndo ? (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => onUndo(item.id)}
                    className={iconClassName}
                    title={`Mark ${item.title} incomplete`}
                    aria-label={`Mark ${item.title} incomplete`}
                  >
                    <CheckCircle className="w-4 h-4" />
                  </button>
                ) : (
                  <div className={iconClassName}>
                    <CheckCircle className="w-4 h-4" />
                  </div>
                )}
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-bark-500">{item.title}</p>
                    <StatusBadge label={item.statusLabel} />
                  </div>
                  <p className="text-sm text-bark-500/70 mt-1">{item.description}</p>
                </div>
              </div>
              {!item.complete && item.primaryAction && (
                <div className="grid gap-2 sm:flex sm:flex-wrap md:justify-end">
                  <button disabled={isSaving} onClick={() => onAction(item.primaryAction!)} className="rounded-lg bg-bark-500 px-3 py-2 text-sm font-semibold text-white hover:bg-bark-600 disabled:opacity-50">
                    {actionLabels[item.primaryAction] || 'Start'}
                  </button>
                  {item.secondaryAction && (
                    <button disabled={isSaving} onClick={() => onAction(item.secondaryAction!)} className="rounded-lg border border-bark-500/20 px-3 py-2 text-sm font-semibold text-bark-500 hover:bg-cream-200 disabled:opacity-50">
                      {actionLabels[item.secondaryAction]}
                    </button>
                  )}
                  {item.tertiaryAction && (
                    <button disabled={isSaving} onClick={() => onAction(item.tertiaryAction!)} className="rounded-lg px-3 py-2 text-sm font-semibold text-bark-500/70 hover:bg-cream-200 disabled:opacity-50">
                      {actionLabels[item.tertiaryAction]}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ label }: { label: string }) {
  const done = label === 'Done' || label === 'Have Materials' || label === 'Requested' || label === 'Sent';
  return (
    <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-semibold', done ? 'bg-emerald-100 text-emerald-700' : 'bg-cream-200 text-bark-500/70')}>
      {label}
    </span>
  );
}

function NeedHelpCard() {
  return (
    <div className="card p-6">
      <div className="w-11 h-11 rounded-xl bg-cream-200 flex items-center justify-center text-bark-500 mb-4">
        <MessageCircle className="w-5 h-5" />
      </div>
      <h2 className="section-title">Want help building your launch plan?</h2>
      <p className="text-sm text-bark-500/70 mt-2">
        Message our team and we&apos;ll help you choose samples, promos, shelf placement, and materials.
      </p>
      <Link href="/messages" className="btn-primary mt-5 inline-flex">
        Message Us
        <ArrowRight className="w-4 h-4 ml-2" />
      </Link>
    </div>
  );
}

function ShelfPlacementModal({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (status: ShelfPlacementStatus) => void;
}) {
  const options: Array<{ label: string; value: ShelfPlacementStatus; icon: React.ElementType }> = [
    { label: 'Front counter', value: 'front_counter', icon: MapPin },
    { label: 'End cap', value: 'end_cap', icon: Megaphone },
    { label: 'Kibble aisle', value: 'kibble_aisle', icon: ShoppingBag },
    { label: 'Raw/freeze-dried section', value: 'raw_freeze_dried_section', icon: Gift },
    { label: 'Other', value: 'other', icon: Package },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-bark-500/40 p-4 flex items-center justify-center">
      <div className="bg-cream-100 rounded-2xl shadow-xl max-w-lg w-full p-6">
        <h2 className="section-title">Mark shelf placement</h2>
        <p className="text-sm text-bark-500/70 mt-2">
          Choose where Bare is most visible in your store.
        </p>
        <div className="grid sm:grid-cols-2 gap-3 mt-5">
          {options.map(({ label, value, icon: Icon }) => (
            <button key={value} onClick={() => onSelect(value)} className="flex items-center gap-3 rounded-xl bg-cream-200 p-4 text-left hover:bg-bark-500 hover:text-white transition-colors group">
              <Icon className="w-5 h-5 text-bark-500 group-hover:text-white" />
              <span className="font-semibold">{label}</span>
            </button>
          ))}
        </div>
        <button onClick={onClose} className="mt-5 w-full rounded-xl border border-bark-500/20 px-4 py-2 font-semibold text-bark-500 hover:bg-cream-200">
          Cancel
        </button>
      </div>
    </div>
  );
}

function MarketingMaterialsModal({
  onClose,
  onHaveMaterials,
  onSubmit,
  isSaving,
}: {
  onClose: () => void;
  onHaveMaterials: () => void;
  onSubmit: (materials: MarketingMaterialsSelection) => void;
  isSaving: boolean;
}) {
  const [needsMaterials, setNeedsMaterials] = useState(false);
  const [selected, setSelected] = useState<MarketingMaterialsSelection | null>(null);
  const options: Array<{ label: string; value: MarketingMaterialsSelection; icon: React.ElementType }> = [
    { label: 'Shelf talker', value: 'shelf_talker', icon: Megaphone },
    { label: 'Table tent', value: 'table_tent', icon: Gift },
    { label: 'Both', value: 'both', icon: Package },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-bark-500/40 p-4 flex items-center justify-center">
      <div className="bg-cream-100 rounded-2xl shadow-xl max-w-lg w-full p-6">
        <h2 className="section-title">Do you have marketing materials?</h2>
        <p className="text-sm text-bark-500/70 mt-2">
          Shelf talkers and table tents help customers understand Bare in-store. Tell us if you already have them, or request what you need with your next order.
        </p>
        {!needsMaterials ? (
          <div className="mt-5 grid gap-3">
            <button
              type="button"
              disabled={isSaving}
              onClick={onHaveMaterials}
              className="flex items-center gap-3 rounded-xl bg-bark-500 p-4 text-left text-white transition-colors hover:bg-bark-600 disabled:opacity-50"
            >
              <CheckCircle className="h-5 w-5" />
              <span className="font-semibold">Yes, we have them</span>
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => setNeedsMaterials(true)}
              className="flex items-center gap-3 rounded-xl bg-cream-200 p-4 text-left text-bark-500 transition-colors hover:bg-bark-500 hover:text-white disabled:opacity-50"
            >
              <Package className="h-5 w-5" />
              <span className="font-semibold">No, please add them to our next order</span>
            </button>
          </div>
        ) : (
          <div className="grid gap-3 mt-5">
            {options.map(({ label, value, icon: Icon }) => {
              const isSelected = selected === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSelected(value)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl p-4 text-left transition-colors',
                    isSelected
                      ? 'bg-bark-500 text-white'
                      : 'bg-cream-200 text-bark-500 hover:bg-bark-500 hover:text-white',
                  )}
                >
                  <Icon className="w-5 h-5 text-current" />
                  <span className="font-semibold">{label}</span>
                </button>
              );
            })}
          </div>
        )}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {needsMaterials && (
            <button
              type="button"
              disabled={isSaving || !selected}
              onClick={() => {
                if (selected) {
                  onSubmit(selected);
                }
              }}
              className="rounded-xl bg-bark-500 px-4 py-2 font-semibold text-white hover:bg-bark-600 disabled:opacity-50"
            >
              Submit Request
            </button>
          )}
          <button
            type="button"
            onClick={needsMaterials ? () => { setNeedsMaterials(false); setSelected(null); } : onClose}
            className="rounded-xl border border-bark-500/20 px-4 py-2 font-semibold text-bark-500 hover:bg-cream-200"
          >
            {needsMaterials ? 'Back' : 'Cancel'}
          </button>
          {needsMaterials && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-bark-500/20 px-4 py-2 font-semibold text-bark-500 hover:bg-cream-200"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function LaunchPromoModal({
  onClose,
  onSubmit,
  isSaving,
}: {
  onClose: () => void;
  onSubmit: (request: LaunchPromoRequestInput) => void;
  isSaving: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(today);
  const [durationWeeks, setDurationWeeks] = useState(2);
  const durationOptions = [2, 3, 4];

  return (
    <div className="fixed inset-0 z-50 bg-bark-500/40 p-4 flex items-center justify-center">
      <div className="bg-cream-100 rounded-2xl shadow-xl max-w-lg w-full p-6">
        <h2 className="section-title">Request a launch promo</h2>
        <p className="text-sm text-bark-500/70 mt-2">
          We can fully support a 10% off in-store launch promo for new stores. Choose your preferred start date and length.
        </p>

        <div className="mt-5 space-y-5">
          <div>
            <label className="label" htmlFor="launch-promo-start">Promo start date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-bark-500/40" />
              <input
                id="launch-promo-start"
                type="date"
                min={today}
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="input pl-10"
              />
            </div>
          </div>

          <div>
            <p className="label">Promo length</p>
            <div className="grid grid-cols-3 gap-3">
              {durationOptions.map((weeks) => {
                const isSelected = durationWeeks === weeks;
                return (
                  <button
                    key={weeks}
                    type="button"
                    onClick={() => setDurationWeeks(weeks)}
                    className={cn(
                      'rounded-xl px-4 py-3 text-sm font-semibold transition-colors',
                      isSelected
                        ? 'bg-bark-500 text-white'
                        : 'bg-cream-200 text-bark-500 hover:bg-bark-500 hover:text-white',
                    )}
                  >
                    {weeks} weeks
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-bark-500/80">
            Bare will support the promo cost. Our team will review the timing and follow up to confirm details.
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={isSaving || !startDate}
            onClick={() => onSubmit({ start_date: startDate, duration_weeks: durationWeeks })}
            className="rounded-xl bg-bark-500 px-4 py-2 font-semibold text-white hover:bg-bark-600 disabled:opacity-50"
          >
            Submit Request
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-bark-500/20 px-4 py-2 font-semibold text-bark-500 hover:bg-cream-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmLaunchPromoCancelModal({
  onClose,
  onConfirm,
  isSaving,
}: {
  onClose: () => void;
  onConfirm: () => void;
  isSaving: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-bark-500/40 p-4 flex items-center justify-center">
      <div className="bg-cream-100 rounded-2xl shadow-xl max-w-md w-full p-6">
        <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-4">
          <Clock className="w-5 h-5" />
        </div>
        <h2 className="section-title">Cancel launch promo request?</h2>
        <p className="text-sm text-bark-500/70 mt-2">
          This will cancel your pending 10% off launch promo request. If you clicked by accident, keep the request active.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={isSaving}
            onClick={onConfirm}
            className="rounded-xl bg-bark-500 px-4 py-2 font-semibold text-white hover:bg-bark-600 disabled:opacity-50"
          >
            Yes, Cancel Request
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="rounded-xl border border-bark-500/20 px-4 py-2 font-semibold text-bark-500 hover:bg-cream-200 disabled:opacity-50"
          >
            Keep Request
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: 'brown' | 'cream' | 'blue' | 'green';
}) {
  const colorClasses = {
    brown: 'bg-bark-500 text-white',
    cream: 'bg-cream-200 text-bark-500',
    blue: 'bg-sky-100 text-sky-600',
    green: 'bg-emerald-100 text-emerald-600',
  };

  return (
    <div className="rounded-2xl border border-cream-200 bg-cream-100 p-3 shadow-sm sm:p-4 lg:p-6">
      <div className={cn('mb-3 flex h-9 w-9 items-center justify-center rounded-xl sm:h-10 sm:w-10', colorClasses[color])}>
        <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
      </div>
      <p className="stat-value break-words text-xl sm:text-2xl lg:text-3xl">{value}</p>
      <p className="stat-label text-xs sm:text-sm">{label}</p>
    </div>
  );
}
