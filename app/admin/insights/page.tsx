'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { Info } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  defaultCurrentAstroPromo,
  getRetailerSuccessInsights,
  normalizeCurrentAstroPromo,
  type CurrentAstroPromo,
  type RetailerSuccessProfileInput,
} from '@/lib/retailerSuccess';

type OrderRecord = {
  id: string;
  retailer_id: string | null;
  location_id: string | null;
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

type RetailerLocationRecord = {
  id: string;
  retailer_id: string;
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

type MonthlyRevenuePoint = {
  month: string;
  revenue: number;
  paceRevenue: number;
};

type ProductRecord = {
  id: string;
  name: string;
  size: string;
} | null;

type UnitsPerStoreMetrics = {
  overall: number;
  topDecile: number;
  topStores: number;
};

type UnitsPerStorePerSkuMetrics = {
  overall: number;
  topDecile: number;
  topStores: number;
};

type SkuOption = {
  id: string;
  label: string;
};

type StoreSkuSnapshot = {
  storeKey: string;
  skuUnits: Record<string, number>;
};

type RetailerSuccessInsights = ReturnType<typeof getRetailerSuccessInsights>;

type SkuComparison = {
  pairKey: string;
  skuAId: string;
  skuBId: string;
  skuALabel: string;
  skuBLabel: string;
  sharedStores: number;
  skuAUnits: number;
  skuBUnits: number;
  skuAUnitsPerStorePerWeek: number;
  skuBUnitsPerStorePerWeek: number;
  skuAStoreWins: number;
  skuBStoreWins: number;
  tiedStores: number;
  leadingSkuLabel: string;
  leadingUnitsPerStorePerWeek: number;
  trailingSkuLabel: string;
  trailingUnitsPerStorePerWeek: number;
};

type SelectedSkuMetric = {
  skuId: string;
  label: string;
  totalUnits: number;
  unitsPerStorePerWeek: number;
  unitSharePercent: number;
  storeWins: number;
};

type InsightsView = 'overview' | 'health' | 'skus' | 'markets';
type InsightsTimeRange = 'mtd' | '90d' | '12m' | 'all';
type OutreachPriority = 'High' | 'Medium' | 'Low';
type RetailerSuccessRow = NonNullable<RetailerSuccessInsights>['retailerRows'][number];

type OutreachRow = {
  retailerId: string;
  retailerName: string;
  pipedriveDealId: number | null;
  priority: OutreachPriority;
  issue: string;
  issueCount: number;
  context: string;
  lastOrderLabel: string;
  progress: number;
};

type ComparisonMetrics = {
  label: string;
  totalRevenue: number | null;
  unitsSold: number | null;
  avgOrderValue: number | null;
  activeRetailers: number | null;
  reorderRate: number | null;
  activeStates: number | null;
};

const MS_IN_DAY = 1000 * 60 * 60 * 24;
const SUPABASE_PAGE_SIZE = 1000;
const UPSPW_TRAILING_WEEKS = 52;
const MIN_RUNNING_WEEKS = 1;

const insightsViews: Array<{ id: InsightsView; label: string; description: string }> = [
  { id: 'overview', label: 'Overview', description: 'Revenue, velocity, and priority follow-ups' },
  { id: 'health', label: 'Retailer Health', description: 'Adoption, risk, and top accounts' },
  { id: 'skus', label: 'SKU Performance', description: 'Same-store SKU matchups' },
  { id: 'markets', label: 'Markets', description: 'Geography and state revenue' },
];

const timeRangeOptions: Array<{ id: InsightsTimeRange; label: string; description: string }> = [
  { id: 'mtd', label: 'MTD', description: 'Month to date' },
  { id: '90d', label: '90 days', description: 'Last 90 days' },
  { id: '12m', label: '12 months', description: 'Last 12 months' },
  { id: 'all', label: 'All time', description: 'All available data' },
];

const priorityRank: Record<OutreachPriority, number> = {
  High: 0,
  Medium: 1,
  Low: 2,
};

const lifecycleLabels: Record<string, string> = {
  new_no_order: 'New, no order',
  new_store: 'New store',
  active: 'Active',
  at_risk: 'At risk',
  inactive: 'Inactive',
  high_performer: 'High performer',
};

const formatCompactCurrency = (value: number) =>
  `$${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}`;

const formatSkuLabel = (product: ProductRecord | undefined, fallbackId?: string | null) => {
  if (!product) return fallbackId ? `Unknown SKU (${fallbackId.slice(0, 8)})` : 'Unknown SKU';
  return `${product.name} (${product.size})`;
};

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

const getTimeRangeStart = (range: InsightsTimeRange, today = new Date()) => {
  if (range === 'mtd') return new Date(today.getFullYear(), today.getMonth(), 1);
  if (range === '90d') return new Date(today.getTime() - 89 * MS_IN_DAY);
  if (range === '12m') return new Date(today.getTime() - (365 - 1) * MS_IN_DAY);
  return null;
};

const getTimeRangeLabel = (range: InsightsTimeRange) =>
  timeRangeOptions.find((option) => option.id === range)?.description || 'Selected range';

const getPipedriveDealUrl = (dealId: number) => `https://app.pipedrive.com/deal/${dealId}`;

const getPreviousTimeRange = (range: InsightsTimeRange, today = new Date()) => {
  if (range === 'all') return null;

  if (range === 'mtd') {
    const previousMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const previousMonthLastDay = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
    const comparableDay = Math.min(today.getDate(), previousMonthLastDay);
    const previousMonthEnd = new Date(today.getFullYear(), today.getMonth() - 1, comparableDay + 1);
    return {
      start: previousMonthStart,
      end: previousMonthEnd,
      label: 'previous month-to-date',
    };
  }

  const currentStart = getTimeRangeStart(range, today);
  if (!currentStart) return null;
  const windowDays = range === '90d' ? 90 : 365;
  return {
    start: new Date(currentStart.getTime() - windowDays * MS_IN_DAY),
    end: currentStart,
    label: `previous ${range === '90d' ? '90 days' : '12 months'}`,
  };
};

export default function AdminInsightsPage() {
  const supabase = createClientComponentClient();
  const [isLoading, setIsLoading] = useState(true);
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenuePoint[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [unitsSold, setUnitsSold] = useState(0);
  const [avgOrderValue, setAvgOrderValue] = useState(0);
  const [comparisonMetrics, setComparisonMetrics] = useState<ComparisonMetrics>({
    label: '',
    totalRevenue: null,
    unitsSold: null,
    avgOrderValue: null,
    activeRetailers: null,
    reorderRate: null,
    activeStates: null,
  });
  const [activeRetailers, setActiveRetailers] = useState(0);
  const [retailersWithoutOrders, setRetailersWithoutOrders] = useState<RetailerRecord[]>([]);
  const [servedRetailerLocations, setServedRetailerLocations] = useState(0);
  const [newLocationsThisMonth, setNewLocationsThisMonth] = useState(0);
  const [reorderRate, setReorderRate] = useState(0);
  const [atRiskRetailers, setAtRiskRetailers] = useState<AtRiskRetailer[]>([]);
  const [stateRevenue, setStateRevenue] = useState<{ state: string; revenue: number }[]>([]);
  const [activeStates, setActiveStates] = useState(0);
  const [topRetailersByRevenue, setTopRetailersByRevenue] = useState<RetailerStats[]>([]);
  const [topRetailersByOrders, setTopRetailersByOrders] = useState<RetailerStats[]>([]);
  const [unitsPerStoreMetrics, setUnitsPerStoreMetrics] = useState<UnitsPerStoreMetrics>({ overall: 0, topDecile: 0, topStores: 0 });
  const [unitsPerStorePerSkuMetrics, setUnitsPerStorePerSkuMetrics] = useState<UnitsPerStorePerSkuMetrics>({ overall: 0, topDecile: 0, topStores: 0 });
  const [skuOptions, setSkuOptions] = useState<SkuOption[]>([]);
  const [skuComparisons, setSkuComparisons] = useState<SkuComparison[]>([]);
  const [storeSkuSnapshots, setStoreSkuSnapshots] = useState<StoreSkuSnapshot[]>([]);
  const [selectedSkuIds, setSelectedSkuIds] = useState<string[]>([]);
  const [skuSearchQuery, setSkuSearchQuery] = useState('');
  const [pipedriveDealByRetailer, setPipedriveDealByRetailer] = useState<Record<string, number>>({});
  const [comparisonDivisorWeeks, setComparisonDivisorWeeks] = useState(MIN_RUNNING_WEEKS);
  const [velocityWindowLabel, setVelocityWindowLabel] = useState('Running average since first order');
  const [successInsights, setSuccessInsights] = useState<RetailerSuccessInsights | null>(null);
  const [currentPromo, setCurrentPromo] = useState<CurrentAstroPromo>(defaultCurrentAstroPromo);
  const [activeView, setActiveView] = useState<InsightsView>('overview');
  const [timeRange, setTimeRange] = useState<InsightsTimeRange>('90d');

  useEffect(() => {
    fetchInsights();
  }, [timeRange]);

  const fetchInsights = async () => {
    setIsLoading(true);
    try {
      const orders: OrderRecord[] = [];
      for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
        const { data: orderPage, error: ordersError } = await supabase
          .from('orders')
          .select('id, retailer_id, location_id, total, status, created_at, retailer:retailers(id, company_name, business_address, created_at)')
          .range(from, from + SUPABASE_PAGE_SIZE - 1);

        if (ordersError) throw ordersError;
        const typedOrderPage = (orderPage || []) as unknown as OrderRecord[];
        orders.push(...typedOrderPage);
        if (typedOrderPage.length < SUPABASE_PAGE_SIZE) break;
      }

      const { data: orderItems } = await supabase
        .from('order_items')
        .select('order_id, quantity, product_id, product:products(id, name, size, category), order:orders(status, retailer_id, location_id, created_at)');

      const retailers: RetailerRecord[] = [];
      for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
        const { data: retailerPage, error: retailersError } = await supabase
          .from('retailers')
          .select('id, company_name, business_address, created_at')
          .range(from, from + SUPABASE_PAGE_SIZE - 1);

        if (retailersError) throw retailersError;
        const typedRetailerPage = (retailerPage || []) as RetailerRecord[];
        retailers.push(...typedRetailerPage);
        if (typedRetailerPage.length < SUPABASE_PAGE_SIZE) break;
      }

      const { data: retailerLocations } = await supabase
        .from('retailer_locations')
        .select('id, retailer_id, created_at');

      const { data: successProfiles } = await supabase
        .from('retailer_success_profiles')
        .select('*');

      const { data: promoSetting } = await supabase
        .from('retailer_success_promo_settings')
        .select('*')
        .eq('id', 'current')
        .maybeSingle();

      const { data: onboardingRows } = await supabase
        .from('retailer_onboarding')
        .select('retailer_id, pipedrive_deal_id');

      const nextPipedriveDealByRetailer = ((onboardingRows as Array<{ retailer_id: string | null; pipedrive_deal_id: number | null }> | null) || [])
        .reduce<Record<string, number>>((acc, row) => {
          if (row.retailer_id && row.pipedrive_deal_id) {
            acc[row.retailer_id] = row.pipedrive_deal_id;
          }
          return acc;
        }, {});
      setPipedriveDealByRetailer(nextPipedriveDealByRetailer);

      const today = new Date();
      const rangeStart = getTimeRangeStart(timeRange, today);
      const previousRange = getPreviousTimeRange(timeRange, today);
      const validOrders = (orders as OrderRecord[] | null || []).filter(order => order.status !== 'canceled');
      const retailerIdsWithOrders = new Set(
        validOrders.flatMap((order) => order.retailer_id ? [order.retailer_id] : []),
      );
      const nextRetailersWithoutOrders = (retailers as RetailerRecord[] | null || [])
        .filter((retailer) => !retailerIdsWithOrders.has(retailer.id))
        .sort((a, b) => a.company_name.localeCompare(b.company_name));
      setRetailersWithoutOrders(nextRetailersWithoutOrders);

      const fulfilledDestinationKeys = new Set<string>();
      validOrders.forEach((order) => {
        if (!order.retailer_id || (order.status !== 'shipped' && order.status !== 'delivered')) return;
        fulfilledDestinationKeys.add(
          order.location_id ? `location:${order.location_id}` : `retailer:${order.retailer_id}`,
        );
      });
      setServedRetailerLocations(fulfilledDestinationKeys.size);
      const reportingOrders = rangeStart
        ? validOrders.filter((order) => new Date(order.created_at) >= rangeStart)
        : validOrders;
      const previousOrders = previousRange
        ? validOrders.filter((order) => {
          const orderDate = new Date(order.created_at);
          return orderDate >= previousRange.start && orderDate < previousRange.end;
        })
        : [];
      const totalRevenueValue = reportingOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
      const totalOrders = reportingOrders.length;
      const previousTotalRevenue = previousRange
        ? previousOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0)
        : null;
      const previousTotalOrders = previousOrders.length;
      const normalizedPromo = normalizeCurrentAstroPromo(promoSetting);
      setCurrentPromo(normalizedPromo);

      const orderItemsByOrder = new Map<string, any[]>();
      ((orderItems as any[]) || []).forEach((item) => {
        if (!item.order_id) return;
        const existing = orderItemsByOrder.get(item.order_id) || [];
        existing.push({
          product_id: item.product_id,
          product: Array.isArray(item.product) ? item.product[0] : item.product,
        });
        orderItemsByOrder.set(item.order_id, existing);
      });
      setSuccessInsights(getRetailerSuccessInsights(
        (retailers as RetailerRecord[] | null || []),
        validOrders.map((order) => ({
          ...order,
          order_items: orderItemsByOrder.get(order.id) || [],
        })),
        (successProfiles as RetailerSuccessProfileInput[] | null || []),
        normalizedPromo,
      ));

      const unitsSoldValue = (orderItems || []).reduce((sum: number, item: any) => {
        if (item.order?.status === 'canceled') return sum;
        if (rangeStart && item.order?.created_at && new Date(item.order.created_at) < rangeStart) return sum;
        return sum + (item.quantity || 0);
      }, 0);
      const previousUnitsSoldValue = previousRange
        ? (orderItems || []).reduce((sum: number, item: any) => {
          if (item.order?.status === 'canceled' || !item.order?.created_at) return sum;
          const orderDate = new Date(item.order.created_at);
          if (orderDate < previousRange.start || orderDate >= previousRange.end) return sum;
          return sum + (item.quantity || 0);
        }, 0)
        : null;

      setTotalRevenue(totalRevenueValue);
      setUnitsSold(unitsSoldValue);
      setAvgOrderValue(totalOrders > 0 ? totalRevenueValue / totalOrders : 0);

      const firstValidOrderDate = validOrders.length > 0
        ? validOrders.reduce((earliest, order) => {
          const orderDate = new Date(order.created_at);
          return orderDate < earliest ? orderDate : earliest;
        }, new Date(validOrders[0].created_at))
        : null;

      const daysSinceWindowStart = rangeStart
        ? Math.max(1, Math.ceil((today.getTime() - rangeStart.getTime()) / MS_IN_DAY) + 1)
        : firstValidOrderDate
          ? Math.max(1, Math.ceil((today.getTime() - firstValidOrderDate.getTime()) / MS_IN_DAY) + 1)
          : 0;
      const runningWeeksSinceWindowStart = Math.max(MIN_RUNNING_WEEKS, daysSinceWindowStart / 7);
      const useTrailingYearWindow = !rangeStart && runningWeeksSinceWindowStart >= UPSPW_TRAILING_WEEKS;
      const divisorWeeks = useTrailingYearWindow ? UPSPW_TRAILING_WEEKS : runningWeeksSinceWindowStart;
      const unitsWindowStart = rangeStart || (
        useTrailingYearWindow
          ? new Date(today.getTime() - (UPSPW_TRAILING_WEEKS * 7 - 1) * MS_IN_DAY)
          : firstValidOrderDate
      );
      const effectiveUnitsWindowStart = unitsWindowStart || new Date(0);

      setVelocityWindowLabel(
        rangeStart
          ? `${getTimeRangeLabel(timeRange)} average (${divisorWeeks.toFixed(1)} weeks)`
          : useTrailingYearWindow
          ? 'Trailing 52-week average'
          : `Running average since first order (${divisorWeeks.toFixed(1)} weeks)`,
      );
      setComparisonDivisorWeeks(divisorWeeks);

      const unitsByRetailerInWindow = new Map<string, number>();
      const skuSetsByRetailer = new Map<string, Set<string>>();
      const unitsByStoreInWindow = new Map<string, number>();
      const skuSetsByStore = new Map<string, Set<string>>();
      const skuUnitsByStore = new Map<string, Map<string, number>>();
      const skuLabels = new Map<string, string>();
      const orderedStoreKeysByRetailer = new Map<string, Set<string>>();
      ((orderItems as Array<{
        quantity: number | null;
        product_id?: string | null;
        product?: ProductRecord;
        order?: { status?: string | null; retailer_id?: string | null; location_id?: string | null; created_at?: string | null } | null;
      }> | null) || []).forEach((item) => {
        if (item.order?.status === 'canceled' || !item.order?.retailer_id || !item.order?.created_at) return;
        const orderDate = new Date(item.order.created_at);
        if (orderDate < effectiveUnitsWindowStart) return;
        const storeKey = item.order.location_id || `retailer:${item.order.retailer_id}`;
        if (item.product_id) {
          skuLabels.set(item.product_id, formatSkuLabel(item.product, item.product_id));
          const retailerSkuSet = skuSetsByRetailer.get(item.order.retailer_id) || new Set<string>();
          retailerSkuSet.add(item.product_id);
          skuSetsByRetailer.set(item.order.retailer_id, retailerSkuSet);

          const storeSkuSet = skuSetsByStore.get(storeKey) || new Set<string>();
          storeSkuSet.add(item.product_id);
          skuSetsByStore.set(storeKey, storeSkuSet);

          const skuTotalsForStore = skuUnitsByStore.get(storeKey) || new Map<string, number>();
          skuTotalsForStore.set(item.product_id, (skuTotalsForStore.get(item.product_id) || 0) + (item.quantity || 0));
          skuUnitsByStore.set(storeKey, skuTotalsForStore);
        }
        unitsByRetailerInWindow.set(
          item.order.retailer_id,
          (unitsByRetailerInWindow.get(item.order.retailer_id) || 0) + (item.quantity || 0),
        );
        unitsByStoreInWindow.set(
          storeKey,
          (unitsByStoreInWindow.get(storeKey) || 0) + (item.quantity || 0),
        );
        const orderedStoreKeys = orderedStoreKeysByRetailer.get(item.order.retailer_id) || new Set<string>();
        orderedStoreKeys.add(storeKey);
        orderedStoreKeysByRetailer.set(item.order.retailer_id, orderedStoreKeys);
      });

      const retailerUnitsPerStore = Array.from(unitsByRetailerInWindow.entries())
        .map(([retailerId, totalUnits]) => {
          const storeCount = Math.max(orderedStoreKeysByRetailer.get(retailerId)?.size || 0, 1);
          return {
            retailerId,
            totalUnits,
            storeCount,
            skuCount: skuSetsByRetailer.get(retailerId)?.size || 0,
            unitsPerStorePerWeek: totalUnits / storeCount / divisorWeeks,
            unitsPerStorePerWeekPerSku:
              (skuSetsByRetailer.get(retailerId)?.size || 0) > 0
                ? totalUnits / storeCount / divisorWeeks / (skuSetsByRetailer.get(retailerId)?.size || 1)
                : 0,
          };
        })
        .filter((retailer) => retailer.totalUnits > 0);

      const totalStoresInWindow = retailerUnitsPerStore.reduce((sum, retailer) => sum + retailer.storeCount, 0);
      const totalUnitsInWindow = retailerUnitsPerStore.reduce((sum, retailer) => sum + retailer.totalUnits, 0);
      const overallUnitsPerStorePerWeek =
        totalStoresInWindow > 0 ? totalUnitsInWindow / totalStoresInWindow / divisorWeeks : 0;

      const topDecileCount = retailerUnitsPerStore.length > 0
        ? Math.max(1, Math.ceil(retailerUnitsPerStore.length * 0.1))
        : 0;
      const topDecileRetailers = [...retailerUnitsPerStore]
        .sort((a, b) => b.unitsPerStorePerWeek - a.unitsPerStorePerWeek)
        .slice(0, topDecileCount);
      const topDecileUnitsPerStorePerWeek = topDecileRetailers.length > 0
        ? topDecileRetailers.reduce((sum, retailer) => sum + retailer.unitsPerStorePerWeek, 0) / topDecileRetailers.length
        : 0;

      const storeUnitsPerWeek = Array.from(unitsByStoreInWindow.entries())
        .map(([storeKey, totalUnits]) => ({
          storeKey,
          totalUnits,
          skuCount: skuSetsByStore.get(storeKey)?.size || 0,
          unitsPerStorePerWeek: totalUnits / divisorWeeks,
          unitsPerStorePerWeekPerSku:
            (skuSetsByStore.get(storeKey)?.size || 0) > 0
              ? totalUnits / divisorWeeks / (skuSetsByStore.get(storeKey)?.size || 1)
              : 0,
        }))
        .filter((store) => store.totalUnits > 0);

      const nextSkuOptions = Array.from(skuLabels.entries())
        .map(([id, label]) => ({ id, label }))
        .sort((a, b) => a.label.localeCompare(b.label));
      setSkuOptions(nextSkuOptions);

      const nextStoreSkuSnapshots = Array.from(skuUnitsByStore.entries()).map(([storeKey, skuMap]) => ({
        storeKey,
        skuUnits: Object.fromEntries(skuMap),
      }));
      setStoreSkuSnapshots(nextStoreSkuSnapshots);

      const topStoreCount = Math.min(10, storeUnitsPerWeek.length);
      const topStoresByUnitsPerWeek = [...storeUnitsPerWeek]
        .sort((a, b) => b.unitsPerStorePerWeek - a.unitsPerStorePerWeek)
        .slice(0, topStoreCount);
      const topTenStoresUnitsPerStorePerWeek = topStoresByUnitsPerWeek.length > 0
        ? topStoresByUnitsPerWeek.reduce((sum, store) => sum + store.unitsPerStorePerWeek, 0) / topStoresByUnitsPerWeek.length
        : 0;

      setUnitsPerStoreMetrics({
        overall: overallUnitsPerStorePerWeek,
        topDecile: topDecileUnitsPerStorePerWeek,
        topStores: topTenStoresUnitsPerStorePerWeek,
      });

      const totalStoreSkuSlotsInWindow = retailerUnitsPerStore.reduce(
        (sum, retailer) => sum + retailer.storeCount * retailer.skuCount,
        0,
      );
      const overallUnitsPerStorePerWeekPerSku =
        totalStoreSkuSlotsInWindow > 0 ? totalUnitsInWindow / totalStoreSkuSlotsInWindow / divisorWeeks : 0;

      const topDecileBySkuRetailers = [...retailerUnitsPerStore]
        .filter((retailer) => retailer.skuCount > 0)
        .sort((a, b) => b.unitsPerStorePerWeekPerSku - a.unitsPerStorePerWeekPerSku)
        .slice(0, topDecileCount);
      const topDecileUnitsPerStorePerWeekPerSku = topDecileBySkuRetailers.length > 0
        ? topDecileBySkuRetailers.reduce((sum, retailer) => sum + retailer.unitsPerStorePerWeekPerSku, 0) / topDecileBySkuRetailers.length
        : 0;

      const topStoresByUnitsPerWeekPerSku = [...storeUnitsPerWeek]
        .filter((store) => store.skuCount > 0)
        .sort((a, b) => b.unitsPerStorePerWeekPerSku - a.unitsPerStorePerWeekPerSku)
        .slice(0, topStoreCount);
      const topTenStoresUnitsPerStorePerWeekPerSku = topStoresByUnitsPerWeekPerSku.length > 0
        ? topStoresByUnitsPerWeekPerSku.reduce((sum, store) => sum + store.unitsPerStorePerWeekPerSku, 0) / topStoresByUnitsPerWeekPerSku.length
        : 0;

      setUnitsPerStorePerSkuMetrics({
        overall: overallUnitsPerStorePerWeekPerSku,
        topDecile: topDecileUnitsPerStorePerWeekPerSku,
        topStores: topTenStoresUnitsPerStorePerWeekPerSku,
      });

      const skuPairComparisons = new Map<
        string,
        Omit<
          SkuComparison,
          'skuAUnitsPerStorePerWeek' |
          'skuBUnitsPerStorePerWeek' |
          'leadingSkuLabel' |
          'leadingUnitsPerStorePerWeek' |
          'trailingSkuLabel' |
          'trailingUnitsPerStorePerWeek'
        >
      >();

      skuUnitsByStore.forEach((storeSkuMap) => {
        const storeEntries = Array.from(storeSkuMap.entries())
          .filter(([, quantity]) => quantity > 0)
          .sort(([skuAId], [skuBId]) => skuAId.localeCompare(skuBId));

        for (let index = 0; index < storeEntries.length; index += 1) {
          for (let comparisonIndex = index + 1; comparisonIndex < storeEntries.length; comparisonIndex += 1) {
            const [skuAId, skuAQuantity] = storeEntries[index];
            const [skuBId, skuBQuantity] = storeEntries[comparisonIndex];
            const pairKey = `${skuAId}::${skuBId}`;
            const existing = skuPairComparisons.get(pairKey) || {
              pairKey,
              skuAId,
              skuBId,
              skuALabel: skuLabels.get(skuAId) || skuAId,
              skuBLabel: skuLabels.get(skuBId) || skuBId,
              sharedStores: 0,
              skuAUnits: 0,
              skuBUnits: 0,
              skuAStoreWins: 0,
              skuBStoreWins: 0,
              tiedStores: 0,
            };

            existing.sharedStores += 1;
            existing.skuAUnits += skuAQuantity;
            existing.skuBUnits += skuBQuantity;

            if (skuAQuantity > skuBQuantity) {
              existing.skuAStoreWins += 1;
            } else if (skuBQuantity > skuAQuantity) {
              existing.skuBStoreWins += 1;
            } else {
              existing.tiedStores += 1;
            }

            skuPairComparisons.set(pairKey, existing);
          }
        }
      });

      const rankedSkuComparisons = Array.from(skuPairComparisons.values())
        .map((comparison) => {
          const skuAUnitsPerStorePerWeek = comparison.sharedStores > 0
            ? comparison.skuAUnits / comparison.sharedStores / divisorWeeks
            : 0;
          const skuBUnitsPerStorePerWeek = comparison.sharedStores > 0
            ? comparison.skuBUnits / comparison.sharedStores / divisorWeeks
            : 0;
          const skuALeading = skuAUnitsPerStorePerWeek >= skuBUnitsPerStorePerWeek;

          return {
            ...comparison,
            skuAUnitsPerStorePerWeek,
            skuBUnitsPerStorePerWeek,
            leadingSkuLabel: skuALeading ? comparison.skuALabel : comparison.skuBLabel,
            leadingUnitsPerStorePerWeek: skuALeading ? skuAUnitsPerStorePerWeek : skuBUnitsPerStorePerWeek,
            trailingSkuLabel: skuALeading ? comparison.skuBLabel : comparison.skuALabel,
            trailingUnitsPerStorePerWeek: skuALeading ? skuBUnitsPerStorePerWeek : skuAUnitsPerStorePerWeek,
          };
        })
        .sort((a, b) => {
          if (b.sharedStores !== a.sharedStores) return b.sharedStores - a.sharedStores;
          const combinedVelocityDelta =
            (b.skuAUnitsPerStorePerWeek + b.skuBUnitsPerStorePerWeek) -
            (a.skuAUnitsPerStorePerWeek + a.skuBUnitsPerStorePerWeek);
          if (combinedVelocityDelta !== 0) return combinedVelocityDelta;
          return (b.skuAStoreWins + b.skuBStoreWins) - (a.skuAStoreWins + a.skuBStoreWins);
        })
        .slice(0, 10);

      setSkuComparisons(rankedSkuComparisons);
      setSelectedSkuIds((previousSelection) => {
        const validSelection = previousSelection.filter((skuId) => skuLabels.has(skuId));
        if (validSelection.length >= 2) return validSelection;
        if (rankedSkuComparisons[0]) {
          return [rankedSkuComparisons[0].skuAId, rankedSkuComparisons[0].skuBId];
        }
        return nextSkuOptions.slice(0, 2).map((option) => option.id);
      });

      const chartMonthCount = timeRange === 'mtd' ? 2 : timeRange === '90d' ? 4 : 12;
      const trailingMonths = buildTrailingMonths(chartMonthCount);
      const revenueByMonth = new Map<string, number>();
      const paceRevenueByMonth = new Map<string, number>();
      const currentDayOfMonth = today.getDate();

      reportingOrders.forEach(order => {
        const date = new Date(order.created_at);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const orderTotal = Number(order.total) || 0;
        revenueByMonth.set(key, (revenueByMonth.get(key) || 0) + (Number(order.total) || 0));

        const comparableDay = Math.min(
          currentDayOfMonth,
          new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate(),
        );
        if (date.getDate() <= comparableDay) {
          paceRevenueByMonth.set(key, (paceRevenueByMonth.get(key) || 0) + orderTotal);
        }
      });

      const monthly = trailingMonths.map(({ key, label }) => ({
        month: label,
        revenue: revenueByMonth.get(key) || 0,
        paceRevenue: paceRevenueByMonth.get(key) || 0,
      }));
      setMonthlyRevenue(monthly);

      const buildRetailerStats = (ordersToSummarize: OrderRecord[]) => {
        const stats = new Map<string, RetailerStats>();
        ordersToSummarize.forEach(order => {
        if (!order.retailer_id || !order.retailer) return;
        const existing = stats.get(order.retailer_id) || {
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
        stats.set(order.retailer_id, existing);
        });
        return stats;
      };

      const retailerStats = buildRetailerStats(reportingOrders);
      const previousRetailerStats = previousRange ? buildRetailerStats(previousOrders) : new Map<string, RetailerStats>();
      const allTimeRetailerStats = buildRetailerStats(validOrders);

      const activeRetailerCount = retailerStats.size;
      const previousActiveRetailerCount = previousRange ? previousRetailerStats.size : null;
      setActiveRetailers(activeRetailerCount);

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const newRetailersCount = (retailers as RetailerRecord[] | null || []).filter(retailer => {
        const createdAt = new Date(retailer.created_at);
        return createdAt >= startOfMonth;
      }).length;
      const newLocationCount = (retailerLocations as RetailerLocationRecord[] | null || []).filter(location => {
        const createdAt = new Date(location.created_at);
        return createdAt >= startOfMonth;
      }).length;
      setNewLocationsThisMonth(newRetailersCount + newLocationCount);

      const reorderCount = Array.from(retailerStats.values()).filter(retailer => retailer.total_orders >= 2).length;
      setReorderRate(activeRetailerCount > 0 ? (reorderCount / activeRetailerCount) * 100 : 0);
      const previousReorderCount = previousRange
        ? Array.from(previousRetailerStats.values()).filter(retailer => retailer.total_orders >= 2).length
        : 0;
      const previousReorderRate = previousRange && previousActiveRetailerCount && previousActiveRetailerCount > 0
        ? (previousReorderCount / previousActiveRetailerCount) * 100
        : null;

      const riskThreshold = new Date(now.getTime() - 90 * MS_IN_DAY);
      const atRisk = Array.from(allTimeRetailerStats.values())
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
      reportingOrders.forEach(order => {
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
      const previousActiveStateSet = new Set<string>();
      if (previousRange) {
        Array.from(previousRetailerStats.values()).forEach(retailer => {
          const state = parseStateFromAddress(retailer.business_address);
          if (state) previousActiveStateSet.add(state);
        });
      }
      const previousAvgOrderValue = previousRange && previousTotalOrders > 0 && previousTotalRevenue !== null
        ? previousTotalRevenue / previousTotalOrders
        : previousRange
          ? 0
          : null;
      setComparisonMetrics({
        label: previousRange?.label || '',
        totalRevenue: previousTotalRevenue,
        unitsSold: previousUnitsSoldValue,
        avgOrderValue: previousAvgOrderValue,
        activeRetailers: previousActiveRetailerCount,
        reorderRate: previousReorderRate,
        activeStates: previousRange ? previousActiveStateSet.size : null,
      });

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

  const monthToDateComparison = useMemo(() => {
    const currentPace = monthlyRevenue[monthlyRevenue.length - 1]?.paceRevenue || 0;
    const previousPace = monthlyRevenue[monthlyRevenue.length - 2]?.paceRevenue || 0;
    const delta = currentPace - previousPace;
    const percentDelta = previousPace === 0 ? (currentPace > 0 ? 100 : 0) : (delta / previousPace) * 100;

    return {
      currentPace,
      previousPace,
      delta,
      percentDelta,
    };
  }, [monthlyRevenue]);

  const growthLabel = useMemo(() => {
    const sign = monthToDateComparison.percentDelta > 0 ? '+' : '';
    return `${sign}${monthToDateComparison.percentDelta.toFixed(1)}% vs same point last month`;
  }, [monthToDateComparison]);

  const growthDeltaLabel = useMemo(() => {
    const direction = monthToDateComparison.delta >= 0 ? 'Up' : 'Down';
    return `${direction} ${formatCurrency(Math.abs(monthToDateComparison.delta))} MTD`;
  }, [monthToDateComparison]);

  const filteredSkuOptions = useMemo(() => {
    const query = skuSearchQuery.trim().toLowerCase();
    if (!query) return skuOptions;
    return skuOptions.filter((option) => option.label.toLowerCase().includes(query));
  }, [skuOptions, skuSearchQuery]);

  const selectedSkuComparison = useMemo(() => {
    if (selectedSkuIds.length < 2) return null;

    const selectedLabels = new Map(
      skuOptions
        .filter((option) => selectedSkuIds.includes(option.id))
        .map((option) => [option.id, option.label]),
    );

    const eligibleStores = storeSkuSnapshots.filter((store) =>
      selectedSkuIds.every((skuId) => (store.skuUnits[skuId] || 0) > 0),
    );

    if (eligibleStores.length === 0) {
      return {
        sharedStores: 0,
        tieStores: 0,
        metrics: selectedSkuIds.map((skuId) => ({
          skuId,
          label: selectedLabels.get(skuId) || skuId,
          totalUnits: 0,
          unitsPerStorePerWeek: 0,
          unitSharePercent: 0,
          storeWins: 0,
        })),
      };
    }

    const totals = new Map<string, number>();
    const storeWins = new Map<string, number>();
    let tieStores = 0;

    eligibleStores.forEach((store) => {
      const storeValues = selectedSkuIds.map((skuId) => ({
        skuId,
        quantity: store.skuUnits[skuId] || 0,
      }));
      storeValues.forEach(({ skuId, quantity }) => {
        totals.set(skuId, (totals.get(skuId) || 0) + quantity);
      });

      const maxQuantity = Math.max(...storeValues.map((value) => value.quantity));
      const leaders = storeValues.filter((value) => value.quantity === maxQuantity);
      if (leaders.length === 1) {
        const winner = leaders[0]?.skuId;
        if (winner) {
          storeWins.set(winner, (storeWins.get(winner) || 0) + 1);
        }
      } else {
        tieStores += 1;
      }
    });

    const combinedUnits = Array.from(totals.values()).reduce((sum, quantity) => sum + quantity, 0);
    const metrics = selectedSkuIds
      .map((skuId) => {
        const totalUnits = totals.get(skuId) || 0;
        return {
          skuId,
          label: selectedLabels.get(skuId) || skuId,
          totalUnits,
          unitsPerStorePerWeek: totalUnits / eligibleStores.length / comparisonDivisorWeeks,
          unitSharePercent: combinedUnits > 0 ? (totalUnits / combinedUnits) * 100 : 0,
          storeWins: storeWins.get(skuId) || 0,
        };
      })
      .sort((a, b) => b.unitsPerStorePerWeek - a.unitsPerStorePerWeek);

    return {
      sharedStores: eligibleStores.length,
      tieStores,
      metrics,
    };
  }, [comparisonDivisorWeeks, selectedSkuIds, skuOptions, storeSkuSnapshots]);

  const growthToneClass = monthToDateComparison.percentDelta >= 0 ? 'text-emerald-600' : 'text-amber-600';
  const selectedSkuLeader = selectedSkuComparison?.metrics[0] || null;

  const attentionItems = useMemo(() => {
    if (!successInsights) {
      return [
        {
          label: 'At-risk retailers',
          value: atRiskRetailers.length,
          detail: 'No orders in 90 days',
          tone: 'amber',
        },
      ];
    }

    const items = [
      {
        label: 'At-risk retailers',
        value: successInsights.byLifecycle.at_risk,
        detail: 'Lifecycle status needs review',
        tone: 'amber',
      },
      {
        label: 'Missing Astro enrollment',
        value: successInsights.missingAstro.length,
        detail: 'Enrollment follow-up',
        tone: 'bark',
      },
      {
        label: 'Samples not acknowledged',
        value: successInsights.missingSamples.length,
        detail: 'Confirm retailer received samples',
        tone: 'bark',
      },
      {
        label: 'High-performing stores',
        value: successInsights.byLifecycle.high_performer,
        detail: 'Good candidates for growth asks',
        tone: 'emerald',
      },
    ];

    if (currentPromo.promoVisible) {
      items.splice(3, 0, {
        label: 'Promo non-responses',
        value: successInsights.currentPromoNotRespondedCount,
        detail: 'Current promo needs a yes/no',
        tone: 'amber',
      });
    }

    return items;
  }, [atRiskRetailers.length, currentPromo.promoVisible, successInsights]);

  const outreachRows = useMemo<OutreachRow[]>(() => {
    if (!successInsights) return [];

    const buildIssues = (row: RetailerSuccessRow) => {
      const issues: Array<{ priority: OutreachPriority; label: string }> = [];

      if (row.lifecycleStatus === 'inactive') {
        issues.push({ priority: 'High', label: 'Inactive account' });
      } else if (row.lifecycleStatus === 'at_risk') {
        issues.push({ priority: 'High', label: 'At-risk account' });
      }

      if (currentPromo.promoVisible && row.profile.currentPromoStatus === 'not_started') {
        issues.push({ priority: 'High', label: 'Promo not answered' });
      }

      if (!row.profile.astroEnrolled) {
        issues.push({ priority: 'Medium', label: 'Missing Astro enrollment' });
      }

      if (!row.profile.samplesAcknowledged) {
        issues.push({ priority: 'Medium', label: 'Samples not acknowledged' });
      }

      if (row.profile.marketingMaterialsStatus === 'not_requested') {
        issues.push({ priority: 'Low', label: 'Materials not checked' });
      }

      if (!row.profile.hasOrderedTreats) {
        issues.push({ priority: 'Low', label: 'No treats ordered' });
      }

      if (row.profile.shelfPlacementStatus === 'not_set') {
        issues.push({ priority: 'Low', label: 'Shelf placement not marked' });
      }

      return issues.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);
    };

    return successInsights.retailerRows
      .map((row) => {
        const issues = buildIssues(row);
        if (issues.length === 0) return null;

        const primaryIssue = issues[0];
        const daysSince = row.profile.daysSinceLastOrder;
        const lastOrderLabel = row.profile.lastOrderDate
          ? `${formatDate(row.profile.lastOrderDate)}${daysSince !== null ? ` (${daysSince} days)` : ''}`
          : 'No orders yet';
        const lifecycleLabel = lifecycleLabels[row.lifecycleStatus] || row.lifecycleStatus;
        const orderContext = `${row.profile.totalOrders} order${row.profile.totalOrders === 1 ? '' : 's'} - ${formatCurrency(row.profile.totalSpend)}`;

        return {
          retailerId: row.retailer.id,
          retailerName: row.retailer.company_name || 'Unnamed retailer',
          pipedriveDealId: pipedriveDealByRetailer[row.retailer.id] || null,
          priority: primaryIssue.priority,
          issue: primaryIssue.label,
          issueCount: issues.length,
          context: `${lifecycleLabel} - ${orderContext}`,
          lastOrderLabel,
          progress: row.progress.percentage,
        };
      })
      .filter((row): row is OutreachRow => Boolean(row))
      .sort((a, b) => (
        priorityRank[a.priority] - priorityRank[b.priority] ||
        b.issueCount - a.issueCount ||
        a.retailerName.localeCompare(b.retailerName)
      ));
  }, [currentPromo.promoVisible, pipedriveDealByRetailer, successInsights]);

  const toggleSkuSelection = (skuId: string) => {
    setSelectedSkuIds((current) => (
      current.includes(skuId)
        ? current.filter((id) => id !== skuId)
        : [...current, skuId]
    ));
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Insights</h2>
          <p className="text-sm text-gray-500 mt-1">
            Organized views for growth, retailer follow-up, product performance, and markets.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex overflow-x-auto rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
            {timeRangeOptions.map((range) => {
              const isActive = timeRange === range.id;
              return (
                <button
                  key={range.id}
                  type="button"
                  onClick={() => setTimeRange(range.id)}
                  className={`shrink-0 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                    isActive
                      ? 'bg-bark-500 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  aria-pressed={isActive}
                  title={range.description}
                >
                  {range.label}
                </button>
              );
            })}
          </div>
          <div className="flex overflow-x-auto rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
            {insightsViews.map((view) => {
              const isActive = activeView === view.id;
              return (
                <button
                  key={view.id}
                  type="button"
                  onClick={() => setActiveView(view.id)}
                  className={`shrink-0 rounded-md px-4 py-2 text-left text-sm transition-colors ${
                    isActive
                      ? 'bg-bark-500 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  aria-pressed={isActive}
                >
                  <span className="block font-semibold">{view.label}</span>
                  <span className={`block text-xs ${isActive ? 'text-white/75' : 'text-gray-400'}`}>
                    {view.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {activeView === 'overview' && (
        <>
      <section className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 lg:col-span-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Revenue & Volume</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {getTimeRangeLabel(timeRange)} revenue and volume with month-to-date pacing
                </p>
              </div>
              <div className="text-right">
                <MetricLabel
                  className="justify-end text-sm text-gray-500"
                  tooltip="Compares this month's revenue through today's calendar day against revenue through the same day last month."
                >
                  Month-to-date pace
                </MetricLabel>
                <p className={`text-2xl font-semibold ${growthToneClass}`}>{growthLabel}</p>
                <p className={`text-sm font-medium mt-1 ${growthToneClass}`}>{growthDeltaLabel}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-bark-700"></span>
                <span>Full month revenue</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-amber-500"></span>
                <span>Revenue by this day of month</span>
              </div>
            </div>
            <div className="h-72 mt-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyRevenue} barCategoryGap={18}>
                  <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fill: '#6B7280', fontSize: 12 }} />
                  <YAxis tickFormatter={(value) => formatCompactCurrency(value)} tick={{ fill: '#6B7280', fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      formatCurrency(Number(value)),
                      name === 'paceRevenue' ? 'Revenue by this day' : 'Full month revenue',
                    ]}
                  />
                  <Bar
                    dataKey="revenue"
                    name="revenue"
                    stroke="#3F1D0B"
                    fill="#3F1D0B"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={28}
                  />
                  <Bar
                    dataKey="paceRevenue"
                    name="paceRevenue"
                    stroke="#D97706"
                    fill="#D97706"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500">Revenue in Range</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalRevenue)}</p>
              <TrendDelta current={totalRevenue} previous={comparisonMetrics.totalRevenue} label={comparisonMetrics.label} />
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500">Units Sold in Range</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{unitsSold}</p>
              <TrendDelta current={unitsSold} previous={comparisonMetrics.unitsSold} label={comparisonMetrics.label} />
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500">Average Order Value in Range</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(avgOrderValue)}</p>
              <TrendDelta current={avgOrderValue} previous={comparisonMetrics.avgOrderValue} label={comparisonMetrics.label} />
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <MetricLabel tooltip="Total units sold divided by active stores and weeks in the averaging window. This normalizes volume across stores.">
                    Units per Store per Week
                  </MetricLabel>
                  <p className="text-xs text-gray-400 mt-1">{velocityWindowLabel}</p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">All active stores</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{unitsPerStoreMetrics.overall.toFixed(2)}</p>
                </div>
                <div>
                  <MetricLabel
                    className="text-xs uppercase tracking-wide text-gray-400"
                    tooltip="Average velocity among the top decile of retailers ranked by units per store per week."
                  >
                    Top 10% retailers
                  </MetricLabel>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{unitsPerStoreMetrics.topDecile.toFixed(2)}</p>
                </div>
                <div>
                  <MetricLabel
                    className="text-xs uppercase tracking-wide text-gray-400"
                    tooltip="Average velocity for the ten highest-volume store locations in the active averaging window."
                  >
                    Top 10 stores
                  </MetricLabel>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{unitsPerStoreMetrics.topStores.toFixed(2)}</p>
                </div>
              </div>
              <div className="mt-5 pt-5 border-t border-gray-100">
                <div>
                  <MetricLabel tooltip="Units per store per week divided by the number of distinct SKUs carried. This helps compare productivity across broader or narrower assortments.">
                    Units per Store per Week per SKU
                  </MetricLabel>
                  <p className="text-xs text-gray-400 mt-1">Based on distinct SKUs ordered in the active averaging window</p>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">All active stores</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{unitsPerStorePerSkuMetrics.overall.toFixed(2)}</p>
                  </div>
                  <div>
                    <MetricLabel
                      className="text-xs uppercase tracking-wide text-gray-400"
                      tooltip="Average per-SKU velocity among the top decile of retailers ranked by units per store per week per SKU."
                    >
                      Top 10% retailers
                    </MetricLabel>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{unitsPerStorePerSkuMetrics.topDecile.toFixed(2)}</p>
                  </div>
                  <div>
                    <MetricLabel
                      className="text-xs uppercase tracking-wide text-gray-400"
                      tooltip="Average per-SKU velocity for the ten strongest store locations in the active averaging window."
                    >
                      Top 10 stores
                    </MetricLabel>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{unitsPerStorePerSkuMetrics.topStores.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 lg:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Attention Queue</h3>
              <p className="text-sm text-gray-500 mt-1">The shortest path from insights to follow-up.</p>
            </div>
            <button
              type="button"
              onClick={() => setActiveView('health')}
              className="rounded-lg border border-bark-200 px-3 py-2 text-sm font-medium text-bark-700 hover:bg-bark-50"
            >
              Review health
            </button>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {attentionItems.map((item) => {
              const toneClass = item.tone === 'emerald'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                : item.tone === 'amber'
                  ? 'bg-amber-50 text-amber-700 border-amber-100'
                  : 'bg-bark-50 text-bark-700 border-bark-100';
              return (
                <div key={item.label} className={`rounded-lg border p-4 ${toneClass}`}>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="mt-2 text-3xl font-bold">{item.value}</p>
                  <p className="mt-2 text-xs opacity-80">{item.detail}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900">Snapshot</h3>
          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-gray-500">Active retailers in range</p>
              <div className="text-right">
                <p className="font-semibold text-gray-900">{activeRetailers}</p>
                <TrendDelta current={activeRetailers} previous={comparisonMetrics.activeRetailers} label={comparisonMetrics.label} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-gray-500">Reorder rate</p>
              <div className="text-right">
                <p className="font-semibold text-gray-900">{reorderRate.toFixed(1)}%</p>
                <TrendDelta current={reorderRate} previous={comparisonMetrics.reorderRate} label={comparisonMetrics.label} mode="points" />
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-gray-500">Active states</p>
              <div className="text-right">
                <p className="font-semibold text-gray-900">{activeStates}</p>
                <TrendDelta current={activeStates} previous={comparisonMetrics.activeStates} label={comparisonMetrics.label} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-gray-500">Suggested SKU pairs</p>
              <p className="font-semibold text-gray-900">{skuComparisons.length}</p>
            </div>
          </div>
        </div>
      </section>
        </>
      )}

      {activeView === 'health' && successInsights && (
        <section className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Retailer Success Adoption</h3>
              <p className="text-sm text-gray-500 mt-1">
                Adoption of the simple sell-through tools retailers see in their dashboard.
              </p>
            </div>
            {currentPromo.promoVisible && (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-3 py-1">
                  Current promo: {currentPromo.promoName || 'Visible'}
                </p>
                <Link href="/admin/sales-hub" className="text-sm font-medium text-bark-500 hover:text-bark-600">
                  Manage in Sales Hub
                </Link>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <SuccessMetricCard label="Total retailers" value={successInsights.totalRetailers} />
            <SuccessMetricCard label="New stores" value={successInsights.byLifecycle.new_store} />
            <SuccessMetricCard label="Active stores" value={successInsights.byLifecycle.active} />
            <SuccessMetricCard label="At-risk stores" value={successInsights.byLifecycle.at_risk} />
            <SuccessMetricCard label="Inactive stores" value={successInsights.byLifecycle.inactive} />
            <SuccessMetricCard label="High-performing stores" value={successInsights.byLifecycle.high_performer} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h4 className="text-md font-semibold text-gray-900">Success Tool Adoption</h4>
              <div className="mt-5 space-y-4">
                <AdoptionProgress label="Samples acknowledged" value={successInsights.samplesAcknowledgedPercent} />
                <AdoptionProgress label="Astro enrolled" value={successInsights.astroEnrolledPercent} />
                <AdoptionProgress label="Marketing materials checked/requested" value={successInsights.marketingMaterialsPercent} />
                <AdoptionProgress label="Treats ordered" value={successInsights.treatsOrderedPercent} />
                <AdoptionProgress label="Shelf placement marked" value={successInsights.shelfPlacementPercent} />
                {currentPromo.promoVisible && (
                  <AdoptionProgress label="Current promo opted in" value={successInsights.currentPromoOptedInPercent} />
                )}
              </div>
              {currentPromo.promoVisible && (
                <p className="mt-5 text-sm text-gray-600">
                  {successInsights.currentPromoNotRespondedCount} retailers have not responded to the current promo.
                </p>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 lg:col-span-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-md font-semibold text-gray-900">Outreach Queue</h4>
                  <p className="text-sm text-gray-500 mt-1">One prioritized row per retailer that needs follow-up.</p>
                </div>
                <span className="text-xs font-semibold text-gray-500 bg-gray-100 rounded-full px-2 py-1">
                  {outreachRows.length} retailers
                </span>
              </div>
              <OutreachQueueTable rows={outreachRows} />
            </div>
          </div>
        </section>
      )}

      {activeView === 'skus' && (
      <section className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">SKU Performance Matchups</h3>
            <p className="text-sm text-gray-500 mt-1">
              Select any mix of SKUs and compare them only within stores that ordered every selected SKU during the active velocity window.
            </p>
          </div>
          <p className="text-xs text-gray-400">{velocityWindowLabel}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-xl">
              <p className="text-sm font-medium text-gray-900">Choose the SKUs to compare</p>
              <p className="text-sm text-gray-500 mt-1">
                Pick at least two. The widget will only use stores that carried all selected SKUs.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="text"
                value={skuSearchQuery}
                onChange={(event) => setSkuSearchQuery(event.target.value)}
                placeholder="Search SKUs..."
                className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-bark-500 sm:w-64"
              />
              <button
                type="button"
                onClick={() => setSelectedSkuIds([])}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Clear selection
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {filteredSkuOptions.length === 0 ? (
              <p className="text-sm text-gray-500">No SKUs match that search.</p>
            ) : (
              filteredSkuOptions.map((option) => {
                const isSelected = selectedSkuIds.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => toggleSkuSelection(option.id)}
                    className={`rounded-full border px-3 py-2 text-sm transition-colors ${
                      isSelected
                        ? 'border-bark-500 bg-bark-500 text-white'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-bark-300 hover:text-bark-700'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Selected SKUs</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{selectedSkuIds.length}</p>
            <p className="text-xs text-gray-400 mt-2">Choose at least two SKUs to unlock the comparison</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <MetricLabel tooltip="Only stores that ordered every selected SKU are included, so each SKU is compared against the same store set.">
              Shared stores in scope
            </MetricLabel>
            <p className="text-lg font-semibold text-gray-900 mt-1">
              {selectedSkuComparison ? selectedSkuComparison.sharedStores : 'Select more SKUs'}
            </p>
            <p className="text-xs text-gray-400 mt-2">
              {selectedSkuComparison
                ? 'Only stores that ordered every selected SKU are counted'
                : 'The comparison updates as soon as two or more SKUs are selected'}
            </p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Current leading SKU</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">
              {selectedSkuLeader ? selectedSkuLeader.label : 'No leader yet'}
            </p>
            <p className="text-xs text-gray-400 mt-2">
              {selectedSkuLeader
                ? `${selectedSkuLeader.unitsPerStorePerWeek.toFixed(2)} units/store/week in the shared-store set`
                : 'Waiting on a valid shared-store comparison'}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <h4 className="text-md font-semibold text-gray-900">Dynamic Same-Store Comparison</h4>
              <MetricLabel
                className="text-sm text-gray-500"
                tooltip="Compares selected SKUs only within stores that carried all of them, reducing assortment bias."
              >
                Method
              </MetricLabel>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Great for questions like how Chicken and Beef compare among stores that carry both, or how three-plus SKUs stack up where all of them are stocked.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shared-Store Units</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Units / Store / Week</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    <MetricLabel
                      className="text-xs font-medium uppercase text-gray-500"
                      tooltip="Number of shared stores where this SKU had the highest unit volume among the selected SKUs."
                    >
                      Store Wins
                    </MetricLabel>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    <MetricLabel
                      className="text-xs font-medium uppercase text-gray-500"
                      tooltip="This SKU's percentage of all selected-SKU units sold inside the shared-store set."
                    >
                      Unit Share
                    </MetricLabel>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {selectedSkuIds.length < 2 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      Select at least two SKUs to compare their shared-store performance.
                    </td>
                  </tr>
                ) : selectedSkuComparison && selectedSkuComparison.sharedStores === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      No stores in the active window carried all selected SKUs. Try a different SKU mix.
                    </td>
                  </tr>
                ) : (
                  selectedSkuComparison?.metrics.map((metric) => (
                    <tr key={metric.skuId} className="hover:bg-gray-50 align-top">
                      <td className="px-6 py-4 font-medium text-gray-900">{metric.label}</td>
                      <td className="px-6 py-4 text-gray-600">{metric.totalUnits}</td>
                      <td className="px-6 py-4">
                        <span className="font-medium text-gray-900">{metric.unitsPerStorePerWeek.toFixed(2)}</span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {metric.storeWins}
                        <span className="ml-2 text-xs text-gray-400">wins</span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{metric.unitSharePercent.toFixed(1)}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {selectedSkuComparison && selectedSkuIds.length >= 2 && (
            <div className="border-t border-gray-100 bg-gray-50 px-6 py-4 text-sm text-gray-600">
              {selectedSkuComparison.tieStores} shared stores ended in a tie for top selected-SKU volume.
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h4 className="text-md font-semibold text-gray-900">Suggested Head-to-Head Pairs</h4>
            <p className="text-sm text-gray-500 mt-1">
              Quick-start pairs ranked by how many stores carried both.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU Pair</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shared Stores</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Leader</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {skuComparisons.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                      No overlapping SKU pairs in the active window yet.
                    </td>
                  </tr>
                ) : (
                  skuComparisons.map((comparison) => (
                    <tr key={comparison.pairKey} className="hover:bg-gray-50 align-top">
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <p className="font-medium text-gray-900">{comparison.skuALabel}</p>
                          <p className="text-sm text-gray-500">vs {comparison.skuBLabel}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{comparison.sharedStores}</td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <p className="font-medium text-gray-900">{comparison.leadingSkuLabel}</p>
                          <p className="text-sm text-gray-500">
                            +{(comparison.leadingUnitsPerStorePerWeek - comparison.trailingUnitsPerStorePerWeek).toFixed(2)} units/store/week
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => setSelectedSkuIds([comparison.skuAId, comparison.skuBId])}
                          className="rounded-lg border border-bark-200 px-3 py-2 text-sm font-medium text-bark-700 hover:bg-bark-50"
                        >
                          Compare pair
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      )}

      {activeView === 'health' && (
      <>
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Retailer Health</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Active Retailers in Range</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{activeRetailers}</p>
            <TrendDelta current={activeRetailers} previous={comparisonMetrics.activeRetailers} label={comparisonMetrics.label} />
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <MetricLabel tooltip="All retailer accounts that have never placed a non-canceled order. This is an all-time metric and does not change with the date range.">
              Accounts Without an Order
            </MetricLabel>
            <p className="text-2xl font-bold text-gray-900 mt-1">{retailersWithoutOrders.length}</p>
            <p className="text-xs text-gray-400 mt-2">All time</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <MetricLabel tooltip="Unique destinations on shipped or delivered orders. A ship-to location is counted when present; otherwise the retailer's main account location is counted. Canceled, pending, and processing orders are excluded.">
              Retail Locations Served
            </MetricLabel>
            <p className="text-2xl font-bold text-gray-900 mt-1">{servedRetailerLocations}</p>
            <p className="text-xs text-gray-400 mt-2">All time</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">New Retail Locations This Month</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{newLocationsThisMonth}</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <MetricLabel tooltip="Percentage of retailers with two or more non-canceled orders inside the selected range.">
              Reorder Rate
            </MetricLabel>
            <p className="text-2xl font-bold text-gray-900 mt-1">{reorderRate.toFixed(1)}%</p>
            <TrendDelta current={reorderRate} previous={comparisonMetrics.reorderRate} label={comparisonMetrics.label} mode="points" />
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <MetricLabel tooltip="Retailers whose last non-canceled order is old enough to suggest follow-up. The table below uses 90+ days without an order.">
              At-Risk Retailers
            </MetricLabel>
            <p className="text-2xl font-bold text-gray-900 mt-1">{atRiskRetailers.length}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h4 className="text-md font-semibold text-gray-900">Retailers Without an Order</h4>
                <p className="text-sm text-gray-500 mt-1">
                  Accounts that have never placed a non-canceled order, regardless of the selected date range.
                </p>
              </div>
              <span className="shrink-0 text-xs font-semibold text-gray-500 bg-gray-100 rounded-full px-2 py-1">
                {retailersWithoutOrders.length} retailers
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Retailer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Business Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {retailersWithoutOrders.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                      Every retailer account has placed an order.
                    </td>
                  </tr>
                ) : (
                  retailersWithoutOrders.map((retailer) => (
                    <tr key={retailer.id} className="hover:bg-gray-50 align-top">
                      <td className="px-6 py-4">
                        <Link href={`/admin/retailers/${retailer.id}`} className="font-medium text-gray-900 hover:text-bark-600">
                          {retailer.company_name}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">{formatDate(retailer.created_at)}</td>
                      <td className="px-6 py-4 text-gray-600">{retailer.business_address || 'No address on file'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <h4 className="text-md font-semibold text-gray-900">At-Risk Retailers</h4>
              <MetricLabel
                className="text-sm text-gray-500"
                tooltip="This list is based on retailers with no non-canceled orders in the last 90 days."
              >
                Rule
              </MetricLabel>
            </div>
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
      </>
      )}

      {activeView === 'markets' && (
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
            <p className="text-sm text-gray-500">States with active retailers in range</p>
            <div className="text-right">
              <p className="text-lg font-semibold text-gray-900">{activeStates}</p>
              <TrendDelta current={activeStates} previous={comparisonMetrics.activeStates} label={comparisonMetrics.label} />
            </div>
          </div>
        </div>
      </section>
      )}

      {activeView === 'health' && (
      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Top 10 Retailers Leaderboard</h3>
        <p className="text-sm text-gray-500 -mt-2">{getTimeRangeLabel(timeRange)} performance</p>
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
      )}
    </div>
  );
}

function SuccessMetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}

function MetricLabel({
  children,
  tooltip,
  className = 'text-sm text-gray-500',
}: {
  children: ReactNode;
  tooltip: string;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span>{children}</span>
      <span className="group relative inline-flex">
        <button
          type="button"
          className="inline-flex h-4 w-4 items-center justify-center rounded-full text-gray-400 hover:text-bark-600 focus:outline-none focus:ring-2 focus:ring-bark-500"
          aria-label={`${children} definition`}
        >
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <span className="pointer-events-none absolute left-1/2 top-6 z-20 hidden w-64 -translate-x-1/2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-xs font-normal leading-relaxed text-gray-600 shadow-lg group-hover:block group-focus-within:block">
          {tooltip}
        </span>
      </span>
    </span>
  );
}

function TrendDelta({
  current,
  previous,
  label,
  mode = 'percent',
}: {
  current: number;
  previous: number | null;
  label: string;
  mode?: 'percent' | 'points';
}) {
  if (previous === null) return null;

  const delta = current - previous;
  const toneClass = delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-amber-600' : 'text-gray-500';
  let text = `No change vs ${label}`;

  if (mode === 'points') {
    if (delta !== 0) {
      const sign = delta > 0 ? '+' : '-';
      text = `${sign}${Math.abs(delta).toFixed(1)} pts vs ${label}`;
    }
  } else if (previous === 0 && current > 0) {
    text = `New vs ${label}`;
  } else if (previous !== 0 && delta !== 0) {
    const percentDelta = (delta / previous) * 100;
    const sign = percentDelta > 0 ? '+' : '';
    text = `${sign}${percentDelta.toFixed(1)}% vs ${label}`;
  }

  return <p className={`mt-2 text-xs font-medium ${toneClass}`}>{text}</p>;
}

function AdoptionProgress({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">{label}</span>
        <span className="font-semibold text-gray-900">{value}%</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full bg-bark-500" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function OutreachQueueTable({ rows }: { rows: OutreachRow[] }) {
  const priorityClass = (priority: OutreachPriority) => {
    if (priority === 'High') return 'bg-amber-100 text-amber-800';
    if (priority === 'Medium') return 'bg-bark-100 text-bark-800';
    return 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="mt-5 overflow-hidden rounded-lg border border-gray-100">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Retailer</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Priority</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Issue</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Last Order</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Progress</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
        {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                  No retailer follow-ups right now.
                </td>
              </tr>
        ) : (
              rows.map((row) => (
                <tr key={row.retailerId} className="align-top hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <Link href={`/admin/retailers/${row.retailerId}`} className="font-medium text-gray-900 hover:text-bark-600">
                      {row.retailerName}
                    </Link>
                    <p className="mt-1 text-xs text-gray-500">{row.context}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${priorityClass(row.priority)}`}>
                      {row.priority}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-700">
                    {row.issue}
                    {row.issueCount > 1 && (
                      <span className="ml-2 text-xs text-gray-400">+{row.issueCount - 1} more</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600">{row.lastOrderLabel}</td>
                  <td className="px-4 py-4">
                    <div className="flex min-w-24 items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-gray-100">
                        <div className="h-full rounded-full bg-bark-500" style={{ width: `${row.progress}%` }} />
                      </div>
                      <span className="text-xs font-medium text-gray-600">{row.progress}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="space-y-1">
                      {row.pipedriveDealId ? (
                        <a
                          href={getPipedriveDealUrl(row.pipedriveDealId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-sm font-medium text-bark-600 hover:text-bark-700"
                        >
                          Open Pipedrive
                        </a>
                      ) : (
                        <span className="block text-xs text-gray-400">No Pipedrive deal</span>
                      )}
                      <Link
                        href={`/admin/retailers/${row.retailerId}`}
                        className="block text-xs font-medium text-gray-500 hover:text-bark-600"
                      >
                        View retailer
                      </Link>
                    </div>
                  </td>
                </tr>
          ))
        )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
