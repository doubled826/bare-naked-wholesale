'use client';

import { useEffect, useMemo, useState } from 'react';
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

const MS_IN_DAY = 1000 * 60 * 60 * 24;
const UPSPW_TRAILING_WEEKS = 52;
const MIN_RUNNING_WEEKS = 1;

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

export default function AdminInsightsPage() {
  const supabase = createClientComponentClient();
  const [isLoading, setIsLoading] = useState(true);
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenuePoint[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [unitsSold, setUnitsSold] = useState(0);
  const [avgOrderValue, setAvgOrderValue] = useState(0);
  const [activeRetailers, setActiveRetailers] = useState(0);
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
  const [comparisonDivisorWeeks, setComparisonDivisorWeeks] = useState(MIN_RUNNING_WEEKS);
  const [velocityWindowLabel, setVelocityWindowLabel] = useState('Running average since first order');
  const [successInsights, setSuccessInsights] = useState<RetailerSuccessInsights | null>(null);
  const [currentPromo, setCurrentPromo] = useState<CurrentAstroPromo>(defaultCurrentAstroPromo);
  const [promoForm, setPromoForm] = useState({
    promo_visible: false,
    promo_name: '',
    promo_description: '',
    promo_start_date: '',
    promo_end_date: '',
    astro_promo_url: '',
  });
  const [promoNotice, setPromoNotice] = useState('');
  const [isSavingPromo, setIsSavingPromo] = useState(false);

  useEffect(() => {
    fetchInsights();
  }, []);

  useEffect(() => {
    setPromoForm({
      promo_visible: currentPromo.promoVisible,
      promo_name: currentPromo.promoName,
      promo_description: currentPromo.promoDescription,
      promo_start_date: currentPromo.promoStartDate || '',
      promo_end_date: currentPromo.promoEndDate || '',
      astro_promo_url: currentPromo.astroPromoUrl,
    });
  }, [currentPromo]);

  const saveCurrentPromo = async () => {
    setIsSavingPromo(true);
    setPromoNotice('');
    try {
      const response = await fetch('/api/admin/retailer-success/promo', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(promoForm),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to save current promo.');
      }
      setCurrentPromo(data.currentPromo);
      setPromoNotice('Current promo saved.');
      fetchInsights();
    } catch (error) {
      console.error('Promo save error:', error);
      setPromoNotice(error instanceof Error ? error.message : 'Failed to save current promo.');
    } finally {
      setIsSavingPromo(false);
    }
  };

  const fetchInsights = async () => {
    setIsLoading(true);
    try {
      const { data: orders } = await supabase
        .from('orders')
        .select('id, retailer_id, total, status, created_at, retailer:retailers(id, company_name, business_address, created_at)');

      const { data: orderItems } = await supabase
        .from('order_items')
        .select('order_id, quantity, product_id, product:products(id, name, size, category), order:orders(status, retailer_id, location_id, created_at)');

      const { data: retailers } = await supabase
        .from('retailers')
        .select('id, company_name, business_address, created_at');

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

      const validOrders = (orders as OrderRecord[] | null || []).filter(order => order.status !== 'canceled');
      const totalRevenueValue = validOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
      const totalOrders = validOrders.length;
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
        return sum + (item.quantity || 0);
      }, 0);

      setTotalRevenue(totalRevenueValue);
      setUnitsSold(unitsSoldValue);
      setAvgOrderValue(totalOrders > 0 ? totalRevenueValue / totalOrders : 0);

      const firstValidOrderDate = validOrders.length > 0
        ? validOrders.reduce((earliest, order) => {
          const orderDate = new Date(order.created_at);
          return orderDate < earliest ? orderDate : earliest;
        }, new Date(validOrders[0].created_at))
        : null;

      const today = new Date();
      const daysSinceInception = firstValidOrderDate
        ? Math.max(1, Math.ceil((today.getTime() - firstValidOrderDate.getTime()) / MS_IN_DAY) + 1)
        : 0;
      const runningWeeksSinceInception = firstValidOrderDate
        ? Math.max(MIN_RUNNING_WEEKS, daysSinceInception / 7)
        : MIN_RUNNING_WEEKS;
      const useTrailingYearWindow = runningWeeksSinceInception >= UPSPW_TRAILING_WEEKS;
      const divisorWeeks = useTrailingYearWindow ? UPSPW_TRAILING_WEEKS : runningWeeksSinceInception;
      const unitsWindowStart = useTrailingYearWindow
        ? new Date(today.getTime() - (UPSPW_TRAILING_WEEKS * 7 - 1) * MS_IN_DAY)
        : firstValidOrderDate;
      const effectiveUnitsWindowStart = unitsWindowStart || new Date(0);

      setVelocityWindowLabel(
        useTrailingYearWindow
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

      const trailingMonths = buildTrailingMonths(12);
      const revenueByMonth = new Map<string, number>();
      const paceRevenueByMonth = new Map<string, number>();
      const currentDayOfMonth = today.getDate();

      validOrders.forEach(order => {
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
      const newLocationCount = (retailerLocations as RetailerLocationRecord[] | null || []).filter(location => {
        const createdAt = new Date(location.created_at);
        return createdAt >= startOfMonth;
      }).length;
      setNewLocationsThisMonth(newRetailersCount + newLocationCount);

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
  const topSkuComparison = skuComparisons[0] || null;
  const selectedSkuLeader = selectedSkuComparison?.metrics[0] || null;

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
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 lg:col-span-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Revenue & Volume</h3>
                <p className="text-sm text-gray-500 mt-1">Trailing 12 months revenue with month-to-date pacing</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Month-to-date pace</p>
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
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-gray-500">Units per Store per Week</p>
                  <p className="text-xs text-gray-400 mt-1">{velocityWindowLabel}</p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">All active stores</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{unitsPerStoreMetrics.overall.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">Top 10% retailers</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{unitsPerStoreMetrics.topDecile.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">Top 10 stores</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{unitsPerStoreMetrics.topStores.toFixed(2)}</p>
                </div>
              </div>
              <div className="mt-5 pt-5 border-t border-gray-100">
                <div>
                  <p className="text-sm text-gray-500">Units per Store per Week per SKU</p>
                  <p className="text-xs text-gray-400 mt-1">Based on distinct SKUs ordered in the active averaging window</p>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">All active stores</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{unitsPerStorePerSkuMetrics.overall.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">Top 10% retailers</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{unitsPerStorePerSkuMetrics.topDecile.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">Top 10 stores</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{unitsPerStorePerSkuMetrics.topStores.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {successInsights && (
        <section className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Retailer Success Adoption</h3>
              <p className="text-sm text-gray-500 mt-1">
                Adoption of the simple sell-through tools retailers see in their dashboard.
              </p>
            </div>
            {currentPromo.promoVisible && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-3 py-1">
                Current promo: {currentPromo.promoName || 'Visible'}
              </p>
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

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h4 className="text-md font-semibold text-gray-900">Current Astro Promo</h4>
                <p className="text-sm text-gray-500 mt-1">Simple V1 setting shown on retailer dashboards when visible.</p>
              </div>
              <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={promoForm.promo_visible}
                  onChange={(event) => setPromoForm((current) => ({ ...current, promo_visible: event.target.checked }))}
                  className="rounded border-gray-300 text-bark-500 focus:ring-bark-500"
                />
                Promo visible
              </label>
            </div>
            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <input
                type="text"
                value={promoForm.promo_name}
                onChange={(event) => setPromoForm((current) => ({ ...current, promo_name: event.target.value }))}
                placeholder="Promo name"
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bark-500"
              />
              <input
                type="url"
                value={promoForm.astro_promo_url}
                onChange={(event) => setPromoForm((current) => ({ ...current, astro_promo_url: event.target.value }))}
                placeholder="Astro promo URL"
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bark-500"
              />
              <input
                type="date"
                value={promoForm.promo_start_date}
                onChange={(event) => setPromoForm((current) => ({ ...current, promo_start_date: event.target.value }))}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bark-500"
              />
              <input
                type="date"
                value={promoForm.promo_end_date}
                onChange={(event) => setPromoForm((current) => ({ ...current, promo_end_date: event.target.value }))}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bark-500"
              />
              <textarea
                value={promoForm.promo_description}
                onChange={(event) => setPromoForm((current) => ({ ...current, promo_description: event.target.value }))}
                placeholder="Promo description"
                className="md:col-span-2 lg:col-span-3 rounded-lg border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bark-500"
                rows={2}
              />
              <button
                type="button"
                onClick={saveCurrentPromo}
                disabled={isSavingPromo}
                className="rounded-lg bg-bark-500 px-4 py-2 text-sm font-semibold text-white hover:bg-bark-600 disabled:opacity-50"
              >
                {isSavingPromo ? 'Saving...' : 'Save Promo'}
              </button>
            </div>
            {promoNotice && <p className="mt-3 text-sm text-gray-600">{promoNotice}</p>}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h4 className="text-md font-semibold text-gray-900">Success Tool Adoption</h4>
              <div className="mt-5 space-y-4">
                <AdoptionProgress label="Samples acknowledged" value={successInsights.samplesAcknowledgedPercent} />
                <AdoptionProgress label="Astro enrolled" value={successInsights.astroEnrolledPercent} />
                <AdoptionProgress label="Marketing materials requested/sent" value={successInsights.marketingMaterialsPercent} />
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

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-md font-semibold text-gray-900">Action Needed</h4>
                  <p className="text-sm text-gray-500 mt-1">Retailers missing one of the core success steps.</p>
                </div>
                <span className="text-xs text-gray-400">Notify button TODO: wire to email infra</span>
              </div>
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ActionNeededList title="Missing Astro enrollment" rows={successInsights.missingAstro} />
                <ActionNeededList title="Samples not acknowledged" rows={successInsights.missingSamples} />
                <ActionNeededList title="Materials not requested" rows={successInsights.missingMarketingMaterials} />
                <ActionNeededList title="No treats ordered" rows={successInsights.missingTreats} />
                <ActionNeededList title="Shelf placement not marked" rows={successInsights.missingShelfPlacement} />
                {currentPromo.promoVisible && (
                  <ActionNeededList title="Promo not responded" rows={successInsights.missingPromoResponse} />
                )}
              </div>
            </div>
          </div>
        </section>
      )}

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
            <p className="text-sm text-gray-500">Shared stores in scope</p>
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
            <h4 className="text-md font-semibold text-gray-900">Dynamic Same-Store Comparison</h4>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store Wins</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Share</th>
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
            <p className="text-sm text-gray-500">New Retail Locations This Month</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{newLocationsThisMonth}</p>
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

function SuccessMetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
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

function ActionNeededList({
  title,
  rows,
}: {
  title: string;
  rows: NonNullable<RetailerSuccessInsights>['retailerRows'];
}) {
  return (
    <div className="rounded-lg border border-gray-100 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        <span className="text-xs font-semibold text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">{rows.length}</span>
      </div>
      <div className="mt-3 space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-gray-500">No retailers.</p>
        ) : (
          rows.slice(0, 5).map((row) => (
            <Link key={row.retailer.id} href={`/admin/retailers/${row.retailer.id}`} className="block text-sm text-gray-700 hover:text-bark-600">
              {row.retailer.company_name || 'Unnamed retailer'}
            </Link>
          ))
        )}
        {rows.length > 5 && <p className="text-xs text-gray-400">+{rows.length - 5} more</p>}
      </div>
    </div>
  );
}
