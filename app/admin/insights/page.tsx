'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { formatCurrency, formatDate } from '@/lib/utils';

type OrderRecord = {
  id: string;
  retailer_id: string | null;
  total: number | string | null;
  status: string | null;
  created_at: string;
  retailer?: {
    id: string;
    company_name: string;
    business_address: string;
    created_at: string;
  } | null;
};

type RetailerRecord = {
  id: string;
  company_name: string;
  business_address: string;
  created_at: string;
};

type RetailerStats = {
  id: string;
  company_name: string;
  business_address: string;
  total_orders: number;
  total_spent: number;
  last_order_date: Date;
};

type AtRiskRetailer = {
  id: string;
  company_name: string;
  last_order_date: Date;
  days_since: number;
};

const MS_IN_DAY = 1000 * 60 * 60 * 24;

const formatCompactCurrency = (value: number) =>
  `$${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}`;

const parseStateFromAddress = (address: string | null | undefined) => {
  if (!address) return null;
  const upper = address.toUpperCase();
  const commaMatch = upper.match(/,\s*([A-Z]{2})\s*\d{5}(-\d{4})?\s*$/);
  if (commaMatch?.[1]) return commaMatch[1];
  const spaceMatch = upper.match(/\b([A-Z]{2})\s*\d{5}(-\d{4})?\s*$/);
  if (spaceMatch?.[1]) return spaceMatch[1];
  const fallback = upper.match(/\b([A-Z]{2})\b(?!.*\b[A-Z]{2}\b)/);
  return fallback?.[1] || null;
};

const buildTrailingMonths = (count: number) => {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = `${date.toLocaleString('en-US', { month: 'short' })} ${String(date.getFullYear()).slice(-2)}`;
    return { key, label };
  });
};

