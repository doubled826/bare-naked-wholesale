'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { ArrowLeft, ArrowUpRight, Calendar, ClipboardList, Clock, LineChart, Package, TrendingDown, TrendingUp, Plus, Edit2, Trash2, Loader2, Star, CheckCircle, Target, Search, X, Unlink } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { formatBusinessAddress, parseBusinessAddress } from '@/lib/address';
import { formatMarketingMaterialsLabel } from '@/lib/marketingMaterials';
import {
  formatShelfTalkerFlavor,
  getQualifiedShelfTalkerFlavors,
  type ShelfTalkerFlavor,
  type ShelfTalkerFulfillment,
} from '@/lib/shelfTalkers';
import {
  calculateSuccessPlanProgress,
  defaultCurrentAstroPromo,
  getRecommendedNextStep,
  getRetailerLifecycleStatus,
  getRetailerSuccessChecklist,
  getRetailerSuccessProfile,
  normalizeCurrentAstroPromo,
  type CurrentAstroPromo,
  type CurrentPromoStatus,
  type MarketingMaterialsStatus,
  type RetailerSuccessProfileInput,
  type ShelfPlacementStatus,
} from '@/lib/retailerSuccess';

interface Retailer {
  id: string;
  company_name: string;
  business_address: string;
  phone: string;
  email?: string;
  account_number: string;
  status?: string;
  pipedrive_deal_id?: number | null;
  pipedrive_stage_name?: string | null;
  created_at: string;
}

interface OrderItem {
  id: string;
  product_id?: string | null;
  quantity: number;
  total_price: number;
  product: { name: string; size: string; category?: string | null } | null;
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  total: number;
  subtotal: number;
  include_samples?: boolean | null;
  include_marketing_materials?: boolean | null;
  marketing_materials_type?: string | null;
  credit_applied?: number | null;
  created_at: string;
  order_items: OrderItem[];
  shelf_talker_fulfillments?: ShelfTalkerFulfillment[];
}

interface ShelfTalkerAdoptionRow {
  flavor: ShelfTalkerFlavor;
  qualified: boolean;
  fulfillment?: ShelfTalkerFulfillment;
}

interface RetailerLocation {
  id: string;
  location_name: string;
  business_address: string;
  phone: string | null;
  is_default: boolean;
  created_at: string;
}

interface ProductOption {
  id: string;
  name: string;
  size: string;
  price: number;
}

interface RetailerCreditItem {
  id: string;
  product_id?: string | null;
  product_name: string;
  product_size?: string | null;
  quantity: number;
  unit_price: number;
  total_amount: number;
}

interface RetailerCreditApplication {
  id: string;
  applied_amount: number;
  created_at: string;
  order?: {
    id: string;
    order_number: string;
    created_at: string;
  } | null;
}

interface RetailerCredit {
  id: string;
  reason: string;
  notes?: string | null;
  status: 'available' | 'partially_applied' | 'fully_applied' | 'voided';
  total_amount: number;
  remaining_amount: number;
  created_at: string;
  items: RetailerCreditItem[];
  applications: RetailerCreditApplication[];
}

interface DealOption {
  id: number;
  title: string;
  stageName?: string | null;
  ownerName?: string | null;
  orgName?: string | null;
}

interface QuarterPoint {
  label: string;
  start: Date;
  average: number;
  total: number;
  count: number;
}

const getQuarterLabel = (date: Date) => {
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `Q${quarter} ${date.getFullYear()}`;
};

const getQuarterStart = (date: Date) => new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);

const buildQuarterPoints = (orders: Order[]) => {
  const buckets = new Map<string, QuarterPoint>();
  orders.forEach((order) => {
    const createdAt = new Date(order.created_at);
    const start = getQuarterStart(createdAt);
    const label = getQuarterLabel(createdAt);
    const key = start.toISOString();
    const existing = buckets.get(key);
    if (existing) {
      existing.total += order.total || 0;
      existing.count += 1;
      existing.average = existing.total / existing.count;
    } else {
      buckets.set(key, { label, start, average: order.total || 0, total: order.total || 0, count: 1 });
    }
  });
  return Array.from(buckets.values()).sort((a, b) => a.start.getTime() - b.start.getTime());
};

const buildSkuStats = (orders: Order[]) => {
  const skuMap = new Map<string, { label: string; quantity: number; total: number }>();
  orders.forEach((order) => {
    order.order_items?.forEach((item) => {
      const product = Array.isArray(item.product) ? item.product[0] : item.product;
      const label = `${product?.name || 'Unknown'} • ${product?.size || '—'}`;
      const entry = skuMap.get(label);
      if (entry) {
        entry.quantity += item.quantity || 0;
        entry.total += item.total_price || 0;
      } else {
        skuMap.set(label, { label, quantity: item.quantity || 0, total: item.total_price || 0 });
      }
    });
  });
  return Array.from(skuMap.values()).sort((a, b) => b.quantity - a.quantity);
};

const normalizeOrders = (orders: Order[]) =>
  orders.map((order) => ({
    ...order,
    order_items: (order.order_items || []).map((item) => ({
      ...item,
      product: Array.isArray(item.product) ? item.product[0] ?? null : item.product ?? null,
    })),
  }));

