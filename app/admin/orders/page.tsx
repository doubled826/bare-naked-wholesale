'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Search, Truck, Package, Download, X, CheckCircle, Eye, Plus, Trash2 } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';

interface OrderItem { id: string; quantity: number; unit_price: number; total_price: number; product: { name: string; size: string } }
interface Order { id: string; retailer_id: string; order_number: string; status: string; total: number; subtotal: number; delivery_date: string | null; tracking_number: string | null; promotion_code: string | null; created_at: string; shipped_at: string | null; retailer: { id: string; company_name: string; business_address: string; phone: string }; order_items: OrderItem[] }
interface RetailerOption { id: string; company_name: string }
interface ProductOption { id: string; name: string; size: string; price: number }

export default function AdminOrdersPage() {
  const supabase = createClientComponentClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [notification, setNotification] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [retailers, setRetailers] = useState<RetailerOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [newOrder, setNewOrder] = useState({ retailerId: '', deliveryDate: '', promotionCode: '', items: [{ productId: '', quantity: 1 }] });
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => { fetchOrders(); fetchOptions(); }, []);
  useEffect(() => { filterOrders(); }, [orders, searchQuery, statusFilter, startDate, endDate]);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase.from('orders').select('*, retailer:retailers(id, company_name, business_address, phone), order_items(id, quantity, unit_price, total_price, product:products(name, size))').order('created_at', { ascending: false });
      if (error) throw error;
      setOrders(data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
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

  const showNotification = (msg: string) => { setNotification(msg); setTimeout(() => setNotification(''), 3000); };

  const handleShipOrder = (order: Order) => { setSelectedOrder(order); setTrackingNumber(order.tracking_number || ''); setShowTrackingModal(true); };

  const confirmShipOrder = async () => {
    if (!selectedOrder) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase.from('orders').update({ status: 'shipped', tracking_number: trackingNumber || null, shipped_at: new Date().toISOString() }).eq('id', selectedOrder.id);
      if (error) throw error;
      await fetch('/api/admin/orders/ship-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          retailerId: selectedOrder.retailer_id,
          orderNumber: selectedOrder.order_number,
          trackingNumber: trackingNumber || null,
        }),
      });
      showNotification('Order marked as shipped!');
      setShowTrackingModal(false); setSelectedOrder(null); fetchOrders();
    } catch (error) { console.error('Error:', error); showNotification('Failed to update order'); }
    finally { setIsUpdating(false); }
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
          items: newOrder.items.map((item) => ({ productId: item.productId, quantity: Number(item.quantity) || 1 })),
        }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Failed to create order');
      showNotification('Order created!');
      setShowCreateModal(false);
      setNewOrder({ retailerId: '', deliveryDate: '', promotionCode: '', items: [{ productId: '', quantity: 1 }] });
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
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500" />
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500" />
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
                  <td className="px-6 py-4">{order.tracking_number ? <span className="text-sm text-gray-600 font-mono">{order.tracking_number}</span> : <span className="text-sm text-gray-400">—</span>}</td>
                  <td className="px-6 py-4 text-gray-500 text-sm">{new Date(order.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4"><div className="flex items-center gap-2"><button onClick={() => handleShipOrder(order)} className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg" title="Ship Order"><Truck className="w-4 h-4" /></button><button onClick={() => setSelectedOrder(order)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg" title="View Details"><Eye className="w-4 h-4" /></button></div></td>
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
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Tracking Number (Optional)</label><input type="text" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="Enter tracking number" className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500" /></div>
              <div className="flex gap-3 pt-4"><button onClick={() => setShowTrackingModal(false)} className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button><button onClick={confirmShipOrder} disabled={isUpdating} className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2">{isUpdating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Truck className="w-4 h-4" />Mark as Shipped</>}</button></div>
            </div>
          </div>
        </div>
      )}

      {selectedOrder && !showTrackingModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white p-6 border-b border-gray-100 flex items-center justify-between"><h3 className="text-lg font-semibold text-gray-900">Order Details</h3><button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button></div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4"><div><p className="text-sm text-gray-500">Order Number</p><p className="font-medium text-gray-900">{selectedOrder.order_number}</p></div><div><p className="text-sm text-gray-500">Status</p><span className={cn("inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium capitalize", getStatusColor(selectedOrder.status))}>{selectedOrder.status}</span></div><div><p className="text-sm text-gray-500">Order Date</p><p className="font-medium text-gray-900">{new Date(selectedOrder.created_at).toLocaleDateString()}</p></div><div><p className="text-sm text-gray-500">Delivery Date</p><p className="font-medium text-gray-900">{selectedOrder.delivery_date ? new Date(selectedOrder.delivery_date).toLocaleDateString() : 'Not specified'}</p></div></div>
              <div className="border-t border-gray-100 pt-4"><h4 className="font-medium text-gray-900 mb-3">Retailer Information</h4><div className="bg-gray-50 rounded-lg p-4"><p className="font-medium text-gray-900">{selectedOrder.retailer?.company_name}</p><p className="text-sm text-gray-600 mt-1">{selectedOrder.retailer?.business_address}</p><p className="text-sm text-gray-600">{selectedOrder.retailer?.phone}</p></div></div>
              <div className="border-t border-gray-100 pt-4"><h4 className="font-medium text-gray-900 mb-3">Order Items</h4><div className="space-y-2">{selectedOrder.order_items?.map((item) => <div key={item.id} className="flex justify-between py-2 border-b border-gray-100 last:border-0"><div><p className="font-medium text-gray-900">{item.product?.name}</p><p className="text-sm text-gray-500">{item.product?.size} × {item.quantity}</p></div><p className="font-medium text-gray-900">{formatCurrency(item.total_price)}</p></div>)}</div></div>
              <div className="border-t border-gray-100 pt-4"><div className="flex justify-between text-lg font-bold"><span>Total</span><span>{formatCurrency(selectedOrder.total)}</span></div></div>
              {selectedOrder.tracking_number && <div className="border-t border-gray-100 pt-4"><p className="text-sm text-gray-500">Tracking Number</p><p className="font-mono text-gray-900">{selectedOrder.tracking_number}</p></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
