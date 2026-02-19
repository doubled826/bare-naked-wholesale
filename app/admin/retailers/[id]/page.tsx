'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { ArrowLeft, ArrowUpRight, Calendar, ClipboardList, Clock, LineChart, Package, TrendingDown, TrendingUp, Plus, Edit2, Trash2, Loader2, Star } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

interface Retailer {
  id: string;
  company_name: string;
  business_address: string;
  phone: string;
  account_number: string;
  status?: string;
  created_at: string;
}

interface OrderItem {
  id: string;
  quantity: number;
  total_price: number;
  product: { name: string; size: string } | { name: string; size: string }[] | null;
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  total: number;
  subtotal: number;
  include_samples?: boolean | null;
  created_at: string;
  order_items: OrderItem[];
}

interface RetailerLocation {
  id: string;
  location_name: string;
  business_address: string;
  phone: string | null;
  is_default: boolean;
  created_at: string;
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
  const retailerId = params?.id;

  const [retailer, setRetailer] = useState<Retailer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [locations, setLocations] = useState<RetailerLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [newLocation, setNewLocation] = useState({
    location_name: '',
    business_address: '',
    phone: '',
    makeDefault: false,
  });
  const [editLocationId, setEditLocationId] = useState<string | null>(null);
  const [editLocation, setEditLocation] = useState({
    location_name: '',
    business_address: '',
    phone: '',
  });
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [isDeletingLocationId, setIsDeletingLocationId] = useState<string | null>(null);
  const [isSettingDefaultId, setIsSettingDefaultId] = useState<string | null>(null);
  const [locationNotice, setLocationNotice] = useState('');

  const showLocationNotice = (message: string) => {
    setLocationNotice(message);
    setTimeout(() => setLocationNotice(''), 3000);
  };

  const fetchData = async () => {
      if (!retailerId) return;
      setIsLoading(true);
      setError('');
      try {
        const [
          { data: retailerData, error: retailerError },
          { data: ordersData, error: ordersError },
          { data: locationsData, error: locationsError },
        ] = await Promise.all([
          supabase.from('retailers').select('id, company_name, business_address, phone, account_number, status, created_at').eq('id', retailerId).single(),
          supabase.from('orders').select('id, order_number, status, total, subtotal, include_samples, created_at, order_items(id, quantity, total_price, product:products(name, size))').eq('retailer_id', retailerId).order('created_at', { ascending: false }),
          supabase.from('retailer_locations').select('id, location_name, business_address, phone, is_default, created_at').eq('retailer_id', retailerId).order('is_default', { ascending: false }).order('created_at', { ascending: true }),
        ]);

        if (retailerError) throw retailerError;
        if (ordersError) throw ordersError;
        if (locationsError) throw locationsError;

        setRetailer(retailerData);
        setOrders(normalizeOrders((ordersData || []) as Order[]));
        setLocations((locationsData || []) as RetailerLocation[]);
      } catch (fetchError) {
        console.error('Error loading retailer details:', fetchError);
        setError('Unable to load retailer details.');
      } finally {
        setIsLoading(false);
      }
    };

  };

  useEffect(() => {
    fetchData();
  }, [retailerId, supabase]);

  const handleAddLocation = async () => {
    if (!retailerId) return;
    if (!newLocation.location_name.trim() || !newLocation.business_address.trim()) {
      showLocationNotice('Location name and address are required.');
      return;
    }

    setIsSavingLocation(true);
    try {
      const shouldBeDefault = newLocation.makeDefault || locations.length === 0;
      const { data: insertedLocation, error: insertError } = await supabase
        .from('retailer_locations')
        .insert({
          retailer_id: retailerId,
          location_name: newLocation.location_name.trim(),
          business_address: newLocation.business_address.trim(),
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

      setNewLocation({ location_name: '', business_address: '', phone: '', makeDefault: false });
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
    setEditLocationId(location.id);
    setEditLocation({
      location_name: location.location_name,
      business_address: location.business_address,
      phone: location.phone || '',
    });
  };

  const handleUpdateLocation = async () => {
    if (!editLocationId) return;
    if (!editLocation.location_name.trim() || !editLocation.business_address.trim()) {
      showLocationNotice('Location name and address are required.');
      return;
    }

    setIsSavingLocation(true);
    try {
      const { error: updateError } = await supabase
        .from('retailer_locations')
        .update({
          location_name: editLocation.location_name.trim(),
          business_address: editLocation.business_address.trim(),
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
          <Link href="/admin/orders" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50">
            View all orders
            <ArrowUpRight className="w-4 h-4" />
          </Link>
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
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Address</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500"
                  value={newLocation.business_address}
                  onChange={(e) => setNewLocation({ ...newLocation, business_address: e.target.value })}
                  placeholder="123 Main St, City, State ZIP"
                />
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
                  setNewLocation({ location_name: '', business_address: '', phone: '', makeDefault: false });
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
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Business Address</label>
                        <input
                          type="text"
                          className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500"
                          value={editLocation.business_address}
                          onChange={(e) => setEditLocation({ ...editLocation, business_address: e.target.value })}
                        />
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
                    <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium capitalize", getStatusColor(order.status))}>{order.status}</span>
                    <span className="font-medium text-gray-900">{formatCurrency(order.total)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
