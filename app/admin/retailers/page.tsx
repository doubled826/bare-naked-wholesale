'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Search, Users, Edit2, Eye, X, CheckCircle, ShoppingCart, DollarSign } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';

interface Retailer { id: string; company_name: string; business_address: string; phone: string; account_number: string; invoice_url?: string; invoice_sent_at?: string | null; invoice_sent_count?: number | null; created_at: string; email?: string }
interface RetailerWithStats extends Retailer { total_orders: number; total_spent: number; last_order_date: string | null }
interface Order { id: string; order_number: string; status: string; total: number; created_at: string }

export default function AdminRetailersPage() {
  const supabase = createClientComponentClient();
  const [retailers, setRetailers] = useState<RetailerWithStats[]>([]);
  const [filteredRetailers, setFilteredRetailers] = useState<RetailerWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRetailer, setSelectedRetailer] = useState<RetailerWithStats | null>(null);
  const [retailerOrders, setRetailerOrders] = useState<Order[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ company_name: '', business_address: '', phone: '', invoice_url: '' });
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  const [notification, setNotification] = useState('');

  useEffect(() => { fetchRetailers(); }, []);
  useEffect(() => { filterRetailers(); }, [retailers, searchQuery]);

  const fetchRetailers = async () => {
    try {
      const { data: retailersData } = await supabase.from('retailers').select('*').order('created_at', { ascending: false });
      const { data: ordersData } = await supabase.from('orders').select('retailer_id, total, created_at, status');
      const retailersWithStats: RetailerWithStats[] = (retailersData || []).map(retailer => {
        const retailerOrders = ordersData?.filter(o => o.retailer_id === retailer.id && o.status !== 'canceled' && o.status !== 'cancelled') || [];
        const totalSpent = retailerOrders.reduce((sum, o) => sum + (o.total || 0), 0);
        const lastOrder = retailerOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        return { ...retailer, total_orders: retailerOrders.length, total_spent: totalSpent, last_order_date: lastOrder?.created_at || null };
      });
      setRetailers(retailersWithStats);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  };

  const filterRetailers = () => {
    if (!searchQuery) { setFilteredRetailers(retailers); return; }
    const q = searchQuery.toLowerCase();
    setFilteredRetailers(retailers.filter(r => r.company_name?.toLowerCase().includes(q) || r.account_number?.toLowerCase().includes(q) || r.business_address?.toLowerCase().includes(q)));
  };

  const showNotification = (msg: string) => { setNotification(msg); setTimeout(() => setNotification(''), 3000); };

  const handleViewRetailer = async (retailer: RetailerWithStats) => {
    setSelectedRetailer(retailer);
    const { data: orders } = await supabase.from('orders').select('id, order_number, status, total, created_at').eq('retailer_id', retailer.id).order('created_at', { ascending: false });
    setRetailerOrders(orders || []);
  };

  const handleEditRetailer = (retailer: RetailerWithStats) => { setSelectedRetailer(retailer); setEditForm({ company_name: retailer.company_name || '', business_address: retailer.business_address || '', phone: retailer.phone || '', invoice_url: retailer.invoice_url || '' }); setShowEditModal(true); };

  const handleUpdateRetailer = async () => {
    if (!selectedRetailer) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase.from('retailers').update({ company_name: editForm.company_name, business_address: editForm.business_address, phone: editForm.phone, invoice_url: editForm.invoice_url || null }).eq('id', selectedRetailer.id);
      if (error) throw error;
      showNotification('Retailer updated!'); setShowEditModal(false); setSelectedRetailer(null); fetchRetailers();
    } catch (error) { console.error('Error:', error); showNotification('Failed to update'); }
    finally { setIsUpdating(false); }
  };

  const handleSendInvoice = async () => {
    if (!selectedRetailer || !editForm.invoice_url) {
      showNotification('Add an invoice URL first');
      return;
    }
    setIsSendingInvoice(true);
    try {
      const res = await fetch('/api/admin/retailers/send-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retailerId: selectedRetailer.id, invoiceUrl: editForm.invoice_url }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to send invoice');
      showNotification('Invoice email sent!');
    } catch (error) {
      console.error('Send invoice error:', error);
      showNotification('Failed to send invoice');
    } finally {
      setIsSendingInvoice(false);
    }
  };

  const getStatusColor = (s: string) => { switch (s) { case 'pending': return 'bg-yellow-100 text-yellow-800'; case 'shipped': return 'bg-purple-100 text-purple-800'; case 'delivered': return 'bg-green-100 text-green-800'; default: return 'bg-gray-100 text-gray-800'; } };

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-bark-500"></div></div>;

  return (
    <div className="space-y-6">
      {notification && <div className="fixed top-20 right-6 z-50 bg-white border border-gray-200 rounded-xl p-4 shadow-lg flex items-center gap-3"><CheckCircle className="w-5 h-5 text-emerald-600" /><span className="text-gray-900 font-medium">{notification}</span></div>}

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input type="text" placeholder="Search retailers..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500" /></div></div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center"><Users className="w-5 h-5 text-purple-600" /></div><div><p className="text-sm text-gray-500">Total Retailers</p><p className="text-xl font-bold text-gray-900">{retailers.length}</p></div></div></div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center"><DollarSign className="w-5 h-5 text-emerald-600" /></div><div><p className="text-sm text-gray-500">Total Revenue</p><p className="text-xl font-bold text-gray-900">{formatCurrency(retailers.reduce((sum, r) => sum + r.total_spent, 0))}</p></div></div></div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><ShoppingCart className="w-5 h-5 text-blue-600" /></div><div><p className="text-sm text-gray-500">Total Orders</p><p className="text-xl font-bold text-gray-900">{retailers.reduce((sum, r) => sum + r.total_orders, 0)}</p></div></div></div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Retailer</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account #</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orders</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Spent</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Order</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRetailers.length === 0 ? <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500"><Users className="w-12 h-12 mx-auto mb-4 text-gray-300" /><p>No retailers found</p></td></tr> : filteredRetailers.map((retailer) => (
                <tr key={retailer.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4"><div><p className="font-medium text-gray-900">{retailer.company_name}</p><p className="text-sm text-gray-500 truncate max-w-[200px]">{retailer.business_address}</p></div></td>
                  <td className="px-6 py-4"><span className="font-mono text-sm text-gray-600">{retailer.account_number}</span></td>
                  <td className="px-6 py-4 text-sm text-gray-600">{retailer.phone}</td>
                  <td className="px-6 py-4"><span className="font-medium text-gray-900">{retailer.total_orders}</span></td>
                  <td className="px-6 py-4 font-medium text-gray-900">{formatCurrency(retailer.total_spent)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{retailer.last_order_date ? new Date(retailer.last_order_date).toLocaleDateString() : 'Never'}</td>
                  <td className="px-6 py-4"><div className="flex items-center gap-2"><button onClick={() => handleViewRetailer(retailer)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"><Eye className="w-4 h-4" /></button><button onClick={() => handleEditRetailer(retailer)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4" /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedRetailer && !showEditModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white p-6 border-b border-gray-100 flex items-center justify-between"><h3 className="text-lg font-semibold text-gray-900">Retailer Details</h3><button onClick={() => { setSelectedRetailer(null); setRetailerOrders([]); }} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button></div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4"><div><p className="text-sm text-gray-500">Company Name</p><p className="font-medium text-gray-900">{selectedRetailer.company_name}</p></div><div><p className="text-sm text-gray-500">Account Number</p><p className="font-mono text-gray-900">{selectedRetailer.account_number}</p></div><div><p className="text-sm text-gray-500">Phone</p><p className="font-medium text-gray-900">{selectedRetailer.phone}</p></div><div><p className="text-sm text-gray-500">Member Since</p><p className="font-medium text-gray-900">{new Date(selectedRetailer.created_at).toLocaleDateString()}</p></div><div className="col-span-2"><p className="text-sm text-gray-500">Business Address</p><p className="font-medium text-gray-900">{selectedRetailer.business_address}</p></div></div>
              <div className="bg-cream-200 rounded-xl p-4">
                <p className="text-sm text-bark-500/70">Invoice Sent</p>
                <p className="font-medium text-bark-500">
                  {selectedRetailer.invoice_sent_at ? new Date(selectedRetailer.invoice_sent_at).toLocaleDateString() : 'Not sent'}
                </p>
                <p className="text-xs text-bark-500/60 mt-1">
                  Sent {selectedRetailer.invoice_sent_count || 0} time(s)
                </p>
              </div>
              <div className="grid grid-cols-3 gap-4 border-t border-gray-100 pt-6"><div className="text-center p-4 bg-gray-50 rounded-lg"><p className="text-2xl font-bold text-gray-900">{selectedRetailer.total_orders}</p><p className="text-sm text-gray-500">Total Orders</p></div><div className="text-center p-4 bg-gray-50 rounded-lg"><p className="text-2xl font-bold text-gray-900">{formatCurrency(selectedRetailer.total_spent)}</p><p className="text-sm text-gray-500">Total Spent</p></div><div className="text-center p-4 bg-gray-50 rounded-lg"><p className="text-2xl font-bold text-gray-900">{selectedRetailer.total_orders > 0 ? formatCurrency(selectedRetailer.total_spent / selectedRetailer.total_orders) : '$0'}</p><p className="text-sm text-gray-500">Avg. Order</p></div></div>
              <div className="border-t border-gray-100 pt-6"><h4 className="font-medium text-gray-900 mb-4">Order History</h4>{retailerOrders.length === 0 ? <p className="text-gray-500 text-center py-8">No orders yet</p> : <div className="space-y-2">{retailerOrders.map((order) => <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"><div><p className="font-medium text-gray-900">{order.order_number}</p><p className="text-sm text-gray-500">{new Date(order.created_at).toLocaleDateString()}</p></div><div className="flex items-center gap-3"><span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium capitalize", getStatusColor(order.status))}>{order.status}</span><span className="font-medium text-gray-900">{formatCurrency(order.total)}</span></div></div>)}</div>}</div>
              <div className="flex justify-end pt-4"><button onClick={() => handleEditRetailer(selectedRetailer)} className="px-4 py-2 bg-bark-500 text-white rounded-lg hover:bg-bark-600 flex items-center gap-2"><Edit2 className="w-4 h-4" />Edit Retailer</button></div>
            </div>
          </div>
        </div>
      )}

      {showEditModal && selectedRetailer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6"><h3 className="text-lg font-semibold text-gray-900">Edit Retailer</h3><button onClick={() => { setShowEditModal(false); setSelectedRetailer(null); }} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button></div>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label><input type="text" value={editForm.company_name} onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Business Address</label><textarea value={editForm.business_address} onChange={(e) => setEditForm({ ...editForm, business_address: e.target.value })} rows={3} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label><input type="text" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500" /></div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">QuickBooks Invoice URL</label>
                <input type="url" value={editForm.invoice_url} onChange={(e) => setEditForm({ ...editForm, invoice_url: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500" placeholder="https://app.qbo.intuit.com/..." />
                {selectedRetailer?.invoice_sent_at && (
                  <p className="text-xs text-gray-500 mt-2">
                    Last sent {new Date(selectedRetailer.invoice_sent_at).toLocaleDateString()} ({selectedRetailer.invoice_sent_count || 0} total)
                  </p>
                )}
              </div>
              <button onClick={handleSendInvoice} disabled={isSendingInvoice || !editForm.invoice_url} className="w-full px-4 py-2 border border-bark-500 text-bark-500 rounded-lg hover:bg-cream-200 disabled:opacity-50">
                {isSendingInvoice ? 'Sending Invoice...' : 'Email Invoice Link'}
              </button>
              <div className="flex gap-3 pt-4"><button onClick={() => { setShowEditModal(false); setSelectedRetailer(null); }} className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button><button onClick={handleUpdateRetailer} disabled={isUpdating} className="flex-1 px-4 py-2 bg-bark-500 text-white rounded-lg hover:bg-bark-600 disabled:opacity-50 flex items-center justify-center">{isUpdating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Save Changes'}</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
