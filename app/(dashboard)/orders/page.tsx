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

const statusConfig = {
  pending: { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100', label: 'Processing' },
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

  // Calculate analytics
  let totalWholesale = 0;
  let totalMSRP = 0;

  orders.forEach(order => {
    totalWholesale += parseFloat(String(order.total));
    order.order_items?.forEach((item: any) => {
      const product = products.find(p => p.id === item.product_id);
      if (product && product.msrp) {
        totalMSRP += parseFloat(product.msrp) * item.quantity;
      }
    });
  });

  const potentialProfit = totalMSRP - totalWholesale;
  const profitMargin = totalMSRP > 0 ? ((potentialProfit / totalMSRP) * 100) : 0;

  const filteredOrders = orders.filter((order) => {
    const matchesSearch = order.order_number.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="page-title">Order History</h1>
        <p className="text-bark-500/70 mt-1">Track and manage your orders</p>
      </div>

      {/* Analytics Cards */}
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

      {/* Filters */}
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
              <option value="pending">Processing</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders List */}
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
            const status = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.pending;
            const StatusIcon = status.icon;
            const isExpanded = expandedOrder === order.id;
            const itemCount = order.order_items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0;

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
                    </div>
                    <p className="text-sm text-bark-500/70">
                      Ordered on {formatDate(order.created_at)} • {itemCount} items
                    </p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm text-bark-500/70">Total</p>
                      <p className="font-semibold text-bark-500">{formatCurrency(parseFloat(order.total))}</p>
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
                  <div className="border-t border-cream-200 animate-slide-up">
                    <div className="p-4 lg:p-6">
                      <h4 className="text-sm font-semibold text-bark-500/70 mb-4">Order Items</h4>
                      <div className="space-y-3">
                        {order.order_items?.map((item: any, index: number) => {
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
                                {formatCurrency(parseFloat(item.total_price))}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-6 pt-4 border-t border-cream-200 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-bark-500/70">Subtotal</span>
                          <span className="text-bark-500">{formatCurrency(parseFloat(order.subtotal))}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-bark-500/70">Shipping</span>
                          <span className="text-bark-500">Free</span>
                        </div>
                        <div className="flex justify-between font-semibold pt-2 border-t border-cream-200">
                          <span className="text-bark-500">Total</span>
                          <span className="text-bark-500">{formatCurrency(parseFloat(order.total))}</span>
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
