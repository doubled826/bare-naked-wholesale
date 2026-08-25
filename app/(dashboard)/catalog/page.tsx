'use client';

import { useEffect, useRef, useState } from 'react';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  ShoppingCart,
  Calendar,
  X,
  CheckCircle,
  Loader2,
  Sparkles,
  LayoutGrid,
  List,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import type { Product, RetailerLocation } from '@/types';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { formatMarketingMaterialsLabel } from '@/lib/marketingMaterials';
import {
  BARE_LAUNCH_OFFER_NAME,
  getBareLaunchOfferStatus,
} from '@/lib/bareLaunchOffer';

type ResolvedOfferBenefit = {
  id: string;
  name: string;
  label: string;
  discountType: 'percent' | 'fixed_amount';
  discountValue: number;
  amount: number;
  expiresAt: string | null;
  daysRemaining?: number;
  isFirstOrderBenefit: boolean;
  isWelcomeOffer: boolean;
};

type LaunchPromoRequestInput = {
  start_date: string;
  duration_weeks: number;
  notes?: string;
};

const quickOrderSortOrder = [
  { name: 'chicken', size: '6' },
  { name: 'chicken', size: '12' },
  { name: 'salmon', size: '6' },
  { name: 'salmon', size: '12' },
  { name: 'beef', size: '6' },
  { name: 'beef', size: '12' },
  { name: 'lamb', size: '' },
  { name: 'minnow', size: '' },
  { name: 'bison', size: '' },
];

const getQuickOrderRank = (product: Product) => {
  const name = product.name.toLowerCase();
  const size = product.size.toLowerCase();
  const rank = quickOrderSortOrder.findIndex((item) =>
    name.includes(item.name) && (!item.size || size.includes(item.size))
  );
  return rank === -1 ? quickOrderSortOrder.length : rank;
};

const sortProductsForOrdering = (products: Product[]) => {
  return [...products].sort((a, b) => {
    const rankDifference = getQuickOrderRank(a) - getQuickOrderRank(b);
    if (rankDifference !== 0) return rankDifference;
    return a.name.localeCompare(b.name) || a.size.localeCompare(b.size);
  });
};

const getGridDescriptionLines = (product: Product) => {
  const name = product.name.toLowerCase();

  if (name.includes('chicken')) {
    return ['Cage-Free Chicken', 'Freeze-dried raw'];
  }

  if (name.includes('salmon')) {
    return ['Pacific Wild-Caught Sockeye Salmon', 'Freeze-dried raw'];
  }

  if (name.includes('beef')) {
    return ['USDA Beef Liver', 'Freeze-dried raw'];
  }

  return [product.description];
};

