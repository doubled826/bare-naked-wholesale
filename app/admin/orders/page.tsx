'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Search, Truck, Package, Download, X, CheckCircle, Eye, Plus, Trash2 } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';

interface OrderItem { id: string; quantity: number; unit_price: number; total_price: number; product: { name: string; size: string } }
interface Order { id: string; retailer_id: string; order_number: string; status: string; total: number; subtotal: number; delivery_date: string | null; tracking_number: string | null; tracking_carrier?: string | null; include_samples?: boolean | null; promotion_code: string | null; invoice_url?: string | null; invoice_sent_at?: string | null; invoice_sent_count?: number | null; created_at: string; shipped_at: string | null; retailer: { id: string; company_name: string; business_address: string; phone: string }; location?: { id: string; location_name: string; business_address: string; phone: string | null } | null; order_items: OrderItem[] }
interface RetailerOption { id: string; company_name: string }
interface ProductOption { id: string; name: string; size: string; price: number }
interface LocationOption { id: string; location_name: string; business_address: string; phone: string | null; is_default: boolean }

const normalizeText = (value?: string) => (value || '').toLowerCase().trim();
const normalizeSize = (value?: string) => normalizeText(value).replace(/\s+/g, '');
const sizeStartsWith = (value: string, target: '6' | '12') => value.startsWith(target);

const getAdminOrderItemSortIndex = (item: OrderItem) => {
  const name = normalizeText(item.product?.name);
  const size = normalizeSize(item.product?.size);

  if (name.includes('chicken') && sizeStartsWith(size, '6')) return 0;
  if (name.includes('chicken') && sizeStartsWith(size, '12')) return 1;
  if (name.includes('salmon') && sizeStartsWith(size, '6')) return 2;
  if (name.includes('salmon') && sizeStartsWith(size, '12')) return 3;
  if (name.includes('beef') && sizeStartsWith(size, '6')) return 4;
  if (name.includes('beef') && sizeStartsWith(size, '12')) return 5;
  if (name.includes('lamb')) return 6;
  if (name.includes('minnow')) return 7;
  if (name.includes('bison')) return 8;

  return 999;
};

