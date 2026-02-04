'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { 
  DollarSign, 
  ShoppingCart, 
  Users, 
  Package,
  TrendingUp,
  ArrowUpRight,
  Clock
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  shippedOrders: number;
  totalRevenue: number;
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  totalRetailers: number;
  totalProducts: number;
}

interface TopProduct {
  id: string;
  name: string;
  size: string;
  total_sold: number;
  total_revenue: number;
}

interface TopRetailer {
  id: string;
  company_name: string;
  total_orders: number;
  total_spent: number;
}

export default function AdminDashboard() {
  const supabase = createClientComponentClient();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [topRetailers, setTopRetailers] = useState<TopRetailer[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('week');

  useEffect(() => { fetchDashboardData(); }, [timeRange]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const { data: orders } = await supabase.from('orders').select('*');
      const validOrders = (orders || []).filter(o => o.status !== 'canceled' && o.status !== 'cancelled');
      const { data: retailers } = await supabase.from('retailers').select('id');
      const { data: products } = await supabase.from('products').select('id');

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      const statsData: DashboardStats = {
        totalOrders: validOrders.length,
        pendingOrders: validOrders.filter(o => o.status === 'pending').length,
        shippedOrders: validOrders.filter(o => o.status === 'shipped').length,
        totalRevenue: validOrders.reduce((sum, o) => sum + (o.total || 0), 0),
        todayRevenue: validOrders.filter(o => new Date(o.created_at) >= today).reduce((sum, o) => sum + (o.total || 0), 0),
        weekRevenue: validOrders.filter(o => new Date(o.created_at) >= weekAgo).reduce((sum, o) => sum + (o.total || 0), 0),
        monthRevenue: validOrders.filter(o => new Date(o.created_at) >= monthAgo).reduce((sum, o) => sum + (o.total || 0), 0),
        totalRetailers: retailers?.length || 0,
        totalProducts: products?.length || 0,
      };
      setStats(statsData);

      // Top products
      const { data: orderItems } = await supabase.from('order_items').select('quantity, total_price, product:products(id, name, size)');
      const productSales = new Map<string, { name: string; size: string; total_sold: number; total_revenue: number }>();
      orderItems?.forEach((item: any) => {
        if (item.product) {
          const key = item.product.id;
          const existing = productSales.get(key) || { name: item.product.name, size: item.product.size, total_sold: 0, total_revenue: 0 };
          existing.total_sold += item.quantity;
          existing.total_revenue += item.total_price;
          productSales.set(key, existing);
        }
      });
      setTopProducts(Array.from(productSales.entries()).map(([id, data]) => ({ id, ...data })).sort((a, b) => b.total_sold - a.total_sold).slice(0, 5));

      // Top retailers
      const { data: retailerOrders } = await supabase.from('orders').select('total, status, retailer:retailers(id, company_name)');
      const retailerStats = new Map<string, { company_name: string; total_orders: number; total_spent: number }>();
      retailerOrders?.forEach((order: any) => {
        if (order.retailer && order.status !== 'canceled' && order.status !== 'cancelled') {
          const key = order.retailer.id;
          const existing = retailerStats.get(key) || { company_name: order.retailer.company_name, total_orders: 0, total_spent: 0 };
          existing.total_orders += 1;
          existing.total_spent += order.total;
          retailerStats.set(key, existing);
        }
      });
      setTopRetailers(Array.from(retailerStats.entries()).map(([id, data]) => ({ id, ...data })).sort((a, b) => b.total_spent - a.total_spent).slice(0, 5));

      // Recent orders
      const { data: recent } = await supabase
        .from('orders')
        .select('id, order_number, total, status, created_at, retailer:retailers(company_name)')
        .order('created_at', { ascending: false })
        .limit(5);
      setRecentOrders(recent || []);

    } catch (error) { 
      console.error('Error:', error); 
    } finally { 
      setIsLoading(false); 
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'shipped': return 'bg-purple-100 text-purple-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-bark-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Time range selector */}
      <div className="flex justify-end">
        <div className="inline-flex rounded-lg border border-gray-200 p-1 bg-white">
          {(['day', 'week', 'month'] as const).map((range) => (
            <button 
              key={range} 
              onClick={() => setTimeRange(range)} 
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${timeRange === range ? 'bg-bark-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              {range === 'day' ? 'Today' : range === 'week' ? 'This Week' : 'This Month'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(stats?.totalRevenue || 0)}</p>
            </div>
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-emerald-600 font-medium flex items-center">
              <ArrowUpRight className="w-4 h-4 mr-1" />
              {formatCurrency(timeRange === 'day' ? stats?.todayRevenue || 0 : timeRange === 'week' ? stats?.weekRevenue || 0 : stats?.monthRevenue || 0)}
            </span>
            <span className="text-gray-500 ml-2">{timeRange === 'day' ? 'today' : timeRange === 'week' ? 'this week' : 'this month'}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats?.totalOrders}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-yellow-600 font-medium flex items-center">
              <Clock className="w-4 h-4 mr-1" />{stats?.pendingOrders} pending
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Retailers</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats?.totalRetailers}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-purple-600 font-medium flex items-center">
              <TrendingUp className="w-4 h-4 mr-1" />Active accounts
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Products</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats?.totalProducts}</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <Package className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-orange-600 font-medium">In catalog</span>
          </div>
        </div>
      </div>

      {/* Top Products & Retailers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Top Selling Products</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {topProducts.length === 0 ? (
              <div className="p-6 text-center text-gray-500">No sales data yet</div>
            ) : (
              topProducts.map((product, index) => (
                <div key={product.id} className="p-4 flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-bark-100 flex items-center justify-center text-bark-600 font-bold text-sm">{index + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{product.name}</p>
                    <p className="text-sm text-gray-500">{product.size}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">{product.total_sold} sold</p>
                    <p className="text-sm text-gray-500">{formatCurrency(product.total_revenue)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Top Retailers by Volume</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {topRetailers.length === 0 ? (
              <div className="p-6 text-center text-gray-500">No retailer data yet</div>
            ) : (
              topRetailers.map((retailer, index) => (
                <div key={retailer.id} className="p-4 flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-sm">{index + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{retailer.company_name}</p>
                    <p className="text-sm text-gray-500">{retailer.total_orders} orders</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">{formatCurrency(retailer.total_spent)}</p>
                    <p className="text-sm text-gray-500">total spent</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Recent Orders</h3>
          <a href="/admin/orders" className="text-sm text-bark-500 hover:text-bark-600 font-medium">View all →</a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Retailer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">No orders yet</td>
                </tr>
              ) : (
                recentOrders.map((order: any) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4"><span className="font-medium text-gray-900">{order.order_number}</span></td>
                    <td className="px-6 py-4 text-gray-600">{order.retailer?.company_name || 'Unknown'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">{formatCurrency(order.total)}</td>
                    <td className="px-6 py-4 text-gray-500">{new Date(order.created_at).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