export default function AdminInsightsPage() {
  const supabase = createClientComponentClient();
  const [isLoading, setIsLoading] = useState(true);
  const [monthlyRevenue, setMonthlyRevenue] = useState<{ month: string; revenue: number }[]>([]);
  const [growthRate, setGrowthRate] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [unitsSold, setUnitsSold] = useState(0);
  const [avgOrderValue, setAvgOrderValue] = useState(0);
  const [activeRetailers, setActiveRetailers] = useState(0);
  const [newRetailersThisMonth, setNewRetailersThisMonth] = useState(0);
  const [reorderRate, setReorderRate] = useState(0);
  const [atRiskRetailers, setAtRiskRetailers] = useState<AtRiskRetailer[]>([]);
  const [stateRevenue, setStateRevenue] = useState<{ state: string; revenue: number }[]>([]);
  const [activeStates, setActiveStates] = useState(0);
  const [topRetailersByRevenue, setTopRetailersByRevenue] = useState<RetailerStats[]>([]);
  const [topRetailersByOrders, setTopRetailersByOrders] = useState<RetailerStats[]>([]);

  useEffect(() => {
    fetchInsights();
  }, []);

  const fetchInsights = async () => {
    setIsLoading(true);
    try {
      const { data: orders } = await supabase
        .from('orders')
        .select('id, retailer_id, total, status, created_at, retailer:retailers(id, company_name, business_address, created_at)');

      const { data: orderItems } = await supabase
        .from('order_items')
        .select('quantity, order:orders(status)');

      const { data: retailers } = await supabase
        .from('retailers')
        .select('id, company_name, business_address, created_at');

      const validOrders = (orders as OrderRecord[] | null || []).filter(order => order.status !== 'canceled');
      const totalRevenueValue = validOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
      const totalOrders = validOrders.length;

      const unitsSoldValue = (orderItems || []).reduce((sum: number, item: any) => {
        if (item.order?.status === 'canceled') return sum;
        return sum + (item.quantity || 0);
      }, 0);

      setTotalRevenue(totalRevenueValue);
      setUnitsSold(unitsSoldValue);
      setAvgOrderValue(totalOrders > 0 ? totalRevenueValue / totalOrders : 0);

      const trailingMonths = buildTrailingMonths(12);
      const revenueByMonth = new Map<string, number>();
      validOrders.forEach(order => {
        const date = new Date(order.created_at);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        revenueByMonth.set(key, (revenueByMonth.get(key) || 0) + (Number(order.total) || 0));
      });
      const monthly = trailingMonths.map(({ key, label }) => ({
        month: label,
        revenue: revenueByMonth.get(key) || 0,
      }));
      setMonthlyRevenue(monthly);
      const last = monthly[monthly.length - 1]?.revenue || 0;
      const prev = monthly[monthly.length - 2]?.revenue || 0;
      const growth = prev === 0 ? (last > 0 ? 100 : 0) : ((last - prev) / prev) * 100;
      setGrowthRate(growth);

      const retailerStats = new Map<string, RetailerStats>();
      validOrders.forEach(order => {
        if (!order.retailer_id || !order.retailer) return;
        const existing = retailerStats.get(order.retailer_id) || {
          id: order.retailer_id,
          company_name: order.retailer.company_name,
          business_address: order.retailer.business_address,
          total_orders: 0,
          total_spent: 0,
          last_order_date: new Date(order.created_at),
        };
        const orderDate = new Date(order.created_at);
        existing.total_orders += 1;
        existing.total_spent += Number(order.total) || 0;
        if (orderDate > existing.last_order_date) {
          existing.last_order_date = orderDate;
        }
        retailerStats.set(order.retailer_id, existing);
      });

      const activeRetailerCount = retailerStats.size;
      setActiveRetailers(activeRetailerCount);

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const newRetailersCount = (retailers as RetailerRecord[] | null || []).filter(retailer => {
        const createdAt = new Date(retailer.created_at);
        return createdAt >= startOfMonth;
      }).length;
      setNewRetailersThisMonth(newRetailersCount);

      const reorderCount = Array.from(retailerStats.values()).filter(retailer => retailer.total_orders >= 2).length;
      setReorderRate(activeRetailerCount > 0 ? (reorderCount / activeRetailerCount) * 100 : 0);

      const riskThreshold = new Date(now.getTime() - 90 * MS_IN_DAY);
      const atRisk = Array.from(retailerStats.values())
        .filter(retailer => retailer.last_order_date < riskThreshold)
        .map(retailer => ({
          id: retailer.id,
          company_name: retailer.company_name,
          last_order_date: retailer.last_order_date,
          days_since: Math.floor((now.getTime() - retailer.last_order_date.getTime()) / MS_IN_DAY),
        }))
        .sort((a, b) => b.days_since - a.days_since);
      setAtRiskRetailers(atRisk);

      const stateRevenueMap = new Map<string, number>();
      validOrders.forEach(order => {
        const state = parseStateFromAddress(order.retailer?.business_address);
        if (!state) return;
        stateRevenueMap.set(state, (stateRevenueMap.get(state) || 0) + (Number(order.total) || 0));
      });
      const stateRevenueList = Array.from(stateRevenueMap.entries())
        .map(([state, revenue]) => ({ state, revenue }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);
      setStateRevenue(stateRevenueList);

      const activeStateSet = new Set<string>();
      Array.from(retailerStats.values()).forEach(retailer => {
        const state = parseStateFromAddress(retailer.business_address);
        if (state) activeStateSet.add(state);
      });
      setActiveStates(activeStateSet.size);

      const byRevenue = Array.from(retailerStats.values())
        .sort((a, b) => b.total_spent - a.total_spent)
        .slice(0, 10);
      setTopRetailersByRevenue(byRevenue);

      const byOrders = Array.from(retailerStats.values())
        .sort((a, b) => b.total_orders - a.total_orders || b.last_order_date.getTime() - a.last_order_date.getTime())
        .slice(0, 10);
      setTopRetailersByOrders(byOrders);

    } catch (error) {
      console.error('Error fetching insights:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const growthLabel = useMemo(() => {
    const sign = growthRate > 0 ? '+' : '';
    return `${sign}${growthRate.toFixed(1)}% vs last month`;
  }, [growthRate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-bark-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 lg:col-span-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Revenue & Volume</h3>
                <p className="text-sm text-gray-500 mt-1">Trailing 12 months revenue</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Growth</p>
                <p className="text-2xl font-semibold text-emerald-600">{growthLabel}</p>
              </div>
            </div>
            <div className="h-72 mt-6">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyRevenue}>
                  <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fill: '#6B7280', fontSize: 12 }} />
                  <YAxis tickFormatter={(value) => formatCompactCurrency(value)} tick={{ fill: '#6B7280', fontSize: 12 }} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Line type="monotone" dataKey="revenue" stroke="#3F1D0B" strokeWidth={3} dot={{ r: 4, fill: '#3F1D0B' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalRevenue)}</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500">Units Sold</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{unitsSold}</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500">Average Order Value</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(avgOrderValue)}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Retailer Health</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Total Active Retailers</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{activeRetailers}</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">New Retailers This Month</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{newRetailersThisMonth}</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Reorder Rate</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{reorderRate.toFixed(1)}%</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">At-Risk Retailers</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{atRiskRetailers.length}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h4 className="text-md font-semibold text-gray-900">At-Risk Retailers</h4>
            <p className="text-sm text-gray-500 mt-1">No orders in the last 90 days</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Retailer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Order</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days Since</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {atRiskRetailers.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-gray-500">No at-risk retailers</td>
                  </tr>
                ) : (
                  atRiskRetailers.map((retailer) => (
                    <tr key={retailer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <Link href={`/admin/retailers/${retailer.id}`} className="font-medium text-gray-900 hover:text-bark-600">
                          {retailer.company_name}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{formatDate(retailer.last_order_date)}</td>
                      <td className="px-6 py-4 text-gray-600">{retailer.days_since} days</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Geographic Spread</h3>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stateRevenue}>
                <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" />
                <XAxis dataKey="state" tick={{ fill: '#6B7280', fontSize: 12 }} />
                <YAxis tickFormatter={(value) => formatCompactCurrency(value)} tick={{ fill: '#6B7280', fontSize: 12 }} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="revenue" fill="#3F1D0B" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-gray-500">States with active retailers</p>
            <p className="text-lg font-semibold text-gray-900">{activeStates}</p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Top 10 Retailers Leaderboard</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h4 className="text-md font-semibold text-gray-900">By Revenue</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Retailer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Spent</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orders</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {topRetailersByRevenue.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-500">No retailer data</td>
                    </tr>
                  ) : (
                    topRetailersByRevenue.map((retailer, index) => (
                      <tr key={retailer.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-gray-500">{index + 1}</td>
                        <td className="px-6 py-4">
                          <Link href={`/admin/retailers/${retailer.id}`} className="font-medium text-gray-900 hover:text-bark-600">
                            {retailer.company_name}
                          </Link>
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-900">{formatCurrency(retailer.total_spent)}</td>
                        <td className="px-6 py-4 text-gray-600">{retailer.total_orders}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h4 className="text-md font-semibold text-gray-900">By Order Frequency</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Retailer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orders</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Order</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {topRetailersByOrders.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-500">No retailer data</td>
                    </tr>
                  ) : (
                    topRetailersByOrders.map((retailer, index) => (
                      <tr key={retailer.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-gray-500">{index + 1}</td>
                        <td className="px-6 py-4">
                          <Link href={`/admin/retailers/${retailer.id}`} className="font-medium text-gray-900 hover:text-bark-600">
                            {retailer.company_name}
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-gray-600">{retailer.total_orders}</td>
                        <td className="px-6 py-4 text-gray-600">{formatDate(retailer.last_order_date)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