export default function AdminOrdersPage() {
  const supabase = createClientComponentClient();
  const searchParams = useSearchParams();
  const orderParam = searchParams.get('order');
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [quickRange, setQuickRange] = useState<'today' | 'yesterday' | 'last7' | 'last30' | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingCarrier, setTrackingCarrier] = useState('UPS');
  const [invoiceUrl, setInvoiceUrl] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  const [notification, setNotification] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [retailers, setRetailers] = useState<RetailerOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [newOrder, setNewOrder] = useState({ retailerId: '', deliveryDate: '', promotionCode: '', locationId: '', includeSamples: false, items: [{ productId: '', quantity: 1 }] });
  const [isCreating, setIsCreating] = useState(false);
  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);

  useEffect(() => { fetchOrders(); fetchOptions(); }, []);
  useEffect(() => { filterOrders(); }, [orders, searchQuery, statusFilter, startDate, endDate]);
  useEffect(() => {
    if (!orderParam || orders.length === 0) return;
    const matchingOrder = orders.find((order) => order.id === orderParam);
    if (matchingOrder) setSelectedOrder(matchingOrder);
  }, [orderParam, orders]);

  useEffect(() => {
    const fetchLocationsForRetailer = async () => {
      if (!newOrder.retailerId) {
        setLocationOptions([]);
        setNewOrder((prev) => ({ ...prev, locationId: '' }));
        return;
      }

      setLocationsLoading(true);
      const { data, error } = await supabase
        .from('retailer_locations')
        .select('id, location_name, business_address, phone, is_default')
        .eq('retailer_id', newOrder.retailerId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading locations:', error);
        setLocationOptions([]);
        setLocationsLoading(false);
        return;
      }

      const nextLocations = (data || []) as LocationOption[];
      setLocationOptions(nextLocations);
      if (nextLocations.length > 0) {
        const defaultLocation = nextLocations.find((loc) => loc.is_default);
        setNewOrder((prev) => ({ ...prev, locationId: defaultLocation?.id || nextLocations[0].id }));
      } else {
        setNewOrder((prev) => ({ ...prev, locationId: '' }));
      }
      setLocationsLoading(false);
    };

    fetchLocationsForRetailer();
  }, [newOrder.retailerId, supabase]);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, retailer:retailers(id, company_name, business_address, phone), location:retailer_locations(id, location_name, business_address, phone), order_items(id, quantity, unit_price, total_price, product:products(name, size))')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setOrders(data || []);
      return data || [];
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
    return [];
  };

  const fetchOptions = async () => {
    try {
      const [{ data: retailersData }, { data: productsData }] = await Promise.all([
        supabase.from('retailers').select('id, company_name').order('company_name'),
        supabase.from('products').select('id, name, size, price').order('name')
      ]);
      setRetailers(retailersData || []);
      setProducts(productsData || []);
    } catch (error) {
      console.error('Error loading options:', error);
    }
  };

  const filterOrders = () => {
    let filtered = [...orders];
    if (searchQuery) { const q = searchQuery.toLowerCase(); filtered = filtered.filter(o => o.order_number.toLowerCase().includes(q) || o.retailer?.company_name?.toLowerCase().includes(q)); }
    if (statusFilter !== 'all') filtered = filtered.filter(o => o.status === statusFilter);
    if (startDate) filtered = filtered.filter(o => new Date(o.created_at) >= new Date(`${startDate}T00:00:00`));
    if (endDate) filtered = filtered.filter(o => new Date(o.created_at) <= new Date(`${endDate}T23:59:59.999`));
    setFilteredOrders(filtered);
  };

  const toLocalDateInput = (date: Date) => {
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 10);
  };

  const applyQuickRange = (range: 'today' | 'yesterday' | 'last7' | 'last30') => {
    const now = new Date();
    let start = new Date(now);
    let end = new Date(now);

    if (range === 'today') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }

    if (range === 'yesterday') {
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }

    if (range === 'last7') {
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }

    if (range === 'last30') {
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }

    setQuickRange(range);
    setStartDate(toLocalDateInput(start));
    setEndDate(toLocalDateInput(end));
  };

  const handleStartDateChange = (value: string) => {
    setQuickRange('');
    setStartDate(value);
  };

  const handleEndDateChange = (value: string) => {
    setQuickRange('');
    setEndDate(value);
  };

  const showNotification = (msg: string) => { setNotification(msg); setTimeout(() => setNotification(''), 3000); };

  const handleShipOrder = (order: Order) => { setSelectedOrder(order); setTrackingNumber(order.tracking_number || ''); setTrackingCarrier(order.tracking_carrier || 'UPS'); setShowTrackingModal(true); };

  const handleOpenOrderDetails = (order: Order) => {
    setSelectedOrder(order);
    setInvoiceUrl(order.invoice_url || '');
  };

  const confirmShipOrder = async () => {
    if (!selectedOrder) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase.from('orders').update({ status: 'shipped', tracking_number: trackingNumber || null, tracking_carrier: trackingCarrier || null, shipped_at: new Date().toISOString() }).eq('id', selectedOrder.id);
      if (error) throw error;
      await fetch('/api/admin/orders/ship-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          retailerId: selectedOrder.retailer_id,
          orderNumber: selectedOrder.order_number,
          trackingNumber: trackingNumber || null,
          trackingCarrier: trackingCarrier || null,
        }),
      });
      showNotification('Order marked as shipped!');
      setShowTrackingModal(false); setSelectedOrder(null); fetchOrders();
    } catch (error) { console.error('Error:', error); showNotification('Failed to update order'); }
    finally { setIsUpdating(false); }
  };

  const handleSendInvoice = async () => {
    if (!selectedOrder || !invoiceUrl) {
      showNotification('Add an invoice URL first');
      return;
    }
    setIsSendingInvoice(true);
    try {
      const response = await fetch('/api/admin/retailers/send-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: selectedOrder.id, invoiceUrl }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Failed to send invoice');
      showNotification('Invoice email sent!');
      const refreshedOrders = await fetchOrders();
      const refreshed = refreshedOrders.find((o: Order) => o.id === selectedOrder.id);
      if (refreshed) {
        setSelectedOrder(refreshed);
        setInvoiceUrl(refreshed.invoice_url || invoiceUrl);
      } else {
        setSelectedOrder({
          ...selectedOrder,
          invoice_url: invoiceUrl,
          invoice_sent_at: new Date().toISOString(),
          invoice_sent_count: (selectedOrder.invoice_sent_count || 0) + 1,
        });
      }
    } catch (error) {
      console.error('Send invoice error:', error);
      showNotification('Failed to send invoice');
    } finally {
      setIsSendingInvoice(false);
    }
  };

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
      if (error) throw error;
      showNotification(`Status updated to ${newStatus}`); fetchOrders();
    } catch (error) { console.error('Error:', error); showNotification('Failed to update status'); }
  };

  const exportToCSV = async () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (startDate) params.set('startDate', `${startDate}T00:00:00.000`);
    if (endDate) params.set('endDate', `${endDate}T23:59:59.999`);

    const response = await fetch(`/api/admin/export/orders?${params.toString()}`);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const handleAddItem = () => {
    setNewOrder((prev) => ({ ...prev, items: [...prev.items, { productId: '', quantity: 1 }] }));
  };

  const handleRemoveItem = (index: number) => {
    setNewOrder((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  };

  const handleUpdateItem = (index: number, key: 'productId' | 'quantity', value: string | number) => {
    setNewOrder((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    }));
  };

  const getProductPrice = (productId: string) => products.find((p) => p.id === productId)?.price || 0;

  const newOrderSubtotal = newOrder.items.reduce(
    (sum, item) => sum + getProductPrice(item.productId) * (Number(item.quantity) || 0),
    0
  );

  const handleCreateOrder = async () => {
    if (!newOrder.retailerId || newOrder.items.length === 0 || newOrder.items.some(item => !item.productId)) {
      showNotification('Select a retailer and at least one item');
      return;
    }
    setIsCreating(true);
    try {
      const response = await fetch('/api/admin/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          retailerId: newOrder.retailerId,
          deliveryDate: newOrder.deliveryDate || null,
          promotionCode: newOrder.promotionCode || null,
          includeSamples: Boolean(newOrder.includeSamples),
          locationId: newOrder.locationId || null,
          items: newOrder.items.map((item) => ({ productId: item.productId, quantity: Number(item.quantity) || 1 })),
        }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Failed to create order');
      showNotification('Order created!');
      setShowCreateModal(false);
      setNewOrder({ retailerId: '', deliveryDate: '', promotionCode: '', locationId: '', includeSamples: false, items: [{ productId: '', quantity: 1 }] });
      setLocationOptions([]);
      fetchOrders();
    } catch (error) {
      console.error('Create order error:', error);
      showNotification('Failed to create order');
    } finally {
      setIsCreating(false);
    }
  };

  const getStatusColor = (s: string) => { switch (s) { case 'pending': return 'bg-yellow-100 text-yellow-800'; case 'processing': return 'bg-blue-100 text-blue-800'; case 'shipped': return 'bg-purple-100 text-purple-800'; case 'delivered': return 'bg-green-100 text-green-800'; case 'canceled': return 'bg-red-100 text-red-800'; default: return 'bg-gray-100 text-gray-800'; } };

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-bark-500"></div></div>;

  return (
    <div className="space-y-6">
      {notification && <div className="fixed top-20 right-6 z-50 bg-white border border-gray-200 rounded-xl p-4 shadow-lg flex items-center gap-3"><CheckCircle className="w-5 h-5 text-emerald-600" /><span className="text-gray-900 font-medium">{notification}</span></div>}

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input type="text" placeholder="Search orders..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500" /></div>
          <div className="flex flex-wrap gap-2 items-center">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500"><option value="all">All Status</option><option value="pending">Pending</option><option value="processing">Processing</option><option value="shipped">Shipped</option><option value="delivered">Delivered</option><option value="canceled">Canceled</option></select>
            <div className="flex flex-wrap gap-2 items-center">
              <button onClick={() => applyQuickRange('today')} className={cn("px-3 py-2 rounded-lg text-sm border", quickRange === 'today' ? "bg-bark-500 text-white border-bark-500" : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200")}>Today</button>
              <button onClick={() => applyQuickRange('yesterday')} className={cn("px-3 py-2 rounded-lg text-sm border", quickRange === 'yesterday' ? "bg-bark-500 text-white border-bark-500" : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200")}>Yesterday</button>
              <button onClick={() => applyQuickRange('last7')} className={cn("px-3 py-2 rounded-lg text-sm border", quickRange === 'last7' ? "bg-bark-500 text-white border-bark-500" : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200")}>Last 7 Days</button>
              <button onClick={() => applyQuickRange('last30')} className={cn("px-3 py-2 rounded-lg text-sm border", quickRange === 'last30' ? "bg-bark-500 text-white border-bark-500" : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200")}>Last 30 Days</button>
              {(startDate || endDate) && (
                <button
                  onClick={() => { setQuickRange(''); setStartDate(''); setEndDate(''); }}
                  className="px-3 py-2 rounded-lg text-sm border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                >
                  Clear
                </button>
              )}
            </div>
            <input type="date" value={startDate} onChange={(e) => handleStartDateChange(e.target.value)} className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500" />
            <input type="date" value={endDate} onChange={(e) => handleEndDateChange(e.target.value)} className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500" />
            <button onClick={exportToCSV} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"><Download className="w-4 h-4" />Export CSV</button>
            <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 py-2 bg-bark-500 text-white rounded-lg hover:bg-bark-600"><Plus className="w-4 h-4" />Create Order</button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Retailer</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tracking</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {filteredOrders.length === 0 ? <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-500"><Package className="w-12 h-12 mx-auto mb-4 text-gray-300" /><p>No orders found</p></td></tr> : filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4"><span className="font-medium text-gray-900">{order.order_number}</span></td>
                  <td className="px-6 py-4"><div><p className="font-medium text-gray-900">{order.retailer?.company_name || 'Unknown'}</p><p className="text-sm text-gray-500 truncate max-w-[200px]">{order.retailer?.business_address}</p></div></td>
                  <td className="px-6 py-4"><div className="text-sm">{order.order_items?.slice(0, 2).map((item, i) => <p key={i} className="text-gray-600">{item.quantity}x {item.product?.name} ({item.product?.size})</p>)}{order.order_items?.length > 2 && <p className="text-gray-400">+{order.order_items.length - 2} more</p>}</div></td>
                  <td className="px-6 py-4"><select value={order.status} onChange={(e) => handleUpdateStatus(order.id, e.target.value)} className={cn("text-xs font-medium px-2.5 py-1 rounded-full border-0 cursor-pointer", getStatusColor(order.status))}><option value="pending">Pending</option><option value="processing">Processing</option><option value="shipped">Shipped</option><option value="delivered">Delivered</option><option value="canceled">Canceled</option></select></td>
                  <td className="px-6 py-4 font-medium text-gray-900">{formatCurrency(order.total)}</td>
                  <td className="px-6 py-4">
                    {order.tracking_number ? (
                      <div className="text-sm text-gray-600">
                        <div className="font-mono">{order.tracking_number}</div>
                        {order.tracking_carrier && (
                          <div className="text-xs text-gray-500">{order.tracking_carrier}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-500 text-sm">{new Date(order.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {order.include_samples && (
                        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">Samples</span>
                      )}
                      <button onClick={() => handleShipOrder(order)} className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg" title="Ship Order"><Truck className="w-4 h-4" /></button>
                      <button onClick={() => handleOpenOrderDetails(order)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg" title="View Details"><Eye className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Create Order</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Retailer</label>
                <select value={newOrder.retailerId} onChange={(e) => setNewOrder({ ...newOrder, retailerId: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500">
                  <option value="">Select retailer</option>
                  {retailers.map((retailer) => (
                    <option key={retailer.id} value={retailer.id}>{retailer.company_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ship-To Location</label>
                <select
                  value={newOrder.locationId}
                  onChange={(e) => setNewOrder({ ...newOrder, locationId: e.target.value })}
                  disabled={!newOrder.retailerId || locationsLoading || locationOptions.length === 0}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500 disabled:opacity-60"
                >
                  {!newOrder.retailerId && <option value="">Select a retailer first</option>}
                  {newOrder.retailerId && locationOptions.length === 0 && (
                    <option value="">No locations on file (uses retailer address)</option>
                  )}
                  {locationOptions.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.location_name} — {location.business_address}
                    </option>
                  ))}
                </select>
                {newOrder.retailerId && locationOptions.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Defaults to the retailer&apos;s primary ship-to location.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Date</label>
                  <input type="date" value={newOrder.deliveryDate} onChange={(e) => setNewOrder({ ...newOrder, deliveryDate: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Promotion Code</label>
                  <input type="text" value={newOrder.promotionCode} onChange={(e) => setNewOrder({ ...newOrder, promotionCode: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  id="include-samples"
                  type="checkbox"
                  checked={newOrder.includeSamples}
                  onChange={(e) => setNewOrder({ ...newOrder, includeSamples: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="include-samples" className="text-sm font-medium text-gray-700">
                  Add Samples
                </label>
                <span className="text-xs text-gray-500">Show samples in order history</span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-900">Items</h4>
                  <button onClick={handleAddItem} className="text-sm text-bark-500 hover:text-bark-600 font-medium">+ Add item</button>
                </div>
                {newOrder.items.map((item, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                    <div className="md:col-span-7">
                      <select value={item.productId} onChange={(e) => handleUpdateItem(index, 'productId', e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500">
                        <option value="">Select product</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>{product.name} ({product.size}) - ${Number(product.price).toFixed(2)}</option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-3">
                      <input type="number" min={1} value={item.quantity} onChange={(e) => handleUpdateItem(index, 'quantity', e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500" />
                    </div>
                    <div className="md:col-span-2 flex justify-end">
                      {newOrder.items.length > 1 && (
                        <button onClick={() => handleRemoveItem(index)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Remove item">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center border-t pt-4">
                <span className="text-sm text-gray-600">Subtotal</span>
                <span className="text-lg font-semibold text-gray-900">{formatCurrency(newOrderSubtotal)}</span>
              </div>
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-gray-700 mb-1">Ship-To Summary</p>
                <div className="text-sm text-gray-600 space-y-1">
                  <p className="font-medium text-gray-900">
                    {locationOptions.find((loc) => loc.id === newOrder.locationId)?.location_name || 'Retailer default address'}
                  </p>
                  <p>
                    {locationOptions.find((loc) => loc.id === newOrder.locationId)?.business_address ||
                      'Uses retailer business address on file'}
                  </p>
                  {locationOptions.find((loc) => loc.id === newOrder.locationId)?.phone && (
                    <p>{locationOptions.find((loc) => loc.id === newOrder.locationId)?.phone}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowCreateModal(false)} className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={handleCreateOrder} disabled={isCreating} className="flex-1 px-4 py-2 bg-bark-500 text-white rounded-lg hover:bg-bark-600 disabled:opacity-50 flex items-center justify-center gap-2">
                  {isCreating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Plus className="w-4 h-4" />Create Order</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showTrackingModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6"><h3 className="text-lg font-semibold text-gray-900">Ship Order</h3><button onClick={() => setShowTrackingModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button></div>
            <div className="space-y-4">
              <div><p className="text-sm text-gray-500">Order Number</p><p className="font-medium text-gray-900">{selectedOrder.order_number}</p></div>
              <div><p className="text-sm text-gray-500">Retailer</p><p className="font-medium text-gray-900">{selectedOrder.retailer?.company_name}</p></div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Carrier</label>
                <select value={trackingCarrier} onChange={(e) => setTrackingCarrier(e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500">
                  <option value="UPS">UPS</option>
                  <option value="FedEx">FedEx</option>
                  <option value="USPS">USPS</option>
                  <option value="DHL">DHL</option>
                  <option value="OnTrac">OnTrac</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Tracking Number (Optional)</label><input type="text" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="Enter tracking number" className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500" /></div>
              <div className="flex gap-3 pt-4"><button onClick={() => setShowTrackingModal(false)} className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button><button onClick={confirmShipOrder} disabled={isUpdating} className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2">{isUpdating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Truck className="w-4 h-4" />Mark as Shipped</>}</button></div>
            </div>
          </div>
        </div>
      )}

      {selectedOrder && !showTrackingModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white p-6 border-b border-gray-100 flex items-center justify-between"><h3 className="text-lg font-semibold text-gray-900">Order Details</h3><button onClick={() => { setSelectedOrder(null); setInvoiceUrl(''); }} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button></div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4"><div><p className="text-sm text-gray-500">Order Number</p><p className="font-medium text-gray-900">{selectedOrder.order_number}</p></div><div><p className="text-sm text-gray-500">Status</p><span className={cn("inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium capitalize", getStatusColor(selectedOrder.status))}>{selectedOrder.status}</span></div><div><p className="text-sm text-gray-500">Order Date</p><p className="font-medium text-gray-900">{new Date(selectedOrder.created_at).toLocaleDateString()}</p></div><div><p className="text-sm text-gray-500">Delivery Date</p><p className="font-medium text-gray-900">{selectedOrder.delivery_date ? new Date(selectedOrder.delivery_date).toLocaleDateString() : 'Not specified'}</p></div></div>
              <div className="border-t border-gray-100 pt-4"><h4 className="font-medium text-gray-900 mb-3">Retailer Information</h4><div className="bg-gray-50 rounded-lg p-4"><p className="font-medium text-gray-900">{selectedOrder.retailer?.company_name}</p><p className="text-sm text-gray-600 mt-1">{selectedOrder.retailer?.business_address}</p><p className="text-sm text-gray-600">{selectedOrder.retailer?.phone}</p></div></div>
              <div className="border-t border-gray-100 pt-4">
                <h4 className="font-medium text-gray-900 mb-3">Ship-To Location</h4>
                <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600 space-y-1">
                  <p className="font-medium text-gray-900">
                    {selectedOrder.location?.location_name || selectedOrder.retailer?.company_name || 'Ship-To'}
                  </p>
                  <p>{selectedOrder.location?.business_address || selectedOrder.retailer?.business_address || 'No address on file'}</p>
                  <p>{selectedOrder.location?.phone || selectedOrder.retailer?.phone || 'No phone on file'}</p>
                </div>
              </div>
              <div className="border-t border-gray-100 pt-4"><h4 className="font-medium text-gray-900 mb-3">Order Items</h4><div className="space-y-2">{[...(selectedOrder.order_items || [])].sort((a, b) => { const indexDiff = getAdminOrderItemSortIndex(a) - getAdminOrderItemSortIndex(b); if (indexDiff !== 0) return indexDiff; const nameDiff = normalizeText(a.product?.name).localeCompare(normalizeText(b.product?.name)); if (nameDiff !== 0) return nameDiff; return normalizeSize(a.product?.size).localeCompare(normalizeSize(b.product?.size)); }).map((item) => <div key={item.id} className="flex justify-between py-2 border-b border-gray-100 last:border-0"><div><p className="font-medium text-gray-900">{item.product?.name}</p><p className="text-sm text-gray-500">{item.product?.size} × {item.quantity}</p></div><p className="font-medium text-gray-900">{formatCurrency(item.total_price)}</p></div>)}</div></div>
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <h4 className="font-medium text-gray-900">QuickBooks Invoice</h4>
                <input
                  type="url"
                  value={invoiceUrl}
                  onChange={(e) => setInvoiceUrl(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500"
                  placeholder="https://app.qbo.intuit.com/..."
                />
                {selectedOrder.invoice_sent_at && (
                  <p className="text-xs text-gray-500">
                    Last sent {new Date(selectedOrder.invoice_sent_at).toLocaleDateString()} ({selectedOrder.invoice_sent_count || 0} total)
                  </p>
                )}
                <button onClick={handleSendInvoice} disabled={isSendingInvoice || !invoiceUrl} className="px-4 py-2 border border-bark-500 text-bark-500 rounded-lg hover:bg-cream-200 disabled:opacity-50">
                  {isSendingInvoice ? 'Sending Invoice...' : 'Email Invoice Link'}
                </button>
              </div>
              <div className="border-t border-gray-100 pt-4">
                {selectedOrder.include_samples && (
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold px-3 py-1">
                    Samples included with this order
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold"><span>Total</span><span>{formatCurrency(selectedOrder.total)}</span></div>
              </div>
              {selectedOrder.tracking_number && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm text-gray-500">Tracking</p>
                  <p className="font-mono text-gray-900">{selectedOrder.tracking_number}</p>
                  {selectedOrder.tracking_carrier && (
                    <p className="text-sm text-gray-600 mt-1">{selectedOrder.tracking_carrier}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