export default function CatalogPage() {
  const supabase = createClientComponentClient();
  const { products, cart, addToCart, updateQuantity, removeFromCart, clearCart, orders, setOrders, retailer } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [includeSamples, setIncludeSamples] = useState(false);
  const [hasPendingSampleRequest, setHasPendingSampleRequest] = useState(false);
  const [pendingMarketingMaterialsType, setPendingMarketingMaterialsType] = useState<string | null>(null);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [locations, setLocations] = useState<RetailerLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderSuccessMessage, setOrderSuccessMessage] = useState('Check your email for confirmation.');
  const [showPrivatePromoScheduler, setShowPrivatePromoScheduler] = useState(false);
  const [isSchedulingPrivatePromo, setIsSchedulingPrivatePromo] = useState(false);
  const [privatePromoNotice, setPrivatePromoNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [notification, setNotification] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [appliedBenefits, setAppliedBenefits] = useState<ResolvedOfferBenefit[]>([]);
  const [primaryFirstOrderOffer, setPrimaryFirstOrderOffer] = useState<ResolvedOfferBenefit | null>(null);
  const [resolvedDiscountTotal, setResolvedDiscountTotal] = useState(0);
  const [promoCodeFeedback, setPromoCodeFeedback] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);
  const submissionKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const fetchLocations = async () => {
      const { data: locationData, error } = await supabase
        .from('retailer_locations')
        .select('*')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Failed to load locations:', error);
        return;
      }

      const nextLocations = (locationData || []) as RetailerLocation[];
      setLocations(nextLocations);
    };

    fetchLocations();
  }, [supabase]);

  useEffect(() => {
    const fetchPendingRequests = async () => {
      const [{ data: sampleData, error: sampleError }, { data: materialsData, error: materialsError }] = await Promise.all([
        supabase
          .from('sample_requests')
          .select('id')
          .eq('status', 'pending')
          .limit(1),
        supabase
          .from('marketing_material_requests')
          .select('materials_type')
          .eq('status', 'pending')
          .order('created_at', { ascending: true })
          .limit(1),
      ]);

      if (sampleError) {
        console.error('Failed to load sample request status:', sampleError);
      } else {
        const hasPending = Boolean(sampleData?.length);
        setHasPendingSampleRequest(hasPending);
        if (hasPending) {
          setIncludeSamples(true);
        }
      }

      if (materialsError) {
        console.error('Failed to load marketing materials request status:', materialsError);
      } else {
        setPendingMarketingMaterialsType((materialsData?.[0]?.materials_type as string | undefined) || null);
      }
    };

    fetchPendingRequests();
  }, [supabase]);

  const normalizedProfileAddress = retailer?.business_address?.trim().toLowerCase();
  const hasProfileLocation = Boolean(
    normalizedProfileAddress &&
      locations.some((location) => location.business_address.trim().toLowerCase() === normalizedProfileAddress)
  );
  const profileLocation = retailer?.business_address && retailer?.id && !hasProfileLocation
    ? {
        id: 'profile',
        retailer_id: retailer.id,
        location_name: 'Primary Address',
        business_address: retailer.business_address,
        phone: retailer.phone || null,
        is_default: locations.length === 0,
      }
    : null;
  const dropdownLocations = profileLocation ? [profileLocation, ...locations] : locations;

  useEffect(() => {
    if (dropdownLocations.length > 1) {
      const defaultLocation = dropdownLocations.find((location) => location.is_default);
      setSelectedLocationId(defaultLocation?.id || dropdownLocations[0]?.id || null);
      return;
    }

    if (dropdownLocations.length === 1) {
      setSelectedLocationId(dropdownLocations[0].id);
      return;
    }

    setSelectedLocationId(null);
  }, [locations, retailer?.business_address, retailer?.id, retailer?.phone]);

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });
  const orderedProducts = sortProductsForOrdering(filteredProducts);

  const activeOrderCount = orders.filter((order) => order.status !== 'canceled').length;
  const bareLaunchOffer = getBareLaunchOfferStatus({
    accountCreatedAt: retailer?.created_at,
    activeOrderCount,
  });

  const toppers = orderedProducts.filter((product) => product.category === 'Toppers');
  const treats = orderedProducts.filter((product) => product.category === 'Treats');
  const otherProducts = orderedProducts.filter(
    (product) => product.category !== 'Toppers' && product.category !== 'Treats'
  );

  const renderProductCard = (product: Product) => {
    const cartItem = cart.find(item => item.id === product.id);
    const descriptionLines = getGridDescriptionLines(product);
    return (
      <div key={product.id} className="card overflow-hidden">
        <div className="aspect-square bg-cream-200 p-4 flex items-center justify-center">
          {product.image_url ? (
            <img 
              src={product.image_url} 
              alt={product.name} 
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full bg-cream-300 rounded-lg" />
          )}
        </div>
        <div className="p-4">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="font-semibold text-bark-500" style={{ fontFamily: 'var(--font-poppins)' }}>
                {product.name}
              </h3>
              <p className="text-sm text-bark-500/60">{product.size}</p>
            </div>
            <span className="bg-cream-200 text-bark-500 text-xs px-2 py-1 rounded-lg">{product.category}</span>
          </div>
          <div className="mb-4 min-h-[2.5rem] text-sm leading-5 text-bark-500/70">
            {descriptionLines.map((line) => (
              <p key={line} className="line-clamp-1">{line}</p>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xl font-bold text-bark-500" style={{ fontFamily: 'var(--font-poppins)' }}>
                {formatCurrency(product.price)}
              </span>
              <span className="text-xs text-bark-500/60 ml-1">/unit</span>
              {product.msrp && (
                <p className="mt-0.5 text-xs font-medium text-bark-500/55">
                  MSRP {formatCurrency(product.msrp)}
                </p>
              )}
            </div>
            {cartItem ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateQuantity(product.id, cartItem.quantity - 1)}
                  className="w-8 h-8 rounded-lg bg-cream-200 flex items-center justify-center hover:bg-cream-300 transition-colors"
                >
                  <Minus className="w-4 h-4 text-bark-500" />
                </button>
                <span className="w-8 text-center font-semibold text-bark-500">{cartItem.quantity}</span>
                <button
                  onClick={() => updateQuantity(product.id, cartItem.quantity + 1)}
                  className="w-8 h-8 rounded-lg bg-cream-200 flex items-center justify-center hover:bg-cream-300 transition-colors"
                >
                  <Plus className="w-4 h-4 text-bark-500" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleAddToCart(product)}
                className="btn-primary py-2 px-4 text-sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderProductRow = (product: Product) => {
    const cartItem = cart.find(item => item.id === product.id);
    return (
      <div key={product.id} className="flex flex-col gap-4 border-b border-cream-200 px-4 py-4 last:border-b-0 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-cream-200 p-2">
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="h-full w-full object-contain" />
            ) : (
              <ShoppingCart className="h-6 w-6 text-bark-500/30" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-bark-500">{product.name}</h3>
              <span className="rounded-full bg-cream-200 px-2 py-0.5 text-xs font-semibold text-bark-500/70">{product.size}</span>
            </div>
            <p className="mt-1 line-clamp-1 text-sm text-bark-500/60">{product.description}</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 sm:justify-end">
          <div className="text-left sm:text-right">
            <p className="font-bold text-bark-500">{formatCurrency(product.price)}</p>
            {product.msrp && <p className="text-xs text-bark-500/55">MSRP {formatCurrency(product.msrp)}</p>}
          </div>
          {cartItem ? (
            <div className="flex h-10 items-center rounded-xl border border-cream-300 bg-white">
              <button
                onClick={() => updateQuantity(product.id, cartItem.quantity - 1)}
                className="flex h-10 w-10 items-center justify-center rounded-l-xl hover:bg-cream-200"
                aria-label={`Decrease ${product.name}`}
              >
                <Minus className="h-4 w-4 text-bark-500" />
              </button>
              <span className="w-10 text-center text-sm font-semibold text-bark-500">{cartItem.quantity}</span>
              <button
                onClick={() => updateQuantity(product.id, cartItem.quantity + 1)}
                className="flex h-10 w-10 items-center justify-center rounded-r-xl hover:bg-cream-200"
                aria-label={`Increase ${product.name}`}
              >
                <Plus className="h-4 w-4 text-bark-500" />
              </button>
            </div>
          ) : (
            <button onClick={() => handleAddToCart(product)} className="btn-primary min-w-[112px] px-4 py-2.5 text-sm">
              <Plus className="mr-1 h-4 w-4" />
              Add
            </button>
          )}
        </div>
      </div>
    );
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const launchOfferDiscount = appliedBenefits
    .filter((benefit) => benefit.isWelcomeOffer)
    .reduce((sum, benefit) => sum + Number(benefit.amount || 0), 0);
  const checkoutTotal = Math.max(0, cartTotal - resolvedDiscountTotal);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function loadResolvedOffer() {
      try {
        const params = new URLSearchParams();
        params.set('subtotal', String(cartTotal));
        if (promoCode.trim()) params.set('promotionCode', promoCode.trim());
        const response = await fetch(`/api/offers?${params.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || 'Unable to resolve offers.');
        if (!isMounted) return;
        setAppliedBenefits(data?.resolution?.appliedBenefits || []);
        setPrimaryFirstOrderOffer(data?.resolution?.primaryFirstOrderOffer || null);
        setResolvedDiscountTotal(Number(data?.resolution?.totalDiscount || 0));
        if (promoCode.trim() && data?.resolution?.enteredCodeMessage) {
          const status = data?.resolution?.enteredCodeStatus;
          setPromoCodeFeedback({
            type: status === 'applied' ? 'success' : status === 'blocked' ? 'info' : 'error',
            message: data.resolution.enteredCodeMessage,
          });
        } else {
          setPromoCodeFeedback(null);
        }
      } catch (error) {
        if ((error as { name?: string })?.name === 'AbortError') return;
        console.error('Offer resolution error:', error);
        if (promoCode.trim()) {
          setPromoCodeFeedback({ type: 'error', message: 'Unable to validate this promo code right now.' });
        }
      }
    }

    loadResolvedOffer();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [cartTotal, promoCode, retailer?.id, orders.length]);

  const showNotificationMessage = (message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(''), 2000);
  };

  const handleAddToCart = (product: Product) => {
    addToCart(product);
    showNotificationMessage('Added to cart');
  };

  const handleSubmitOrder = async () => {
    if (cart.length === 0) return;
    
    setIsSubmitting(true);
    setSubmitError('');
    if (!submissionKeyRef.current) {
      submissionKeyRef.current = `retailer:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    }
    
    try {
      const locationIdToSubmit =
        dropdownLocations.length > 1 && selectedLocationId !== 'profile' ? selectedLocationId : null;
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart,
          deliveryDate: deliveryDate || null,
          promotionCode: promoCode || null,
          locationId: locationIdToSubmit || null,
          includeSamples,
          orderSubmissionKey: submissionKeyRef.current,
        }),
      });

      let data: any = null;
      try {
        data = await response.json();
      } catch (parseError) {
        data = null;
      }

      if (!response.ok || !data?.success) {
        const errorMessage = data?.error || `Request failed (${response.status})`;
        setSubmitError(errorMessage);
        showNotificationMessage('Order failed: ' + errorMessage);
        return;
      }

      if (data.success) {
        try {
          const ordersResponse = await fetch('/api/orders');
          const ordersData = await ordersResponse.json();
          if (ordersData?.orders) {
            setOrders(ordersData.orders);
          }
        } catch (fetchError) {
          console.error('Failed to refresh orders:', fetchError);
        }
        setOrderSuccess(true);
        if (data.needsPrivatePromoScheduling) {
          setShowPrivatePromoScheduler(true);
        }
        setOrderSuccessMessage(
          Number(data.launchOfferDiscountApplied || 0) > 0
            ? `Check your email for confirmation. ${BARE_LAUNCH_OFFER_NAME} saved you ${formatCurrency(Number(data.launchOfferDiscountApplied || 0))}. Choose your private promo dates next.`
            : Number(data.creditApplied || 0) > 0
            ? `Check your email for confirmation. ${formatCurrency(Number(data.creditApplied || 0))} in credit was applied to this order.`
            : 'Check your email for confirmation.'
        );
        clearCart();
        submissionKeyRef.current = null;
        setShowCheckout(false);
        setIncludeSamples(false);
        setHasPendingSampleRequest(false);
        setPendingMarketingMaterialsType(null);
        setTimeout(() => {
          setOrderSuccess(false);
          setShowCart(false);
        }, 3000);
      }
    } catch (error) {
      setSubmitError('Order submission failed');
      showNotificationMessage('Order submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrivatePromoSchedule = async (request: LaunchPromoRequestInput) => {
    setIsSchedulingPrivatePromo(true);
    setPrivatePromoNotice(null);

    try {
      const response = await fetch('/api/retailer-success', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          launch_promo_status: 'scheduled',
          private_promo_source: 'welcome_offer',
          launch_promo_request: request,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Unable to schedule your private promo.');
      setPrivatePromoNotice({
        type: 'success',
        message: 'Private promo scheduled. We sent the instructions to your email.',
      });
      setTimeout(() => setShowPrivatePromoScheduler(false), 1600);
    } catch (error) {
      setPrivatePromoNotice({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to schedule your private promo.',
      });
    } finally {
      setIsSchedulingPrivatePromo(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {showPrivatePromoScheduler && (
        <PrivatePromoSchedulerModal
          onClose={() => setShowPrivatePromoScheduler(false)}
          onSubmit={handlePrivatePromoSchedule}
          isSaving={isSchedulingPrivatePromo}
          notice={privatePromoNotice}
        />
      )}

      {notification && (
        <div className="fixed top-20 lg:top-6 right-6 z-[60] bg-cream-100 border border-cream-200 rounded-xl p-4 shadow-lg animate-slide-up flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600" />
          <span className="text-bark-500 font-medium">{notification}</span>
        </div>
      )}

      {orderSuccess && (
        <div className="fixed inset-0 bg-bark-500/20 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-cream-100 rounded-2xl p-8 max-w-md w-full text-center animate-slide-up">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-bark-500 mb-2" style={{ fontFamily: 'var(--font-poppins)' }}>
              Order Submitted!
            </h2>
            <p className="text-bark-500/70">
              {orderSuccessMessage}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="page-title">Order Products</h1>
          <p className="text-bark-500/70 mt-1">Add products fast, review your cart, and submit when ready</p>
        </div>
        
        <button
          onClick={() => setShowCart(true)}
          className="btn-primary relative"
        >
          <ShoppingCart className="w-5 h-5 mr-2" />
          View Cart
          {cartItemCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-white text-bark-500 text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-bark-500">
              {cartItemCount}
            </span>
          )}
        </button>
      </div>

      {primaryFirstOrderOffer && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-bark-500">{primaryFirstOrderOffer.name} is active</p>
                <p className="text-sm text-bark-500/70">
                  {primaryFirstOrderOffer.discountValue}% off your first order is available now.
                  {!primaryFirstOrderOffer.isWelcomeOffer && bareLaunchOffer.eligible
                    ? ' Your other Welcome Offer benefits remain available.'
                    : ' Free samples and private promo support are ready with your Welcome Offer.'}
                  {primaryFirstOrderOffer.daysRemaining ? ` ${primaryFirstOrderOffer.daysRemaining} ${primaryFirstOrderOffer.daysRemaining === 1 ? 'day' : 'days'} left.` : ''}
                </p>
              </div>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-amber-800">
              {primaryFirstOrderOffer.discountValue}% available
            </span>
          </div>
        </div>
      )}

      <div className="card p-4 mb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-500/40" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>
          <div className="grid grid-cols-2 rounded-xl bg-cream-200 p-1 lg:w-[210px]">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={cn(
                'inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                viewMode === 'grid' ? 'bg-white text-bark-500 shadow-sm' : 'text-bark-500/65 hover:text-bark-500',
              )}
            >
              <LayoutGrid className="h-4 w-4" />
              Grid
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={cn(
                'inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                viewMode === 'list' ? 'bg-white text-bark-500 shadow-sm' : 'text-bark-500/65 hover:text-bark-500',
              )}
            >
              <List className="h-4 w-4" />
              Quick
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'list' && filteredProducts.length > 0 && (
        <div className="card mb-10 overflow-hidden">
          <div className="border-b border-cream-200 px-4 py-3">
            <p className="text-sm font-semibold text-bark-500">Quick order</p>
          </div>
          {orderedProducts.map(renderProductRow)}
        </div>
      )}

      {viewMode === 'grid' && toppers.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-bark-500">Toppers</h2>
            <span className="text-xs text-bark-500/60">{toppers.length} items</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {toppers.map(renderProductCard)}
          </div>
        </section>
      )}

      {viewMode === 'grid' && treats.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-bark-500">Treats</h2>
            <span className="text-xs text-bark-500/60">{treats.length} items</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {treats.map(renderProductCard)}
          </div>
        </section>
      )}

      {viewMode === 'grid' && otherProducts.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-bark-500">Other</h2>
            <span className="text-xs text-bark-500/60">{otherProducts.length} items</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {otherProducts.map(renderProductCard)}
          </div>
        </section>
      )}

      {(toppers.length + treats.length + otherProducts.length) === 0 && (
        <div className="card p-12 text-center">
          <ShoppingCart className="w-12 h-12 text-bark-500/30 mx-auto mb-4" />
          <p className="text-bark-500/70">No products found</p>
        </div>
      )}

      {showCart && (
        <>
          <div 
            className="fixed inset-0 bg-bark-500/20 backdrop-blur-sm z-40"
            onClick={() => setShowCart(false)}
          />
          <div className="fixed top-0 right-0 h-full w-full max-w-md bg-cream-100 z-50 shadow-2xl overflow-y-auto">
            <div className="p-6 border-b border-cream-200 flex items-center justify-between sticky top-0 bg-cream-100 z-10">
              <h2 className="text-xl font-bold text-bark-500" style={{ fontFamily: 'var(--font-poppins)' }}>
                Your Cart ({cartItemCount})
              </h2>
              <button
                onClick={() => setShowCart(false)}
                className="p-2 rounded-lg hover:bg-cream-200 transition-colors"
              >
                <X className="w-5 h-5 text-bark-500" />
              </button>
            </div>

            {cart.length === 0 ? (
              <div className="p-12 text-center">
                <ShoppingCart className="w-12 h-12 text-bark-500/30 mx-auto mb-4" />
                <p className="text-bark-500/70">Your cart is empty</p>
              </div>
            ) : (
              <>
                <div className="p-6 space-y-4">
                  {cart.map((item) => (
                    <div key={item.id} className="flex gap-4 p-4 bg-cream-200 rounded-xl">
                      <div className="w-16 h-16 bg-cream-300 rounded-lg flex-shrink-0 flex items-center justify-center">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-contain" />
                        ) : (
                          <ShoppingCart className="w-6 h-6 text-bark-500/30" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-bark-500 truncate">{item.name}</h4>
                        <p className="text-sm text-bark-500/60">{item.size}</p>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="w-6 h-6 rounded bg-cream-100 flex items-center justify-center"
                            >
                              <Minus className="w-3 h-3 text-bark-500" />
                            </button>
                            <span className="w-6 text-center text-sm font-medium text-bark-500">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="w-6 h-6 rounded bg-cream-100 flex items-center justify-center"
                            >
                              <Plus className="w-3 h-3 text-bark-500" />
                            </button>
                          </div>
                          <span className="font-semibold text-bark-500">
                            {formatCurrency(item.price * item.quantity)}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-bark-500/40 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>

                {showCheckout ? (
                  <div className="p-6 border-t border-cream-200 space-y-4">
                    <div>
                      <label className="label">Requested Delivery Date (Optional)</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-500/40" />
                        <input
                          type="date"
                          value={deliveryDate}
                          onChange={(e) => setDeliveryDate(e.target.value)}
                          className="input pl-10"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="label">Promotion Code (Optional)</label>
                      <input
                        type="text"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value)}
                        placeholder="Enter code"
                        className="input"
                      />
                      {promoCodeFeedback && (
                        <p className={cn(
                          'mt-2 text-xs font-semibold',
                          promoCodeFeedback.type === 'success'
                            ? 'text-emerald-700'
                            : promoCodeFeedback.type === 'error'
                              ? 'text-red-600'
                              : 'text-amber-700',
                        )}>
                          {promoCodeFeedback.message}
                        </p>
                      )}
                    </div>
                    <label className="flex items-start gap-3 rounded-xl border border-cream-200 bg-cream-200/60 p-4 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeSamples}
                        disabled={hasPendingSampleRequest}
                        onChange={(e) => setIncludeSamples(e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-bark-500/30 text-bark-500 focus:ring-bark-500"
                      />
                      <div>
                        <span className="block text-sm font-medium text-bark-500">Add Samples</span>
                        <span className="block text-xs text-bark-500/70">
                          {hasPendingSampleRequest
                            ? 'Samples were already flagged for your next order and will be included automatically.'
                            : 'Include product samples with this order.'}
                        </span>
                      </div>
                    </label>
                    {primaryFirstOrderOffer && (
                      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                        <div>
                          <span className="block text-sm font-medium text-bark-500">
                            {primaryFirstOrderOffer.name} is available
                          </span>
                          <span className="block text-xs text-bark-500/70">
                            {primaryFirstOrderOffer.discountValue}% off your first order is resolved automatically at checkout.
                            {bareLaunchOffer.eligible ? ' Samples are included with this first order.' : ''}
                          </span>
                        </div>
                      </div>
                    )}
                    {pendingMarketingMaterialsType && (
                      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                        <div>
                          <span className="block text-sm font-medium text-bark-500">
                            Marketing materials will be added
                          </span>
                          <span className="block text-xs text-bark-500/70">
                            {formatMarketingMaterialsLabel(pendingMarketingMaterialsType)} are flagged for this order.
                          </span>
                        </div>
                      </div>
                    )}
                    {dropdownLocations.length > 1 ? (
                      <div>
                        <label className="label">Ship-To Location</label>
                        <select
                          value={selectedLocationId || ''}
                          onChange={(e) => setSelectedLocationId(e.target.value)}
                          className="input"
                        >
                          {dropdownLocations.map((location) => (
                            <option key={location.id} value={location.id}>
                              {location.location_name} — {location.business_address}
                            </option>
                          ))}
                        </select>
                        {selectedLocationId && (
                          <p className="text-xs text-bark-500/60 mt-2">
                            Ship to: {dropdownLocations.find((location) => location.id === selectedLocationId)?.business_address}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-bark-500/60">
                        Ship to: {retailer?.business_address || 'No address on file'}
                      </div>
                    )}
                    
                    <div className="pt-4 border-t border-cream-200">
                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-sm text-bark-500/70">
                          <span>Subtotal</span>
                          <span>{formatCurrency(cartTotal)}</span>
                        </div>
                        {appliedBenefits.map((benefit) => (
                          <div key={benefit.id} className="flex justify-between gap-4 text-sm font-semibold text-emerald-700">
                            <span>{benefit.label}</span>
                            <span>-{formatCurrency(Number(benefit.amount || 0))}</span>
                          </div>
                        ))}
                        <div className="flex justify-between text-lg font-bold text-bark-500 pt-2 border-t border-cream-200">
                          <span>Total</span>
                          <span>{formatCurrency(checkoutTotal)}</span>
                        </div>
                      </div>
                    <button
                      onClick={handleSubmitOrder}
                      disabled={isSubmitting}
                      className="btn-primary w-full"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        'Submit Order'
                      )}
                    </button>
                    {submitError && (
                      <p className="text-sm text-red-600 mt-2">{submitError}</p>
                    )}
                    <button
                      onClick={() => setShowCheckout(false)}
                      className="btn-secondary w-full mt-2"
                    >
                        Back to Cart
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 border-t border-cream-200 sticky bottom-0 bg-cream-100">
                    <div className="flex justify-between text-lg font-bold text-bark-500 mb-4">
                      <span>Subtotal</span>
                      <span>{formatCurrency(cartTotal)}</span>
                    </div>
                    <button
                      onClick={() => setShowCheckout(true)}
                      className="btn-primary w-full"
                    >
                      Proceed to Checkout
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function PrivatePromoSchedulerModal({
  onClose,
  onSubmit,
  isSaving,
  notice,
}: {
  onClose: () => void;
  onSubmit: (request: LaunchPromoRequestInput) => void;
  isSaving: boolean;
  notice: { type: 'success' | 'error'; message: string } | null;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(today);
  const [durationWeeks, setDurationWeeks] = useState(2);
  const durationOptions = [2, 3, 4];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-bark-500/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-amber-200 bg-cream-100 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-800">
              <Sparkles className="h-4 w-4" />
              Welcome Offer
            </div>
            <h2 className="section-title">Schedule your private promo</h2>
            <p className="mt-2 text-sm leading-6 text-bark-500/70">
              Choose when you want to run your private 10% Bare promo. During that window, mark Bare down 10% in your POS. After it ends, email us a screenshot or short POS sales summary from that date range.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-bark-500/60 hover:bg-cream-200 hover:text-bark-500"
            aria-label="Close private promo scheduler"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-5">
          <div>
            <label className="label" htmlFor="private-promo-start">Promo start date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-bark-500/40" />
              <input
                id="private-promo-start"
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
              {durationOptions.map((weeks) => (
                <button
                  key={weeks}
                  type="button"
                  onClick={() => setDurationWeeks(weeks)}
                  className={cn(
                    'rounded-xl px-4 py-3 text-sm font-semibold transition-colors',
                    durationWeeks === weeks
                      ? 'bg-bark-500 text-white'
                      : 'bg-cream-200 text-bark-500 hover:bg-bark-500 hover:text-white',
                  )}
                >
                  {weeks} weeks
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-cream-300 bg-white/70 p-4 text-sm text-bark-500/80">
            <input type="checkbox" checked readOnly className="mt-1 h-4 w-4 rounded border-bark-500/30 text-bark-500" />
            <span>I will mark Bare down 10% during the selected dates and email Bare a POS screenshot or sales summary after the promo ends.</span>
          </label>

          {notice && (
            <div className={cn(
              'rounded-xl border px-4 py-3 text-sm font-semibold',
              notice.type === 'success'
                ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                : 'border-red-100 bg-red-50 text-red-700',
            )}>
              {notice.message}
            </div>
          )}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={isSaving || !startDate}
            onClick={() => onSubmit({ start_date: startDate, duration_weeks: durationWeeks })}
            className="rounded-xl bg-bark-500 px-4 py-2 font-semibold text-white hover:bg-bark-600 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : 'Schedule Promo'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl border border-bark-500/20 px-4 py-2 font-semibold text-bark-500 hover:bg-cream-200 disabled:opacity-50"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
