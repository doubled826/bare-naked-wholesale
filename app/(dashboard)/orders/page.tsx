'use client';

import { useState } from 'react';
import { 
  Package, 
  Search, 
  Filter,
  Truck,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  DollarSign,
  TrendingUp
} from 'lucide-react';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { useAppStore } from '@/lib/store';

const statusConfig: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  pending: { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100', label: 'Pending' },
  processing: { icon: Package, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Processing' },
  shipped: { icon: Truck, color: 'text-sky-600', bg: 'bg-sky-100', label: 'Shipped' },
  delivered: { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-100', label: 'Delivered' },
  canceled: { icon: Clock, color: 'text-bone-500', bg: 'bg-bone-100', label: 'Canceled' },
};

export default function OrdersPage() {
  const { orders, products } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  let totalWholesale = 0;
  let totalMSRP = 0;

  orders.forEach(order => {
    const isCanceled = order.status === 'canceled';
    if (isCanceled) return;
    totalWholesale += Number(order.total);
    const orderItems = order.order_items as Array<{ product_id: string; quantity: number }> | undefined;
    orderItems?.forEach((item) => {
      const product = products.find(p => p.id === item.product_id);
      if (product && product.msrp) {
        totalMSRP += Number(product.msrp) * item.quantity;
      }
    });
  });

  const potentialProfit = totalMSRP - totalWholesale;
  const profitMargin = totalMSRP > 0 ? ((potentialProfit / totalMSRP) * 100) : 0;

  const filteredOrders = orders.filter((order) => {
    const matchesSearch = order.order_number.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesStart = !startDate || new Date(order.created_at) >= new Date(`${startDate}T00:00:00`);
    const matchesEnd = !endDate || new Date(order.created_at) <= new Date(`${endDate}T23:59:59.999`);
    return matchesSearch && matchesStatus && matchesStart && matchesEnd;
  });

  const getTrackingUrl = (carrier?: string, trackingNumber?: string) => {
    if (!carrier || !trackingNumber) return null;
    const encoded = encodeURIComponent(trackingNumber.trim());
    switch (carrier) {
      case 'UPS':
        return `https://www.ups.com/track?loc=en_US&tracknum=${encoded}`;
      case 'FedEx':
        return `https://www.fedex.com/fedextrack/?tracknumbers=${encoded}`;
      case 'USPS':
        return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encoded}`;
      case 'DHL':
        return `https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=${encoded}`;
      case 'OnTrac':
        return `https://www.ontrac.com/tracking?tracking=${encoded}`;
      default:
        return null;
    }
  };

  const handleExport = async () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (startDate) params.set('startDate', `${startDate}T00:00:00.000`);
    if (endDate) params.set('endDate', `${endDate}T23:59:59.999`);
    const response = await fetch(`/api/orders/export?${params.toString()}`);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="page-title">Order History</h1>
        <p className="text-bark-500/70 mt-1">Track and manage your orders</p>
      </div>

      {orders.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="card p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-bark-500 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-bark-500/70">Total Wholesale Spent</p>
                <p className="text-2xl font-bold text-bark-500" style={{ fontFamily: 'var(--font-poppins)' }}>
                  {formatCurrency(totalWholesale)}
                </p>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-bark-500 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-bark-500/70">Total MSRP Value</p>
                <p className="text-2xl font-bold text-bark-500" style={{ fontFamily: 'var(--font-poppins)' }}>
                  {formatCurrency(totalMSRP)}
                </p>
              </div>
            </div>
          </div>

          <div className="card p-6 bg-emerald-50 border-emerald-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-emerald-700">Potential Profit</p>
                <p className="text-2xl font-bold text-emerald-700" style={{ fontFamily: 'var(--font-poppins)' }}>
                  {formatCurrency(potentialProfit)}
                </p>
                <p className="text-xs text-emerald-600">{profitMargin.toFixed(1)}% margin</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-500/40" />
            <input
              type="text"
              placeholder="Search by order number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-500/40" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input pl-10 pr-10 appearance-none cursor-pointer min-w-[160px]"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="canceled">Canceled</option>
            </select>
          </div>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="input min-w-[160px]"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="input min-w-[160px]"
          />
          <button onClick={handleExport} className="btn-primary whitespace-nowrap">
            Download CSV
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="card p-12 text-center">
            <Package className="w-12 h-12 text-bark-500/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-bark-500 mb-2">No orders found</h3>
            <p className="text-bark-500/70">
              {searchQuery || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Your orders will appear here'}
            </p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const status = statusConfig[order.status] || statusConfig.pending;
            const StatusIcon = status.icon;
            const isExpanded = expandedOrder === order.id;
            const orderItems = order.order_items as Array<{ product_id: string; quantity: number; total_price: number }> | undefined;
            const itemCount = orderItems?.reduce((sum: number, item) => sum + item.quantity, 0) || 0;
            const hasSamples = Boolean((order as any).include_samples);

            return (
              <div key={order.id} className="card overflow-hidden">
                <button
                  onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                  className="w-full p-4 lg:p-6 flex flex-col lg:flex-row lg:items-center gap-4 text-left hover:bg-cream-200/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-semibold text-bark-500">{order.order_number}</span>
                      <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold', status.bg, status.color)}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {status.label}
                      </span>
                      {hasSamples && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                          Samples
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-bark-500/70">
                      Ordered on {formatDate(order.created_at)} • {itemCount} items
                    </p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm text-bark-500/70">Total</p>
                      <p className="font-semibold text-bark-500">{formatCurrency(Number(order.total))}</p>
                    </div>
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', isExpanded ? 'bg-bark-500' : 'bg-cream-200')}>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-white" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-bark-500" />
                      )}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-cream-200">
                    <div className="p-4 lg:p-6">
                      {(order.tracking_number || order.tracking_carrier) && (
                        <div className="mb-6 rounded-xl bg-cream-200/70 border border-cream-200 p-4">
                          <h4 className="text-sm font-semibold text-bark-500/70 mb-2">Tracking</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                            {order.tracking_number && (
                              <div>
                                <p className="text-bark-500/60">Tracking Number</p>
                                {getTrackingUrl(order.tracking_carrier, order.tracking_number) ? (
                                  <a
                                    href={getTrackingUrl(order.tracking_carrier, order.tracking_number) || '#'}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-mono text-bark-500 underline underline-offset-2 hover:text-bark-600"
                                  >
                                    {order.tracking_number}
                                  </a>
                                ) : (
                                  <p className="font-mono text-bark-500">{order.tracking_number}</p>
                                )}
                              </div>
                            )}
                            {order.tracking_carrier && (
                              <div>
                                <p className="text-bark-500/60">Carrier</p>
                                <p className="text-bark-500">{order.tracking_carrier}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {hasSamples && (
                        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold px-3 py-1">
                          Samples included with this order
                        </div>
                      )}
                      {order.invoice_url && (
                        <div className="mb-6 rounded-xl bg-cream-200/70 border border-cream-200 p-4">
                          <h4 className="text-sm font-semibold text-bark-500/70 mb-2">Invoice</h4>
                          <a
                            href={order.invoice_url}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-primary inline-flex items-center"
                          >
                            View QuickBooks Invoice
                          </a>
                        </div>
                      )}
                      <h4 className="text-sm font-semibold text-bark-500/70 mb-4">Order Items</h4>
                      <div className="space-y-3">
                        {orderItems?.map((item, index: number) => {
                          const product = products.find(p => p.id === item.product_id);
                          return (
                            <div key={index} className="flex items-center justify-between py-3 border-b border-cream-200 last:border-0">
                              <div>
                                <p className="font-medium text-bark-500">
                                  {product?.name || 'Unknown Product'}
                                </p>
                                <p className="text-sm text-bark-500/70">
                                  {product?.size} × {item.quantity}
                                </p>
                              </div>
                              <p className="font-medium text-bark-500">
                                {formatCurrency(Number(item.total_price))}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-6 pt-4 border-t border-cream-200 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-bark-500/70">Subtotal</span>
                          <span className="text-bark-500">{formatCurrency(Number(order.subtotal))}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-bark-500/70">Shipping</span>
                          <span className="text-bark-500">Free</span>
                        </div>
                        <div className="flex justify-between font-semibold pt-2 border-t border-cream-200">
                          <span className="text-bark-500">Total</span>
                          <span className="text-bark-500">{formatCurrency(Number(order.total))}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
