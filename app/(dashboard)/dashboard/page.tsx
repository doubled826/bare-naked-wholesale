'use client';

import { useEffect, useState } from 'react';
import { 
  Package, 
  TrendingUp, 
  DollarSign,
  ShoppingBag,
  ArrowRight,
  Clock,
  CheckCircle,
  Truck,
  Gift
} from 'lucide-react';
import Link from 'next/link';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Announcement } from '@/types';
import { wholesaleBenefits } from '@/lib/wholesaleBenefits';

const statusConfig: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  pending: { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100', label: 'Processing' },
  processing: { icon: Package, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Processing' },
  shipped: { icon: Truck, color: 'text-sky-600', bg: 'bg-sky-100', label: 'Shipped' },
  delivered: { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-100', label: 'Delivered' },
  canceled: { icon: Clock, color: 'text-bone-500', bg: 'bg-bone-100', label: 'Canceled' },
};

export default function DashboardPage() {
  const { retailer, orders, products } = useAppStore();
  const supabase = createClientComponentClient();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [sampleNotice, setSampleNotice] = useState('');

  // Get the business name - check both possible field names
  const businessName = retailer?.company_name || retailer?.business_name || '';

  // Calculate analytics
  const activeOrders = orders.filter(order => order.status !== 'canceled');
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

  const handleSampleRequest = async () => {
    try {
      const response = await fetch('/api/samples/request', { method: 'POST' });
      const data = await response.json();
      setSampleNotice(data.message || 'Request submitted. Samples will be added to your next order.');
      setTimeout(() => setSampleNotice(''), 4000);
    } catch (error) {
      console.error('Sample request error:', error);
      setSampleNotice('Unable to submit request. Please try again.');
      setTimeout(() => setSampleNotice(''), 4000);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="page-title">
          Welcome back{businessName ? `, ${businessName}` : ''}! 👋
        </h1>
        <p className="text-bark-500/70 mt-1">
          Here&apos;s what&apos;s happening with your account
        </p>
        {sampleNotice && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm text-emerald-700">
            {sampleNotice}
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
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

      {/* Main content grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Wholesale Benefits Card */}
        <div className="lg:col-span-2">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="section-title">
                Wholesale Benefits
              </h2>
              <span className="badge-success">Active</span>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              {wholesaleBenefits.map((benefit) => (
                <div key={benefit} className="flex items-center gap-3 p-4 bg-cream-200 rounded-xl">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <span className="text-sm text-bark-500">{benefit}</span>
                </div>
              ))}
            </div>

            <Link href="/catalog" className="btn-primary">
              Shop Products
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="section-title mb-4">
              Quick Actions
            </h2>
            <div className="space-y-3">
              <QuickAction
                href="/catalog"
                icon={ShoppingBag}
                label="Browse Catalog"
                description="Shop our products"
              />
              <QuickAction
                href="/orders"
                icon={Package}
                label="View Orders"
                description="View order history"
              />
            <QuickAction
              onClick={handleSampleRequest}
              icon={Gift}
              label="Request Samples"
              description="Samples added to next order"
            />
            </div>
          </div>

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
    <div className="card p-4 lg:p-6">
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-3', colorClasses[color])}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="stat-value text-2xl lg:text-3xl">{value}</p>
      <p className="stat-label">{label}</p>
    </div>
  );
}

function QuickAction({
  href,
  onClick,
  icon: Icon,
  label,
  description,
}: {
  href?: string;
  onClick?: () => void;
  icon: React.ElementType;
  label: string;
  description: string;
}) {
  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="w-full text-left flex items-center gap-4 p-3 rounded-xl hover:bg-cream-200 transition-colors group"
      >
        <div className="w-10 h-10 rounded-lg bg-cream-200 flex items-center justify-center group-hover:bg-bark-500 transition-colors">
          <Icon className="w-5 h-5 text-bark-500 group-hover:text-white transition-colors" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-bark-500">{label}</p>
          <p className="text-xs text-bark-500/60">{description}</p>
        </div>
        <ArrowRight className="w-4 h-4 text-bark-500/30 group-hover:text-bark-500 group-hover:translate-x-1 transition-all" />
      </button>
    );
  }
  if (!href) return null;
  return (
    <Link
      href={href}
      className="flex items-center gap-4 p-3 rounded-xl hover:bg-cream-200 transition-colors group"
    >
      <div className="w-10 h-10 rounded-lg bg-cream-200 flex items-center justify-center group-hover:bg-bark-500 transition-colors">
        <Icon className="w-5 h-5 text-bark-500 group-hover:text-white transition-colors" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-bark-500">{label}</p>
        <p className="text-xs text-bark-500/60">{description}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-bark-500/30 group-hover:text-bark-500 group-hover:translate-x-1 transition-all" />
    </Link>
  );
}