const getPipedriveDealUrl = (dealId: number) => `https://app.pipedrive.com/deal/${dealId}`;

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'shipped':
      return 'bg-purple-100 text-purple-800';
    case 'delivered':
      return 'bg-emerald-100 text-emerald-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const OrdersLineChart = ({ points }: { points: QuarterPoint[] }) => {
  if (points.length === 0) {
    return <div className="h-48 flex items-center justify-center text-sm text-gray-500">No order history yet</div>;
  }

  const values = points.map((point) => point.average);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const height = 160;
  const width = 640;
  const padding = 20;

  const scaled = points.map((point, index) => {
    const x = padding + (index / Math.max(points.length - 1, 1)) * (width - padding * 2);
    const y = padding + (1 - (point.average - min) / range) * (height - padding * 2);
    return { x, y };
  });

  const linePath = scaled.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ');

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48">
        <path d={linePath} fill="none" stroke="#8B5B3E" strokeWidth="3" />
        {scaled.map((point, index) => (
          <circle key={points[index].label} cx={point.x} cy={point.y} r="4" fill="#8B5B3E" />
        ))}
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#E5E7EB" strokeWidth="1" />
      </svg>
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-500">
        {points.map((point) => (
          <div key={point.label} className="flex items-center gap-2">
            <span className="font-medium text-gray-700">{point.label}</span>
            <span>{formatCurrency(point.average)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function AdminRetailerDetailPage() {
  const supabase = createClientComponentClient();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const retailerId = params?.id;

  const [retailer, setRetailer] = useState<Retailer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [locations, setLocations] = useState<RetailerLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [newLocation, setNewLocation] = useState({
    location_name: '',
    businessStreet: '',
    businessCity: '',
    businessState: '',
    businessZip: '',
    phone: '',
    makeDefault: false,
  });
  const [editLocationId, setEditLocationId] = useState<string | null>(null);
  const [editLocation, setEditLocation] = useState({
    location_name: '',
    businessStreet: '',
    businessCity: '',
    businessState: '',
    businessZip: '',
    phone: '',
  });
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [isDeletingLocationId, setIsDeletingLocationId] = useState<string | null>(null);
  const [isSettingDefaultId, setIsSettingDefaultId] = useState<string | null>(null);
  const [locationNotice, setLocationNotice] = useState('');
  const [credits, setCredits] = useState<RetailerCredit[]>([]);
  const [availableCreditBalance, setAvailableCreditBalance] = useState(0);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [showAddCredit, setShowAddCredit] = useState(false);
  const [creditNotice, setCreditNotice] = useState('');
  const [isSavingCredit, setIsSavingCredit] = useState(false);
  const [isRemovingCreditId, setIsRemovingCreditId] = useState<string | null>(null);
  const [creditProducts, setCreditProducts] = useState<ProductOption[]>([]);
  const [successProfileRow, setSuccessProfileRow] = useState<RetailerSuccessProfileInput | null>(null);
  const [currentPromo, setCurrentPromo] = useState<CurrentAstroPromo>(defaultCurrentAstroPromo);
  const [successNotice, setSuccessNotice] = useState('');
  const [isSavingSuccess, setIsSavingSuccess] = useState(false);
  const [shelfTalkerFulfillments, setShelfTalkerFulfillments] = useState<ShelfTalkerFulfillment[]>([]);
  const [isDeletingRetailer, setIsDeletingRetailer] = useState(false);
  const [showPipedriveLinkModal, setShowPipedriveLinkModal] = useState(false);
  const [pipedriveDealQuery, setPipedriveDealQuery] = useState('');
  const [pipedriveDealResults, setPipedriveDealResults] = useState<DealOption[]>([]);
  const [isSearchingPipedriveDeals, setIsSearchingPipedriveDeals] = useState(false);
  const [isLinkingPipedriveDeal, setIsLinkingPipedriveDeal] = useState(false);
  const [isUnlinkingPipedriveDeal, setIsUnlinkingPipedriveDeal] = useState(false);
  const [pipedriveLinkError, setPipedriveLinkError] = useState('');
  const [newCredit, setNewCredit] = useState({
    mode: 'sku' as 'sku' | 'custom',
    reason: 'Return credit',
    notes: '',
    customAmount: '',
    items: [{ productId: '', quantity: 1 }],
  });
  const [hasSyncedProfileLocation, setHasSyncedProfileLocation] = useState(false);
  const hasSyncedProfileLocationRef = useRef(false);

  const showLocationNotice = (message: string) => {
    setLocationNotice(message);
    setTimeout(() => setLocationNotice(''), 3000);
  };

  const showCreditNotice = (message: string) => {
    setCreditNotice(message);
    setTimeout(() => setCreditNotice(''), 3000);
  };

  const showSuccessNotice = (message: string) => {
    setSuccessNotice(message);
    setTimeout(() => setSuccessNotice(''), 3000);
  };

  const openPipedriveLinkModal = () => {
    setPipedriveDealQuery(retailer?.company_name || '');
    setPipedriveDealResults([]);
    setPipedriveLinkError('');
    setShowPipedriveLinkModal(true);
  };

  const searchPipedriveDeals = async () => {
    const query = pipedriveDealQuery.trim();
    if (!query) {
      setPipedriveLinkError('Enter a retailer or deal name to search.');
      return;
    }

    setIsSearchingPipedriveDeals(true);
    setPipedriveLinkError('');
    try {
      const response = await fetch(`/api/admin/pipedrive/deals/search?term=${encodeURIComponent(query)}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to search Pipedrive deals.');
      }
      setPipedriveDealResults((payload.deals || []) as DealOption[]);
    } catch (error) {
      setPipedriveDealResults([]);
      setPipedriveLinkError(error instanceof Error ? error.message : 'Unable to search Pipedrive deals.');
    } finally {
      setIsSearchingPipedriveDeals(false);
    }
  };

  const linkPipedriveDeal = async (deal: DealOption) => {
    if (!retailerId) return;
    setIsLinkingPipedriveDeal(true);
    setPipedriveLinkError('');
    try {
      const response = await fetch(`/api/admin/retailers/${retailerId}/pipedrive-deal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: deal.id }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to link Pipedrive deal.');
      }

      setRetailer((current) => current ? ({
        ...current,
        pipedrive_deal_id: deal.id,
        pipedrive_stage_name: payload.deal?.stageName || deal.stageName || null,
      }) : current);
      setShowPipedriveLinkModal(false);
      setPipedriveDealResults([]);
      showSuccessNotice('Pipedrive deal linked.');
    } catch (error) {
      setPipedriveLinkError(error instanceof Error ? error.message : 'Unable to link Pipedrive deal.');
    } finally {
      setIsLinkingPipedriveDeal(false);
    }
  };

  const unlinkPipedriveDeal = async () => {
    if (!retailerId || !retailer?.pipedrive_deal_id) return;

    const confirmed = window.confirm(
      `Unlink Pipedrive deal #${retailer.pipedrive_deal_id} from ${retailer.company_name}? This only removes the portal link.`,
    );

    if (!confirmed) return;

    setIsUnlinkingPipedriveDeal(true);
    try {
      const response = await fetch(`/api/admin/retailers/${retailerId}/pipedrive-deal`, {
        method: 'DELETE',
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to unlink Pipedrive deal.');
      }

      setRetailer((current) => current ? ({
        ...current,
        pipedrive_deal_id: null,
        pipedrive_stage_name: null,
      }) : current);
      showSuccessNotice('Pipedrive deal unlinked.');
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Unable to unlink Pipedrive deal.');
    } finally {
      setIsUnlinkingPipedriveDeal(false);
    }
  };

  const deleteRetailer = async () => {
    if (!retailerId || !retailer) return;

    if (orders.length > 0) {
      window.alert('Retailers with order history cannot be deleted.');
      return;
    }

    const confirmed = window.confirm(
      `Delete ${retailer.company_name}? This removes the retailer login and portal profile. This cannot be undone.`,
    );

    if (!confirmed) return;

    setIsDeletingRetailer(true);
    try {
      const response = await fetch(`/api/admin/retailers/${retailerId}`, {
        method: 'DELETE',
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Unable to delete retailer.');
      }

      router.push('/admin/retailers');
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Unable to delete retailer.');
      setIsDeletingRetailer(false);
    }
  };

  const fetchData = async () => {
      if (!retailerId) return;
      setIsLoading(true);
      setError('');
      try {
        const [
          retailerResponse,
          { data: ordersData, error: ordersError },
          { data: locationsData, error: locationsError },
          { data: successProfileData },
          { data: promoData },
          { data: shelfTalkerData, error: shelfTalkerError },
        ] = await Promise.all([
          fetch(`/api/admin/retailers/${retailerId}`),
          supabase.from('orders').select('id, order_number, status, total, subtotal, credit_applied, include_samples, include_marketing_materials, marketing_materials_type, created_at, order_items(id, quantity, total_price, product_id, product:products(name, size, category)), shelf_talker_fulfillments(id, retailer_id, location_id, flavor, status, fulfilled_order_id, qualified_at, fulfilled_at)').eq('retailer_id', retailerId).order('created_at', { ascending: false }),
          supabase.from('retailer_locations').select('id, location_name, business_address, phone, is_default, created_at').eq('retailer_id', retailerId).order('is_default', { ascending: false }).order('created_at', { ascending: true }),
          supabase.from('retailer_success_profiles').select('*').eq('retailer_id', retailerId).maybeSingle(),
          supabase.from('retailer_success_promo_settings').select('*').eq('id', 'current').maybeSingle(),
          supabase.from('shelf_talker_fulfillments').select('*').eq('retailer_id', retailerId).order('created_at', { ascending: false }),
        ]);

        const retailerPayload = await retailerResponse.json();
        if (!retailerResponse.ok || !retailerPayload?.retailer) {
          throw new Error(retailerPayload?.error || 'Failed to load retailer details.');
        }
        if (ordersError) throw ordersError;
        if (locationsError) throw locationsError;
        if (shelfTalkerError) throw shelfTalkerError;

        const retailerData = retailerPayload.retailer as Retailer;
        setRetailer(retailerData);
        setOrders(normalizeOrders((ordersData || []) as unknown as Order[]));
        setSuccessProfileRow(successProfileData || null);
        setCurrentPromo(normalizeCurrentAstroPromo(promoData));
        setShelfTalkerFulfillments((shelfTalkerData || []) as ShelfTalkerFulfillment[]);
        const nextLocations = (locationsData || []) as RetailerLocation[];
        setLocations(nextLocations);

        if (!hasSyncedProfileLocationRef.current && retailerData?.business_address) {
          const normalizedProfileAddress = retailerData.business_address.trim().toLowerCase();
          const matchingLocation = nextLocations.find(
            (location) => location.business_address.trim().toLowerCase() === normalizedProfileAddress
          );

          if (!matchingLocation) {
            const { data: insertedLocation, error: insertError } = await supabase
              .from('retailer_locations')
              .insert({
                retailer_id: retailerData.id,
                location_name: 'Primary Address',
                business_address: retailerData.business_address,
                phone: retailerData.phone || null,
                is_default: true,
              })
              .select()
              .single();

            if (insertError) throw insertError;

            if (insertedLocation?.id) {
              await supabase
                .from('retailer_locations')
                .update({ is_default: false })
                .eq('retailer_id', retailerData.id)
                .neq('id', insertedLocation.id);
            }

            setHasSyncedProfileLocation(true);
            hasSyncedProfileLocationRef.current = true;
            fetchData();
            return;
          }

          if (!matchingLocation.is_default) {
            await supabase
              .from('retailer_locations')
              .update({ is_default: false })
              .eq('retailer_id', retailerData.id);

            await supabase
              .from('retailer_locations')
              .update({ is_default: true })
              .eq('id', matchingLocation.id);

            setHasSyncedProfileLocation(true);
            hasSyncedProfileLocationRef.current = true;
            fetchData();
            return;
          }

          setHasSyncedProfileLocation(true);
          hasSyncedProfileLocationRef.current = true;
        }
      } catch (fetchError) {
        console.error('Error loading retailer details:', fetchError);
        setError('Unable to load retailer details.');
      } finally {
        setIsLoading(false);
      }
  };

  useEffect(() => {
    setHasSyncedProfileLocation(false);
    hasSyncedProfileLocationRef.current = false;
  }, [retailerId]);

  useEffect(() => {
    fetchData();
  }, [retailerId, supabase]);

  const fetchCredits = async () => {
    if (!retailerId) return;

    setCreditsLoading(true);
    try {
      const response = await fetch(`/api/admin/retailers/${retailerId}/credits`);
      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to load credits.');
      }

      setCredits((data.credits || []) as RetailerCredit[]);
      setAvailableCreditBalance(Number(data.availableBalance || 0));
    } catch (creditError) {
      console.error('Error loading credits:', creditError);
      setCredits([]);
      setAvailableCreditBalance(0);
    } finally {
      setCreditsLoading(false);
    }
  };

  useEffect(() => {
    fetchCredits();
  }, [retailerId]);

  useEffect(() => {
    const fetchCreditProducts = async () => {
      const { data, error: productsError } = await supabase
        .from('products')
        .select('id, name, size, price')
        .order('name', { ascending: true });

      if (productsError) {
        console.error('Error loading products for credits:', productsError);
        return;
      }

      setCreditProducts((data || []) as ProductOption[]);
    };

    fetchCreditProducts();
  }, [supabase]);

  const handleAddLocation = async () => {
    if (!retailerId) return;
    if (
      !newLocation.location_name.trim() ||
      !newLocation.businessStreet.trim() ||
      !newLocation.businessCity.trim() ||
      !newLocation.businessState.trim() ||
      !newLocation.businessZip.trim()
    ) {
      showLocationNotice('Location name and full address are required.');
      return;
    }

    setIsSavingLocation(true);
    try {
      const shouldBeDefault = newLocation.makeDefault || locations.length === 0;
      const businessAddress = formatBusinessAddress({
        street: newLocation.businessStreet,
        city: newLocation.businessCity,
        state: newLocation.businessState,
        zip: newLocation.businessZip,
      });
      const { data: insertedLocation, error: insertError } = await supabase
        .from('retailer_locations')
        .insert({
          retailer_id: retailerId,
          location_name: newLocation.location_name.trim(),
          business_address: businessAddress,
          phone: newLocation.phone.trim() || null,
          is_default: shouldBeDefault,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      if (shouldBeDefault && insertedLocation?.id) {
        await supabase
          .from('retailer_locations')
          .update({ is_default: false })
          .eq('retailer_id', retailerId)
          .neq('id', insertedLocation.id);
      }

      setNewLocation({
        location_name: '',
        businessStreet: '',
        businessCity: '',
        businessState: '',
        businessZip: '',
        phone: '',
        makeDefault: false,
      });
      setShowAddLocation(false);
      showLocationNotice('Location added.');
      fetchData();
    } catch (addError) {
      console.error('Error adding location:', addError);
      showLocationNotice('Failed to add location.');
    } finally {
      setIsSavingLocation(false);
    }
  };

  const handleEditLocation = (location: RetailerLocation) => {
    const parsed = parseBusinessAddress(location.business_address || '');

    setEditLocationId(location.id);
    setEditLocation({
      location_name: location.location_name,
      businessStreet: parsed.street || location.business_address || '',
      businessCity: parsed.city || '',
      businessState: parsed.state || '',
      businessZip: parsed.zip || '',
      phone: location.phone || '',
    });
  };

  const handleUpdateLocation = async () => {
    if (!editLocationId) return;
    if (
      !editLocation.location_name.trim() ||
      !editLocation.businessStreet.trim() ||
      !editLocation.businessCity.trim() ||
      !editLocation.businessState.trim() ||
      !editLocation.businessZip.trim()
    ) {
      showLocationNotice('Location name and full address are required.');
      return;
    }

    setIsSavingLocation(true);
    try {
      const businessAddress = formatBusinessAddress({
        street: editLocation.businessStreet,
        city: editLocation.businessCity,
        state: editLocation.businessState,
        zip: editLocation.businessZip,
      });
      const { error: updateError } = await supabase
        .from('retailer_locations')
        .update({
          location_name: editLocation.location_name.trim(),
          business_address: businessAddress,
          phone: editLocation.phone.trim() || null,
        })
        .eq('id', editLocationId);

      if (updateError) throw updateError;

      setEditLocationId(null);
      showLocationNotice('Location updated.');
      fetchData();
    } catch (updateError) {
      console.error('Error updating location:', updateError);
      showLocationNotice('Failed to update location.');
    } finally {
      setIsSavingLocation(false);
    }
  };

  const handleSetDefaultLocation = async (locationId: string) => {
    if (!retailerId) return;
    setIsSettingDefaultId(locationId);
    try {
      await supabase
        .from('retailer_locations')
        .update({ is_default: false })
        .eq('retailer_id', retailerId);

      const { error: defaultError } = await supabase
        .from('retailer_locations')
        .update({ is_default: true })
        .eq('id', locationId);

      if (defaultError) throw defaultError;

      showLocationNotice('Default location updated.');
      fetchData();
    } catch (defaultError) {
      console.error('Error setting default location:', defaultError);
      showLocationNotice('Failed to update default.');
    } finally {
      setIsSettingDefaultId(null);
    }
  };

  const handleDeleteLocation = async (location: RetailerLocation) => {
    setIsDeletingLocationId(location.id);
    try {
      const { error: deleteError } = await supabase
        .from('retailer_locations')
        .delete()
        .eq('id', location.id);

      if (deleteError) throw deleteError;

      if (location.is_default) {
        const remaining = locations.filter((loc) => loc.id !== location.id);
        if (remaining.length > 0) {
          await supabase
            .from('retailer_locations')
            .update({ is_default: true })
            .eq('id', remaining[0].id);
        }
      }

      showLocationNotice('Location removed.');
      fetchData();
    } catch (deleteError) {
      console.error('Error deleting location:', deleteError);
      showLocationNotice('Failed to delete location.');
    } finally {
      setIsDeletingLocationId(null);
    }
  };

  const handleAddCreditItem = () => {
    setNewCredit((prev) => ({
      ...prev,
      items: [...prev.items, { productId: '', quantity: 1 }],
    }));
  };

  const handleRemoveCreditItem = (index: number) => {
    setNewCredit((prev) => ({
      ...prev,
      items: prev.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const handleUpdateCreditItem = (index: number, key: 'productId' | 'quantity', value: string | number) => {
    setNewCredit((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      ),
    }));
  };

  const getCreditProductPrice = (productId: string) =>
    Number(creditProducts.find((product) => product.id === productId)?.price || 0);

  const newCreditTotal = newCredit.items.reduce(
    (sum, item) => sum + getCreditProductPrice(item.productId) * (Number(item.quantity) || 0),
    0
  );
  const manualCreditTotal = Number(newCredit.customAmount || 0);

  const handleCreateCredit = async () => {
    if (!retailerId) return;

    const validItems = newCredit.items.filter((item) => item.productId && Number(item.quantity) > 0);
    if (newCredit.mode === 'sku' && validItems.length === 0) {
      showCreditNotice('Select at least one SKU and quantity.');
      return;
    }
    if (newCredit.mode === 'custom' && manualCreditTotal <= 0) {
      showCreditNotice('Enter a custom credit amount greater than zero.');
      return;
    }

    setIsSavingCredit(true);
    try {
      const response = await fetch(`/api/admin/retailers/${retailerId}/credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: newCredit.reason,
          notes: newCredit.notes,
          items: newCredit.mode === 'sku' ? validItems : [],
          customAmount: newCredit.mode === 'custom' ? manualCreditTotal : null,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to issue credit.');
      }

      setNewCredit({
        mode: 'sku',
        reason: 'Return credit',
        notes: '',
        customAmount: '',
        items: [{ productId: '', quantity: 1 }],
      });
      setShowAddCredit(false);
      showCreditNotice('Credit issued.');
      await fetchCredits();
    } catch (creditError) {
      console.error('Error creating credit:', creditError);
      showCreditNotice(creditError instanceof Error ? creditError.message : 'Failed to issue credit.');
    } finally {
      setIsSavingCredit(false);
    }
  };

  const handleRemoveCredit = async (credit: RetailerCredit) => {
    if (!retailerId) return;

    const hasApplications = Boolean(credit.applications?.length);
    const confirmed = window.confirm(
      hasApplications
        ? 'This credit has already been applied to an order. Removing it will void any remaining balance only. Continue?'
        : 'Remove this credit? This cannot be undone.'
    );

    if (!confirmed) return;

    setIsRemovingCreditId(credit.id);
    try {
      const response = await fetch(`/api/admin/retailers/${retailerId}/credits/${credit.id}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to remove credit.');
      }

      showCreditNotice(data.message || 'Credit removed.');
      await fetchCredits();
    } catch (removeError) {
      console.error('Error removing credit:', removeError);
      showCreditNotice(removeError instanceof Error ? removeError.message : 'Failed to remove credit.');
    } finally {
      setIsRemovingCreditId(null);
    }
  };

  const updateAdminSuccessProfile = async (updates: Partial<RetailerSuccessProfileInput>, message = 'Retailer success status updated.') => {
    if (!retailerId) return;
    setIsSavingSuccess(true);
    try {
      const response = await fetch(`/api/admin/retailer-success/${retailerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to update success status.');
      }

      setSuccessProfileRow(data.profile);
      showSuccessNotice(message);
    } catch (successError) {
      console.error('Error updating retailer success status:', successError);
      showSuccessNotice(successError instanceof Error ? successError.message : 'Failed to update success status.');
    } finally {
      setIsSavingSuccess(false);
    }
  };

  const ordersForStats = useMemo(() => orders.filter((order) => order.status !== 'canceled'), [orders]);

  const orderStats = useMemo(() => {
    const totalOrders = ordersForStats.length;
    const totalSpent = ordersForStats.reduce((sum, order) => sum + (order.total || 0), 0);
    const lastOrderDate = ordersForStats[0]?.created_at ? new Date(ordersForStats[0].created_at) : null;
    const daysSinceLastOrder = lastOrderDate ? Math.floor((Date.now() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24)) : null;
    const avgOrder = totalOrders > 0 ? totalSpent / totalOrders : 0;
    const totalSamples = ordersForStats.filter((order) => order.include_samples).length;

    const orderDates = ordersForStats.map((order) => new Date(order.created_at).getTime()).sort((a, b) => b - a);
    const gaps = orderDates.slice(0, -1).map((date, index) => Math.max(0, (date - orderDates[index + 1]) / (1000 * 60 * 60 * 24)));
    const avgDaysBetween = gaps.length > 0 ? gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length : null;

    return { totalOrders, totalSpent, lastOrderDate, daysSinceLastOrder, avgOrder, totalSamples, avgDaysBetween };
  }, [ordersForStats]);

  const skuStats = useMemo(() => buildSkuStats(ordersForStats).slice(0, 6), [ordersForStats]);
  const quarterPoints = useMemo(() => buildQuarterPoints(ordersForStats).slice(-6), [ordersForStats]);
  const retailerSuccessProfile = useMemo(
    () => getRetailerSuccessProfile(retailer || {}, ordersForStats, successProfileRow),
    [retailer, ordersForStats, successProfileRow],
  );
  const retailerLifecycleStatus = useMemo(
    () => getRetailerLifecycleStatus({
      totalOrders: retailerSuccessProfile.totalOrders,
      totalSpend: retailerSuccessProfile.totalSpend,
      firstOrderDate: retailerSuccessProfile.firstOrderDate,
      lastOrderDate: retailerSuccessProfile.lastOrderDate,
      accountCreatedAt: retailer?.created_at,
    }),
    [retailer?.created_at, retailerSuccessProfile],
  );
  const retailerChecklist = useMemo(
    () => getRetailerSuccessChecklist(retailer, retailerSuccessProfile, currentPromo),
    [retailer, retailerSuccessProfile, currentPromo],
  );
  const retailerSuccessProgress = useMemo(
    () => calculateSuccessPlanProgress(retailerChecklist),
    [retailerChecklist],
  );
  const retailerRecommendedNextStep = useMemo(
    () => getRecommendedNextStep(retailer, retailerSuccessProfile, currentPromo),
    [retailer, retailerSuccessProfile, currentPromo],
  );
  const shelfTalkerAdoption = useMemo<ShelfTalkerAdoptionRow[]>(() => {
    const orderedProducts = ordersForStats.flatMap((order) =>
      (order.order_items || [])
        .map((item) => item.product)
        .filter(Boolean)
    ) as Array<{ name?: string | null; size?: string | null }>;
    const qualifiedFlavors = new Set(getQualifiedShelfTalkerFlavors(orderedProducts));

    return (['chicken', 'salmon', 'beef'] as ShelfTalkerFlavor[]).map((flavor) => ({
      flavor,
      qualified: qualifiedFlavors.has(flavor),
      fulfillment: shelfTalkerFulfillments.find((talker) => talker.flavor === flavor && talker.status !== 'skipped'),
    }));
  }, [ordersForStats, shelfTalkerFulfillments]);

  const trend = useMemo(() => {
    if (quarterPoints.length < 2) return null;
    const latest = quarterPoints[quarterPoints.length - 1];
    const previous = quarterPoints[quarterPoints.length - 2];
    const change = previous.average === 0 ? 0 : ((latest.average - previous.average) / previous.average) * 100;
    return { change, latest, previous };
  }, [quarterPoints]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-bark-500"></div></div>;
  }

  if (error || !retailer) {
    return (
      <div className="space-y-6">
        <Link href="/admin/retailers" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-bark-600">
          <ArrowLeft className="w-4 h-4" /> Back to Retailers
        </Link>
        <div className="bg-white rounded-xl border border-gray-100 p-6 text-gray-600">{error || 'Retailer not found.'}</div>
      </div>
    );
  }

  const topSkuMax = Math.max(...skuStats.map((sku) => sku.quantity), 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/admin/retailers" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-bark-600">
            <ArrowLeft className="w-4 h-4" /> Back to Retailers
          </Link>
          <h1 className="text-2xl font-semibold text-gray-900 mt-2">{retailer.company_name}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mt-1">
            <span className="font-mono">{retailer.account_number}</span>
            <span>Joined {new Date(retailer.created_at).toLocaleDateString()}</span>
            {retailer.status && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 capitalize">{retailer.status}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {retailer.pipedrive_deal_id ? (
            <>
              <a
                href={getPipedriveDealUrl(retailer.pipedrive_deal_id)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-bark-200 text-bark-700 bg-white hover:bg-bark-50"
                title={retailer.pipedrive_stage_name ? `Pipedrive stage: ${retailer.pipedrive_stage_name}` : 'Open linked Pipedrive deal'}
              >
                Open Pipedrive
                <ArrowUpRight className="w-4 h-4" />
              </a>
              <button
                type="button"
                onClick={unlinkPipedriveDeal}
                disabled={isUnlinkingPipedriveDeal}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                title="Remove this portal's linked Pipedrive deal"
              >
                {isUnlinkingPipedriveDeal ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
                Unlink
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={openPipedriveLinkModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-bark-200 text-bark-700 bg-white hover:bg-bark-50"
            >
              Link Pipedrive deal
              <Plus className="w-4 h-4" />
            </button>
          )}
          <Link href="/admin/orders" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50">
            View all orders
            <ArrowUpRight className="w-4 h-4" />
          </Link>
          <button
            type="button"
            onClick={deleteRetailer}
            disabled={isDeletingRetailer || orders.length > 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400 disabled:hover:bg-transparent"
            title={orders.length > 0 ? 'Retailers with order history cannot be deleted' : 'Delete this retailer account'}
          >
            {isDeletingRetailer ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="md:col-span-2 bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500">Days Since Last Order</p>
              <p className="text-3xl font-semibold text-gray-900 mt-2">
                {orderStats.daysSinceLastOrder === null ? '—' : `${orderStats.daysSinceLastOrder} days`}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {orderStats.lastOrderDate ? `Last order on ${orderStats.lastOrderDate.toLocaleDateString()}` : 'No orders yet'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-bark-100 flex items-center justify-center text-bark-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Orders</p>
              <p className="text-2xl font-semibold text-gray-900 mt-2">{orderStats.totalOrders}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
              <ClipboardList className="w-5 h-5" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Lifetime Spend</p>
              <p className="text-2xl font-semibold text-gray-900 mt-2">{formatCurrency(orderStats.totalSpent)}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
              <LineChart className="w-5 h-5" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Samples Sent</p>
              <p className="text-2xl font-semibold text-gray-900 mt-2">{orderStats.totalSamples}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
              <Package className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-bark-600" />
              <h2 className="text-lg font-semibold text-gray-900">Retailer Success Status</h2>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Shared activation profile for dashboard guidance and admin adoption visibility.
            </p>
          </div>
          <div className="text-left lg:text-right">
            <p className="text-sm text-gray-500">Recommended next action</p>
            <p className="font-semibold text-gray-900">{retailerRecommendedNextStep.headline}</p>
          </div>
        </div>

        {successNotice && (
          <div className="mt-4 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm px-3 py-2">
            {successNotice}
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-400">Pipedrive Deal</p>
            {retailer.pipedrive_deal_id ? (
              <>
                <a
                  href={getPipedriveDealUrl(retailer.pipedrive_deal_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 font-semibold text-bark-700 hover:text-bark-800"
                >
                  Deal #{retailer.pipedrive_deal_id}
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
                {retailer.pipedrive_stage_name && (
                  <p className="mt-1 text-xs text-gray-500">{retailer.pipedrive_stage_name}</p>
                )}
                <button
                  type="button"
                  onClick={unlinkPipedriveDeal}
                  disabled={isUnlinkingPipedriveDeal}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-red-600 disabled:opacity-50"
                  title="Remove this portal's linked Pipedrive deal"
                >
                  {isUnlinkingPipedriveDeal ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
                  Unlink deal
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={openPipedriveLinkModal}
                className="mt-1 inline-flex items-center gap-1 font-semibold text-bark-700 hover:text-bark-800"
              >
                Link deal
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-400">Lifecycle Status</p>
            <p className="mt-1 font-semibold text-gray-900 capitalize">{retailerLifecycleStatus.replace(/_/g, ' ')}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-400">Success Plan Progress</p>
            <p className="mt-1 font-semibold text-gray-900">{retailerSuccessProgress.percentage}%</p>
            <div className="mt-2 h-2 rounded-full bg-gray-200 overflow-hidden">
              <div className="h-full rounded-full bg-bark-500" style={{ width: `${retailerSuccessProgress.percentage}%` }} />
            </div>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-400">Last Order Date</p>
            <p className="mt-1 font-semibold text-gray-900">
              {retailerSuccessProfile.lastOrderDate ? new Date(retailerSuccessProfile.lastOrderDate).toLocaleDateString() : 'No orders yet'}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-400">Total Orders</p>
            <p className="mt-1 font-semibold text-gray-900">{retailerSuccessProfile.totalOrders}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <label className="rounded-lg border border-gray-100 p-4">
            <span className="block text-sm font-medium text-gray-700 mb-2">Samples acknowledged</span>
            <select
              value={retailerSuccessProfile.samplesAcknowledged ? 'yes' : 'no'}
              disabled={isSavingSuccess}
              onChange={(event) => updateAdminSuccessProfile({ samples_acknowledged: event.target.value === 'yes' })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500"
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </label>
          <label className="rounded-lg border border-gray-100 p-4">
            <span className="block text-sm font-medium text-gray-700 mb-2">Astro enrolled</span>
            <select
              value={retailerSuccessProfile.astroEnrolled ? 'yes' : 'no'}
              disabled={isSavingSuccess}
              onChange={(event) => updateAdminSuccessProfile({ astro_enrolled: event.target.value === 'yes' })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500"
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </label>
          <label className="rounded-lg border border-gray-100 p-4">
            <span className="block text-sm font-medium text-gray-700 mb-2">Marketing materials status</span>
            <select
              value={retailerSuccessProfile.marketingMaterialsStatus}
              disabled={isSavingSuccess}
              onChange={(event) => updateAdminSuccessProfile({ marketing_materials_status: event.target.value as MarketingMaterialsStatus })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500"
            >
              <option value="not_requested">Not requested</option>
              <option value="have_materials">Has materials</option>
              <option value="requested">Requested</option>
              <option value="sent">Sent</option>
            </select>
          </label>
          <div className="rounded-lg border border-gray-100 p-4">
            <span className="block text-sm font-medium text-gray-700 mb-2">Treats ordered</span>
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <CheckCircle className={cn('w-4 h-4', retailerSuccessProfile.hasOrderedTreats ? 'text-emerald-600' : 'text-gray-300')} />
              {retailerSuccessProfile.hasOrderedTreats ? 'Yes' : 'No'}
            </div>
            <p className="text-xs text-gray-500 mt-2">Derived from order history.</p>
          </div>
          <label className="rounded-lg border border-gray-100 p-4">
            <span className="block text-sm font-medium text-gray-700 mb-2">Shelf placement status</span>
            <select
              value={retailerSuccessProfile.shelfPlacementStatus}
              disabled={isSavingSuccess}
              onChange={(event) => updateAdminSuccessProfile({ shelf_placement_status: event.target.value as ShelfPlacementStatus })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500"
            >
              <option value="not_set">Not set</option>
              <option value="front_counter">Front counter</option>
              <option value="end_cap">End cap</option>
              <option value="kibble_aisle">Kibble aisle</option>
              <option value="raw_freeze_dried_section">Raw/freeze-dried section</option>
              <option value="other">Other</option>
            </select>
          </label>
          {currentPromo.promoVisible && (
            <label className="rounded-lg border border-gray-100 p-4">
              <span className="block text-sm font-medium text-gray-700 mb-2">Current promo status</span>
              <select
                value={retailerSuccessProfile.currentPromoStatus}
                disabled={isSavingSuccess}
                onChange={(event) => updateAdminSuccessProfile({ current_promo_status: event.target.value as CurrentPromoStatus })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500"
              >
                <option value="not_started">Not started</option>
                <option value="opted_in">Opted in</option>
                <option value="not_this_time">Not this time</option>
              </select>
            </label>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Shelf Talker Adoption</h2>
            <p className="text-sm text-gray-500">Auto-tracked from stores carrying both 6 oz and 12 oz toppers.</p>
          </div>
          <div className="text-sm text-gray-500">
            {shelfTalkerAdoption.filter((row) => row.fulfillment?.status === 'sent').length} of 3 sent
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {shelfTalkerAdoption.map((row) => {
            const status = row.fulfillment?.status;
            const statusLabel = status === 'sent'
              ? 'Sent'
              : status === 'queued'
                ? 'Queued'
                : row.qualified
                  ? 'Qualifies'
                  : 'Not qualified';

            return (
              <div key={row.flavor} className="rounded-lg border border-gray-100 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-gray-900">{formatShelfTalkerFlavor(row.flavor)}</p>
                  <span className={cn(
                    'px-2.5 py-0.5 rounded-full text-xs font-medium',
                    status === 'sent' && 'bg-emerald-100 text-emerald-700',
                    status === 'queued' && 'bg-orange-100 text-orange-700',
                    !status && row.qualified && 'bg-blue-100 text-blue-700',
                    !status && !row.qualified && 'bg-gray-100 text-gray-600'
                  )}>
                    {statusLabel}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {status === 'sent' && row.fulfillment?.fulfilled_at
                    ? `Sent ${new Date(row.fulfillment.fulfilled_at).toLocaleDateString()}`
                    : status === 'queued'
                      ? 'Will be included with the queued order.'
                      : row.qualified
                        ? 'Will be added automatically to the next order.'
                        : 'Needs both sizes in order history.'}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm lg:col-span-1">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Business Info</h2>
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-gray-500">Business Address</p>
              <p className="text-gray-900 font-medium mt-1">{retailer.business_address}</p>
            </div>
            <div>
              <p className="text-gray-500">Phone</p>
              <p className="text-gray-900 font-medium mt-1">{retailer.phone}</p>
            </div>
            <div>
              <p className="text-gray-500">Email</p>
              {retailer.email ? (
                <a href={`mailto:${retailer.email}`} className="text-gray-900 font-medium mt-1 break-words hover:text-bark-600">
                  {retailer.email}
                </a>
              ) : (
                <p className="text-gray-900 font-medium mt-1">—</p>
              )}
            </div>
            <div>
              <p className="text-gray-500">Avg Order Value</p>
              <p className="text-gray-900 font-medium mt-1">{formatCurrency(orderStats.avgOrder)}</p>
            </div>
            <div>
              <p className="text-gray-500">Avg Days Between Orders</p>
              <p className="text-gray-900 font-medium mt-1">
                {orderStats.avgDaysBetween === null ? '—' : `${Math.round(orderStats.avgDaysBetween)} days`}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Order Growth</h2>
              <p className="text-sm text-gray-500">Average order value by quarter</p>
            </div>
            {trend && (
              <div className={cn("flex items-center gap-1 text-sm font-medium", trend.change >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                {trend.change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {Math.abs(trend.change).toFixed(1)}% vs prior quarter
              </div>
            )}
          </div>
          <OrdersLineChart points={quarterPoints} />
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Credits</h2>
            <p className="text-sm text-gray-500">Issue return credits and track how they are applied to future orders.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-gray-400">Available Balance</p>
              <p className="text-lg font-semibold text-emerald-700">{formatCurrency(availableCreditBalance)}</p>
            </div>
            <button
              onClick={() => setShowAddCredit(true)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              <Plus className="w-4 h-4" />
              Issue Credit
            </button>
          </div>
        </div>

        {creditNotice && (
          <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm px-3 py-2">
            {creditNotice}
          </div>
        )}

        {showAddCredit && (
          <div className="mb-6 rounded-lg border border-gray-100 bg-gray-50 p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <input
                  type="text"
                  value={newCredit.reason}
                  onChange={(e) => setNewCredit((prev) => ({ ...prev, reason: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500"
                  placeholder="Return credit"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  value={newCredit.notes}
                  onChange={(e) => setNewCredit((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500"
                  placeholder="Explain the return or adjustment"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  checked={newCredit.mode === 'sku'}
                  onChange={() => setNewCredit((prev) => ({ ...prev, mode: 'sku', customAmount: '' }))}
                  className="h-4 w-4 border-gray-300 text-bark-500 focus:ring-bark-500"
                />
                Credit specific SKU(s)
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  checked={newCredit.mode === 'custom'}
                  onChange={() => setNewCredit((prev) => ({ ...prev, mode: 'custom' }))}
                  className="h-4 w-4 border-gray-300 text-bark-500 focus:ring-bark-500"
                />
                Enter custom amount
              </label>
            </div>

            {newCredit.mode === 'sku' ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-900">Credited SKUs</h4>
                  <button onClick={handleAddCreditItem} className="text-sm text-bark-500 hover:text-bark-600 font-medium">
                    + Add SKU
                  </button>
                </div>

                {newCredit.items.map((item, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                    <div className="md:col-span-7">
                      <select
                        value={item.productId}
                        onChange={(e) => handleUpdateCreditItem(index, 'productId', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500"
                      >
                        <option value="">Select product</option>
                        {creditProducts.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name} ({product.size}) - ${Number(product.price).toFixed(2)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-3">
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => handleUpdateCreditItem(index, 'quantity', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500"
                      />
                    </div>
                    <div className="md:col-span-2 flex justify-end">
                      {newCredit.items.length > 1 && (
                        <button
                          onClick={() => handleRemoveCreditItem(index)}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-200 text-red-600 rounded-lg hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Custom Credit Amount</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={newCredit.customAmount}
                  onChange={(e) => setNewCredit((prev) => ({ ...prev, customAmount: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500"
                  placeholder="48.00"
                />
                <p className="text-xs text-gray-500 mt-2">Use this for Astro rebates or any other fixed dollar credit.</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-gray-200 pt-4">
              <div>
                <p className="text-sm text-gray-500">Credit Total</p>
                <p className="text-lg font-semibold text-gray-900">{formatCurrency(newCredit.mode === 'custom' ? manualCreditTotal : newCreditTotal)}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => {
                    setShowAddCredit(false);
                    setNewCredit({
                      mode: 'sku',
                      reason: 'Return credit',
                      notes: '',
                      customAmount: '',
                      items: [{ productId: '', quantity: 1 }],
                    });
                  }}
                  className="inline-flex items-center justify-center px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateCredit}
                  disabled={isSavingCredit}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-bark-500 text-white rounded-lg hover:bg-bark-600 disabled:opacity-50"
                >
                  {isSavingCredit ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Credit'}
                </button>
              </div>
            </div>
          </div>
        )}

        {creditsLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-bark-500" />
          </div>
        ) : credits.length === 0 ? (
          <p className="text-sm text-gray-500">No credits issued yet.</p>
        ) : (
          <div className="space-y-3">
            {credits.map((credit) => (
              <div key={credit.id} className="rounded-lg border border-gray-100 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-gray-900">{credit.reason}</p>
                      <span className={cn(
                        'px-2.5 py-0.5 rounded-full text-xs font-medium capitalize',
                        credit.status === 'available' && 'bg-emerald-100 text-emerald-700',
                        credit.status === 'partially_applied' && 'bg-amber-100 text-amber-700',
                        credit.status === 'fully_applied' && 'bg-gray-100 text-gray-700',
                        credit.status === 'voided' && 'bg-rose-100 text-rose-700'
                      )}>
                        {credit.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Issued {new Date(credit.created_at).toLocaleDateString()}
                    </p>
                    {credit.notes && (
                      <p className="text-sm text-gray-600 mt-2">{credit.notes}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Remaining</p>
                    <p className="font-semibold text-gray-900">{formatCurrency(Number(credit.remaining_amount || 0))}</p>
                    <p className="text-xs text-gray-500">of {formatCurrency(Number(credit.total_amount || 0))}</p>
                    {credit.status !== 'voided' && (
                      <button
                        onClick={() => handleRemoveCredit(credit)}
                        disabled={isRemovingCreditId === credit.id}
                        className="mt-3 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
                      >
                        {isRemovingCreditId === credit.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Credited Items</p>
                    <div className="space-y-2">
                      {credit.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-sm">
                          <span className="text-gray-700">
                            {item.product_name} {item.product_size ? `(${item.product_size})` : ''} x {item.quantity}
                          </span>
                          <span className="font-medium text-gray-900">{formatCurrency(Number(item.total_amount || 0))}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Applications</p>
                    {credit.applications?.length ? (
                      <div className="space-y-2">
                        {credit.applications.map((application) => (
                          <div key={application.id} className="flex items-center justify-between text-sm">
                            <span className="text-gray-700">
                              Applied to {application.order?.order_number || 'order'} on{' '}
                              {new Date(application.created_at).toLocaleDateString()}
                            </span>
                            <span className="font-medium text-gray-900">
                              -{formatCurrency(Number(application.applied_amount || 0))}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">Not applied yet.</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Locations</h2>
            <p className="text-sm text-gray-500">Manage ship-to locations for this retailer.</p>
          </div>
          <button onClick={() => setShowAddLocation(true)} className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50">
            <Plus className="w-4 h-4" />
            Add Location
          </button>
        </div>

        {locationNotice && (
          <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm px-3 py-2">
            {locationNotice}
          </div>
        )}

        {showAddLocation && (
          <div className="mb-6 rounded-lg border border-gray-100 bg-gray-50 p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location Name</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500"
                  value={newLocation.location_name}
                  onChange={(e) => setNewLocation({ ...newLocation, location_name: e.target.value })}
                  placeholder="Warehouse, Storefront, etc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone (Optional)</label>
                <input
                  type="tel"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500"
                  value={newLocation.phone}
                  onChange={(e) => setNewLocation({ ...newLocation, phone: e.target.value })}
                  placeholder="(555) 555-5555"
                  autoComplete="tel"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Address</label>
                <div className="space-y-3">
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500"
                    value={newLocation.businessStreet}
                    onChange={(e) => setNewLocation({ ...newLocation, businessStreet: e.target.value })}
                    placeholder="123 Main St"
                    autoComplete="shipping address-line1"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500"
                      value={newLocation.businessCity}
                      onChange={(e) => setNewLocation({ ...newLocation, businessCity: e.target.value })}
                      placeholder="City"
                      autoComplete="shipping address-level2"
                    />
                    <input
                      type="text"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500"
                      value={newLocation.businessState}
                      onChange={(e) => setNewLocation({ ...newLocation, businessState: e.target.value })}
                      placeholder="State"
                      autoComplete="shipping address-level1"
                    />
                    <input
                      type="text"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500"
                      value={newLocation.businessZip}
                      onChange={(e) => setNewLocation({ ...newLocation, businessZip: e.target.value })}
                      placeholder="ZIP"
                      autoComplete="shipping postal-code"
                      inputMode="numeric"
                    />
                  </div>
                </div>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={newLocation.makeDefault}
                onChange={(e) => setNewLocation({ ...newLocation, makeDefault: e.target.checked })}
                className="rounded border-gray-300 text-bark-500 focus:ring-bark-500"
              />
              Make this the default ship-to location
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <button onClick={handleAddLocation} disabled={isSavingLocation} className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-bark-500 text-white rounded-lg hover:bg-bark-600 disabled:opacity-50">
                {isSavingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Location'}
              </button>
              <button
                onClick={() => {
                  setShowAddLocation(false);
                  setNewLocation({
                    location_name: '',
                    businessStreet: '',
                    businessCity: '',
                    businessState: '',
                    businessZip: '',
                    phone: '',
                    makeDefault: false,
                  });
                }}
                className="inline-flex items-center justify-center px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {locations.length === 0 ? (
          <p className="text-sm text-gray-500">No ship-to locations on file.</p>
        ) : (
          <div className="space-y-3">
            {locations.map((location) => (
              <div key={location.id} className="flex flex-col gap-3 p-3 rounded-lg border border-gray-100">
                {editLocationId === location.id ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Location Name</label>
                        <input
                          type="text"
                          className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500"
                          value={editLocation.location_name}
                          onChange={(e) => setEditLocation({ ...editLocation, location_name: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone (Optional)</label>
                        <input
                          type="tel"
                          className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500"
                          value={editLocation.phone}
                          onChange={(e) => setEditLocation({ ...editLocation, phone: e.target.value })}
                          autoComplete="tel"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Business Address</label>
                        <div className="space-y-3">
                          <input
                            type="text"
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500"
                            value={editLocation.businessStreet}
                            onChange={(e) => setEditLocation({ ...editLocation, businessStreet: e.target.value })}
                            autoComplete="shipping address-line1"
                          />
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <input
                              type="text"
                              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500"
                              value={editLocation.businessCity}
                              onChange={(e) => setEditLocation({ ...editLocation, businessCity: e.target.value })}
                              placeholder="City"
                              autoComplete="shipping address-level2"
                            />
                            <input
                              type="text"
                              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500"
                              value={editLocation.businessState}
                              onChange={(e) => setEditLocation({ ...editLocation, businessState: e.target.value })}
                              placeholder="State"
                              autoComplete="shipping address-level1"
                            />
                            <input
                              type="text"
                              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500"
                              value={editLocation.businessZip}
                              onChange={(e) => setEditLocation({ ...editLocation, businessZip: e.target.value })}
                              placeholder="ZIP"
                              autoComplete="shipping postal-code"
                              inputMode="numeric"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button onClick={handleUpdateLocation} disabled={isSavingLocation} className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-bark-500 text-white rounded-lg hover:bg-bark-600 disabled:opacity-50">
                        {isSavingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                      </button>
                      <button onClick={() => setEditLocationId(null)} className="inline-flex items-center justify-center px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{location.location_name}</p>
                        {location.is_default && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            <Star className="w-3 h-3" />
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{location.business_address}</p>
                      {location.phone && (
                        <p className="text-sm text-gray-500">{location.phone}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!location.is_default && (
                        <button
                          onClick={() => handleSetDefaultLocation(location.id)}
                          disabled={isSettingDefaultId === location.id}
                          className="inline-flex items-center justify-center px-3 py-1.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                        >
                          {isSettingDefaultId === location.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Make Default'}
                        </button>
                      )}
                      <button
                        onClick={() => handleEditLocation(location)}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteLocation(location)}
                        disabled={isDeletingLocationId === location.id}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 border border-gray-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
                      >
                        {isDeletingLocationId === location.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top SKUs</h2>
          {skuStats.length === 0 ? (
            <p className="text-sm text-gray-500">No order items yet.</p>
          ) : (
            <div className="space-y-3">
              {skuStats.map((sku) => (
                <div key={sku.label} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{sku.label}</span>
                    <span className="text-gray-900 font-medium">{sku.quantity}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-bark-500" style={{ width: `${Math.round((sku.quantity / topSkuMax) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Order History</h2>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Calendar className="w-4 h-4" />
              {orders.length} orders
            </div>
          </div>
          {orders.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-10">No orders yet.</p>
          ) : (
            <div className="space-y-2">
              {orders.map((order) => (
                <Link key={order.id} href={`/admin/orders?order=${order.id}`} className="flex items-center justify-between gap-4 p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
                  <div>
                    <p className="font-medium text-gray-900">{order.order_number}</p>
                    <p className="text-sm text-gray-500">{new Date(order.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {order.include_samples && <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Samples</span>}
                    {order.include_marketing_materials && <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">{formatMarketingMaterialsLabel(order.marketing_materials_type)}</span>}
                    {Boolean(order.shelf_talker_fulfillments?.length) && <span className="text-xs font-medium text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">Shelf Talkers</span>}
                    {Number(order.credit_applied || 0) > 0 && <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">Credit</span>}
                    <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium capitalize", getStatusColor(order.status))}>{order.status}</span>
                    <span className="font-medium text-gray-900">{formatCurrency(order.total)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {showPipedriveLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Link Pipedrive deal</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Search Pipedrive and choose the deal that belongs to {retailer.company_name}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPipedriveLinkModal(false)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={pipedriveDealQuery}
                    onChange={(event) => setPipedriveDealQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') searchPipedriveDeals();
                    }}
                    placeholder="Search by retailer or deal name..."
                    className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-bark-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={searchPipedriveDeals}
                  disabled={isSearchingPipedriveDeals}
                  className="inline-flex items-center justify-center rounded-lg bg-bark-500 px-4 py-2 text-sm font-medium text-white hover:bg-bark-600 disabled:opacity-50"
                >
                  {isSearchingPipedriveDeals ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
                </button>
              </div>

              {pipedriveLinkError && (
                <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {pipedriveLinkError}
                </div>
              )}

              <div className="max-h-80 overflow-y-auto rounded-lg border border-gray-100">
                {pipedriveDealResults.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-gray-500">
                    Search results will appear here.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {pipedriveDealResults.map((deal) => (
                      <div key={deal.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{deal.title}</p>
                          <p className="mt-1 text-xs text-gray-500">
                            Deal #{deal.id}
                            {deal.stageName ? ` - ${deal.stageName}` : ''}
                            {deal.ownerName ? ` - ${deal.ownerName}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <a
                            href={getPipedriveDealUrl(deal.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-gray-500 hover:text-bark-600"
                          >
                            Preview
                          </a>
                          <button
                            type="button"
                            onClick={() => linkPipedriveDeal(deal)}
                            disabled={isLinkingPipedriveDeal}
                            className="rounded-lg border border-bark-200 px-3 py-2 text-sm font-medium text-bark-700 hover:bg-bark-50 disabled:opacity-50"
                          >
                            {isLinkingPipedriveDeal ? 'Linking...' : 'Link deal'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
