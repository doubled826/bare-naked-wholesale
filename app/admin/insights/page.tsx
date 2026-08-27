'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { ArrowUpRight, Calendar, ChevronDown, ChevronLeft, ChevronRight, Info } from 'lucide-react';
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
  order_items?: Array<{
    order_id?: string | null;
    quantity: number | null;
    product_id?: string | null;
    product?: ProductRecord | ProductRecord[];
  }> | null;
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

type PerformanceMetric = 'revenue' | 'orders' | 'units' | 'velocity';

type PerformanceTrendPoint = {
  period: string;
  periodRange: string;
  previousPeriodRange: string | null;
  revenue: number;
  previousRevenue: number | null;
  orders: number;
  previousOrders: number | null;
  units: number;
  previousUnits: number | null;
  velocity: number;
  previousVelocity: number | null;
};

type MonthlyRevenuePoint = {
  month: string;
  rangeLabel: string;
  revenue: number;
  orders: number;
  units: number;
  isCurrentMonth: boolean;
  comparisonLabel: string | null;
  comparisonRevenue: number | null;
  fullPreviousMonthLabel: string | null;
  fullPreviousMonthRevenue: number | null;
  pacingPercent: number | null;
};

type ProductRecord = {
  id: string;
  name: string;
  size: string;
} | null;

type UnitsPerStoreMetrics = {
  overall: number;
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

type RankedSkuMetric = {
  skuId: string;
  label: string;
  totalUnits: number;
  unitsPerStorePerWeek: number;
  previousUnitsPerStorePerWeek: number | null;
  percentChange: number | null;
};

type RankedMarketMetric = {
  state: string;
  revenue: number;
  activeRetailers: number;
  previousRevenue: number | null;
  percentChange: number | null;
  sparkline: number[];
};

type InsightsView = 'overview' | 'health' | 'skus' | 'markets';
type RetailerHealthPanel = 'summary' | 'needs_first_order' | 'at_risk' | 'outreach' | 'leaderboards';
type DatePresetId =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'last_30_days'
  | 'last_90_days'
  | 'last_365_days'
  | 'week_to_date'
  | 'month_to_date'
  | 'quarter_to_date'
  | 'year_to_date'
  | 'last_week'
  | 'last_month'
  | 'last_quarter'
  | 'last_12_months'
  | 'last_year'
  | 'custom';
type ComparisonType = 'previous_period' | 'previous_year' | 'same_period_last_month' | 'custom' | 'none';
type ChartInterval = 'day' | 'week' | 'month' | 'quarter';
type DateRangeSelection = {
  preset: DatePresetId;
  startDate: string;
  endDate: string;
  includeToday: boolean;
  comparisonType: ComparisonType;
  comparisonStartDate: string;
  comparisonEndDate: string;
};
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
  totalOrders: number | null;
  unitsSold: number | null;
  avgOrderValue: number | null;
  unitsPerStorePerWeek: number | null;
  activeRetailers: number | null;
  reorderRate: number | null;
  activeStates: number | null;
};

const MS_IN_DAY = 1000 * 60 * 60 * 24;
const SUPABASE_PAGE_SIZE = 1000;
const MIN_RUNNING_WEEKS = 1;

const insightsViews: Array<{ id: InsightsView; label: string; description: string }> = [
  { id: 'overview', label: 'Owner Brief', description: 'What changed and what to do' },
  { id: 'health', label: 'Retailers', description: 'Account health and follow-up' },
  { id: 'skus', label: 'Products', description: 'SKU velocity and assortment' },
  { id: 'markets', label: 'Markets', description: 'State growth and expansion' },
];

const retailerHealthPanels: Array<{ id: RetailerHealthPanel; label: string; description: string }> = [
  { id: 'summary', label: 'Summary', description: 'Key health and adoption metrics' },
  { id: 'needs_first_order', label: 'Needs First Order', description: 'Accounts that have not ordered' },
  { id: 'at_risk', label: 'At Risk', description: 'Retailers due for follow-up' },
  { id: 'outreach', label: 'Outreach', description: 'Prioritized action queue' },
  { id: 'leaderboards', label: 'Leaderboards', description: 'Top retailer performance' },
];

const datePresetGroups: Array<{
  label: string;
  presets: Array<{ id: DatePresetId; label: string; rolling?: boolean }>;
}> = [
  {
    label: 'Recent',
    presets: [
      { id: 'today', label: 'Today' },
      { id: 'yesterday', label: 'Yesterday' },
      { id: 'last_7_days', label: 'Last 7 days', rolling: true },
      { id: 'last_30_days', label: 'Last 30 days', rolling: true },
      { id: 'last_90_days', label: 'Last 90 days', rolling: true },
      { id: 'last_365_days', label: 'Last 365 days', rolling: true },
    ],
  },
  {
    label: 'Period to date',
    presets: [
      { id: 'week_to_date', label: 'Week to date' },
      { id: 'month_to_date', label: 'Month to date' },
      { id: 'quarter_to_date', label: 'Quarter to date' },
      { id: 'year_to_date', label: 'Year to date' },
    ],
  },
  {
    label: 'Previous periods',
    presets: [
      { id: 'last_week', label: 'Last week' },
      { id: 'last_month', label: 'Last month' },
      { id: 'last_quarter', label: 'Last quarter' },
      { id: 'last_year', label: 'Last year' },
    ],
  },
  {
    label: 'Custom',
    presets: [{ id: 'custom', label: 'Custom range' }],
  },
];

const comparisonOptions: Array<{ id: ComparisonType; label: string }> = [
  { id: 'previous_period', label: 'Previous period' },
  { id: 'previous_year', label: 'Previous year' },
  { id: 'same_period_last_month', label: 'Same period last month' },
  { id: 'custom', label: 'Custom comparison' },
  { id: 'none', label: 'No comparison' },
];

const performanceMetricOptions: Array<{ id: PerformanceMetric; label: string; color: string; comparisonColor: string }> = [
  { id: 'revenue', label: 'Revenue', color: '#3F1D0B', comparisonColor: '#B59B82' },
  { id: 'orders', label: 'Orders', color: '#7C2D12', comparisonColor: '#D6A98C' },
  { id: 'units', label: 'Units', color: '#2F6F4E', comparisonColor: '#A7C9B7' },
  { id: 'velocity', label: 'Units / Store / Week', color: '#92400E', comparisonColor: '#E0B36A' },
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

const formatSignedPercent = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return 'No comp';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
};

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

const getPresetLabel = (preset: DatePresetId) =>
  datePresetGroups.flatMap((group) => group.presets).find((option) => option.id === preset)?.label || 'Custom range';

const getPipedriveDealUrl = (dealId: number) => `https://app.pipedrive.com/deal/${dealId}`;

const startOfLocalDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

const addMonths = (date: Date, months: number) => {
  const targetMonth = date.getMonth() + months;
  const targetYear = date.getFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const lastDayOfTargetMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  return new Date(targetYear, normalizedMonth, Math.min(date.getDate(), lastDayOfTargetMonth));
};

const addYears = (date: Date, years: number) => {
  const targetYear = date.getFullYear() + years;
  const lastDayOfTargetMonth = new Date(targetYear, date.getMonth() + 1, 0).getDate();
  return new Date(targetYear, date.getMonth(), Math.min(date.getDate(), lastDayOfTargetMonth));
};

const formatDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const parseDateKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const getInclusiveDays = (startDate: Date, endDate: Date) =>
  Math.max(1, Math.round((startOfLocalDay(endDate).getTime() - startOfLocalDay(startDate).getTime()) / MS_IN_DAY) + 1);

const formatRangeLabel = (startDateKey: string, endDateKey: string) => {
  const startDate = parseDateKey(startDateKey);
  const endDate = parseDateKey(endDateKey);
  if (!startDate || !endDate) return 'Invalid date range';
  const sameYear = startDate.getFullYear() === endDate.getFullYear();
  const startLabel = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: sameYear ? undefined : 'numeric' });
  const endLabel = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startLabel}-${endLabel}`;
};

const getDefaultDateSelection = (today = new Date()): DateRangeSelection => {
  const primary = getPresetRange('last_90_days', today, true);
  const comparison = getComparisonRange(primary.startDate, primary.endDate, 'previous_period', today, 'last_90_days');
  return {
    preset: 'last_90_days',
    startDate: primary.startDate,
    endDate: primary.endDate,
    includeToday: true,
    comparisonType: 'previous_period',
    comparisonStartDate: comparison?.startDate || '',
    comparisonEndDate: comparison?.endDate || '',
  };
};

const isDateSelectionEqual = (first: DateRangeSelection, second: DateRangeSelection) =>
  first.preset === second.preset &&
  first.startDate === second.startDate &&
  first.endDate === second.endDate &&
  first.includeToday === second.includeToday &&
  first.comparisonType === second.comparisonType &&
  first.comparisonStartDate === second.comparisonStartDate &&
  first.comparisonEndDate === second.comparisonEndDate;

const getDateSelectionFromSearchParams = (params: URLSearchParams, today = new Date()) => {
  const fallback = getDefaultDateSelection(today);
  const preset = (params.get('preset') as DatePresetId | null) || fallback.preset;
  const comparisonType = (params.get('compare') as ComparisonType | null) || fallback.comparisonType;
  const startDate = params.get('start') || fallback.startDate;
  const endDate = params.get('end') || fallback.endDate;
  const includeToday = params.get('today') !== 'false';
  const computedComparison = getComparisonRange(startDate, endDate, comparisonType, today, preset);

  return {
    preset: datePresetGroups.flatMap((group) => group.presets).some((option) => option.id === preset) ? preset : fallback.preset,
    startDate,
    endDate,
    includeToday,
    comparisonType: comparisonOptions.some((option) => option.id === comparisonType) ? comparisonType : fallback.comparisonType,
    comparisonStartDate: comparisonType === 'custom' ? params.get('cstart') || fallback.comparisonStartDate : computedComparison?.startDate || fallback.comparisonStartDate,
    comparisonEndDate: comparisonType === 'custom' ? params.get('cend') || fallback.comparisonEndDate : computedComparison?.endDate || fallback.comparisonEndDate,
  };
};

const getPresetRange = (preset: DatePresetId, todayInput = new Date(), includeToday = true) => {
  const today = startOfLocalDay(todayInput);
  const rollingEnd = includeToday ? today : addDays(today, -1);
  const yesterday = addDays(today, -1);
  const currentQuarterStartMonth = Math.floor(today.getMonth() / 3) * 3;

  if (preset === 'today') return { startDate: formatDateKey(today), endDate: formatDateKey(today) };
  if (preset === 'yesterday') return { startDate: formatDateKey(yesterday), endDate: formatDateKey(yesterday) };
  if (preset === 'last_7_days') return { startDate: formatDateKey(addDays(rollingEnd, -6)), endDate: formatDateKey(rollingEnd) };
  if (preset === 'last_30_days') return { startDate: formatDateKey(addDays(rollingEnd, -29)), endDate: formatDateKey(rollingEnd) };
  if (preset === 'last_90_days') return { startDate: formatDateKey(addDays(rollingEnd, -89)), endDate: formatDateKey(rollingEnd) };
  if (preset === 'last_365_days') return { startDate: formatDateKey(addDays(rollingEnd, -364)), endDate: formatDateKey(rollingEnd) };
  if (preset === 'week_to_date') return { startDate: formatDateKey(addDays(today, -today.getDay())), endDate: formatDateKey(today) };
  if (preset === 'month_to_date') return { startDate: formatDateKey(new Date(today.getFullYear(), today.getMonth(), 1)), endDate: formatDateKey(today) };
  if (preset === 'quarter_to_date') return { startDate: formatDateKey(new Date(today.getFullYear(), currentQuarterStartMonth, 1)), endDate: formatDateKey(today) };
  if (preset === 'year_to_date') return { startDate: formatDateKey(new Date(today.getFullYear(), 0, 1)), endDate: formatDateKey(today) };
  if (preset === 'last_week') {
    const currentWeekStart = addDays(today, -today.getDay());
    return { startDate: formatDateKey(addDays(currentWeekStart, -7)), endDate: formatDateKey(addDays(currentWeekStart, -1)) };
  }
  if (preset === 'last_month') {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    return { startDate: formatDateKey(start), endDate: formatDateKey(end) };
  }
  if (preset === 'last_quarter') {
    const start = new Date(today.getFullYear(), currentQuarterStartMonth - 3, 1);
    const end = new Date(today.getFullYear(), currentQuarterStartMonth, 0);
    return { startDate: formatDateKey(start), endDate: formatDateKey(end) };
  }
  if (preset === 'last_12_months') return { startDate: formatDateKey(addDays(rollingEnd, -364)), endDate: formatDateKey(rollingEnd) };
  if (preset === 'last_year') {
    const start = new Date(today.getFullYear() - 1, 0, 1);
    const end = new Date(today.getFullYear() - 1, 11, 31);
    return { startDate: formatDateKey(start), endDate: formatDateKey(end) };
  }

  return { startDate: formatDateKey(addDays(today, -89)), endDate: formatDateKey(today) };
};

const getComparisonRange = (
  startDateKey: string,
  endDateKey: string,
  comparisonType: ComparisonType,
  today = new Date(),
  preset?: DatePresetId,
) => {
  if (comparisonType === 'none' || comparisonType === 'custom') return null;
  const startDate = parseDateKey(startDateKey);
  const endDate = parseDateKey(endDateKey);
  if (!startDate || !endDate) return null;
  const days = getInclusiveDays(startDate, endDate);

  if (comparisonType === 'previous_period') {
    if (preset === 'week_to_date') {
      return {
        startDate: formatDateKey(addDays(startDate, -7)),
        endDate: formatDateKey(addDays(endDate, -7)),
      };
    }

    if (preset === 'month_to_date') {
      return {
        startDate: formatDateKey(addMonths(startDate, -1)),
        endDate: formatDateKey(addMonths(endDate, -1)),
      };
    }

    if (preset === 'quarter_to_date') {
      const previousQuarterStart = addMonths(startDate, -3);
      return {
        startDate: formatDateKey(previousQuarterStart),
        endDate: formatDateKey(addDays(previousQuarterStart, days - 1)),
      };
    }

    if (preset === 'year_to_date') {
      const previousYearStart = addYears(startDate, -1);
      return {
        startDate: formatDateKey(previousYearStart),
        endDate: formatDateKey(addDays(previousYearStart, days - 1)),
      };
    }

    const comparisonEnd = addDays(startDate, -1);
    return {
      startDate: formatDateKey(addDays(comparisonEnd, -(days - 1))),
      endDate: formatDateKey(comparisonEnd),
    };
  }

  if (comparisonType === 'same_period_last_month') {
    return {
      startDate: formatDateKey(addMonths(startDate, -1)),
      endDate: formatDateKey(addMonths(endDate, -1)),
    };
  }

  const currentYear = startOfLocalDay(today).getFullYear();
  const previousYearStart = startDate.getFullYear() === currentYear
    ? new Date(startDate.getFullYear() - 1, startDate.getMonth(), startDate.getDate())
    : addMonths(startDate, -12);
  const previousYearEnd = endDate.getFullYear() === currentYear
    ? new Date(endDate.getFullYear() - 1, endDate.getMonth(), endDate.getDate())
    : addMonths(endDate, -12);
  return {
    startDate: formatDateKey(previousYearStart),
    endDate: formatDateKey(previousYearEnd),
  };
};

const getComparisonLabel = (selection: DateRangeSelection) => {
  if (selection.comparisonType === 'none') return '';
  if (!selection.comparisonStartDate || !selection.comparisonEndDate) return '';
  return formatRangeLabel(selection.comparisonStartDate, selection.comparisonEndDate);
};

const getDateRangeFromSelection = (selection: DateRangeSelection) => {
  const startDate = parseDateKey(selection.startDate) || startOfLocalDay(new Date());
  const endDate = parseDateKey(selection.endDate) || startOfLocalDay(new Date());
  return {
    start: startOfLocalDay(startDate),
    endExclusive: addDays(endDate, 1),
  };
};

const getComparisonRangeFromSelection = (selection: DateRangeSelection) => {
  if (selection.comparisonType === 'none' || !selection.comparisonStartDate || !selection.comparisonEndDate) return null;
  const startDate = parseDateKey(selection.comparisonStartDate);
  const endDate = parseDateKey(selection.comparisonEndDate);
  if (!startDate || !endDate) return null;
  return {
    start: startOfLocalDay(startDate),
    endExclusive: addDays(endDate, 1),
    label: getComparisonLabel(selection),
  };
};

const getChartInterval = (startDate: Date, endDate: Date): ChartInterval => {
  const days = getInclusiveDays(startDate, addDays(endDate, -1));
  if (days <= 31) return 'day';
  if (days <= 180) return 'week';
  if (days <= 730) return 'month';
  return 'quarter';
};

const getTrendBucketKey = (date: Date, interval: ChartInterval) => {
  if (interval === 'day') return formatDateKey(date);
  if (interval === 'week') {
    const weekStart = addDays(date, -date.getDay());
    return formatDateKey(weekStart);
  }
  if (interval === 'quarter') {
    const quarterStartMonth = Math.floor(date.getMonth() / 3) * 3;
    return `${date.getFullYear()}-Q${Math.floor(quarterStartMonth / 3) + 1}`;
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const getTrendBucketLabel = (date: Date, interval: ChartInterval) => {
  if (interval === 'day' || interval === 'week') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  if (interval === 'quarter') {
    return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
  }

  return `${date.toLocaleString('en-US', { month: 'short' })} ${String(date.getFullYear()).slice(-2)}`;
};

const getTrendPeriodStart = (date: Date, interval: ChartInterval) => {
  if (interval === 'month') {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }
  if (interval === 'quarter') {
    const quarterStartMonth = Math.floor(date.getMonth() / 3) * 3;
    return new Date(date.getFullYear(), quarterStartMonth, 1);
  }
  return new Date(date);
};

const addTrendInterval = (date: Date, interval: ChartInterval) => {
  const nextDate = new Date(date);
  if (interval === 'day') nextDate.setDate(nextDate.getDate() + 1);
  if (interval === 'week') nextDate.setDate(nextDate.getDate() + 7);
  if (interval === 'month') nextDate.setMonth(nextDate.getMonth() + 1);
  if (interval === 'quarter') nextDate.setMonth(nextDate.getMonth() + 3);
  return nextDate;
};

const formatBucketRangeLabel = (startDate: Date, endExclusiveDate: Date) => (
  formatRangeLabel(formatDateKey(startDate), formatDateKey(addDays(endExclusiveDate, -1)))
);

const buildTrendBucketsBetween = (startDate: Date, endExclusiveDate: Date, interval: ChartInterval) => {
  const buckets: Array<{ key: string; label: string; rangeLabel: string; start: Date; end: Date }> = [];
  const cursor = getTrendPeriodStart(startDate, interval);

  while (cursor < endExclusiveDate) {
    const bucketPeriodStart = new Date(cursor);
    const bucketPeriodEnd = addTrendInterval(bucketPeriodStart, interval);
    const bucketStart = bucketPeriodStart < startDate ? new Date(startDate) : bucketPeriodStart;
    const bucketEnd = bucketPeriodEnd < endExclusiveDate ? bucketPeriodEnd : new Date(endExclusiveDate);

    if (bucketStart < bucketEnd) {
      buckets.push({
        key: getTrendBucketKey(bucketPeriodStart, interval),
        label: getTrendBucketLabel(bucketPeriodStart, interval),
        rangeLabel: formatBucketRangeLabel(bucketStart, bucketEnd),
        start: bucketStart,
        end: bucketEnd,
      });
    }

    cursor.setTime(bucketPeriodEnd.getTime());
  }

  return buckets;
};

export default function AdminInsightsPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const today = useMemo(() => startOfLocalDay(new Date()), []);
  const [isLoading, setIsLoading] = useState(true);
  const [performanceTrend, setPerformanceTrend] = useState<PerformanceTrendPoint[]>([]);
  const [monthlyRevenueTrend, setMonthlyRevenueTrend] = useState<MonthlyRevenuePoint[]>([]);
  const [activePerformanceMetric, setActivePerformanceMetric] = useState<PerformanceMetric>('revenue');
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [unitsSold, setUnitsSold] = useState(0);
  const [avgOrderValue, setAvgOrderValue] = useState(0);
  const [comparisonMetrics, setComparisonMetrics] = useState<ComparisonMetrics>({
    label: '',
    totalRevenue: null,
    totalOrders: null,
    unitsSold: null,
    avgOrderValue: null,
    unitsPerStorePerWeek: null,
    activeRetailers: null,
    reorderRate: null,
    activeStates: null,
  });
  const [activeRetailers, setActiveRetailers] = useState(0);
  const [retailersWithoutOrders, setRetailersWithoutOrders] = useState<RetailerRecord[]>([]);
  const [locationsAffiliatedWithOrderingAccounts, setLocationsAffiliatedWithOrderingAccounts] = useState(0);
  const [servedRetailerLocations, setServedRetailerLocations] = useState(0);
  const [newLocationsThisMonth, setNewLocationsThisMonth] = useState(0);
  const [reorderRate, setReorderRate] = useState(0);
  const [atRiskRetailers, setAtRiskRetailers] = useState<AtRiskRetailer[]>([]);
  const [stateRevenue, setStateRevenue] = useState<{ state: string; revenue: number }[]>([]);
  const [topMarketMetrics, setTopMarketMetrics] = useState<RankedMarketMetric[]>([]);
  const [activeStates, setActiveStates] = useState(0);
  const [topRetailersByRevenue, setTopRetailersByRevenue] = useState<RetailerStats[]>([]);
  const [topRetailersByOrders, setTopRetailersByOrders] = useState<RetailerStats[]>([]);
  const [unitsPerStoreMetrics, setUnitsPerStoreMetrics] = useState<UnitsPerStoreMetrics>({ overall: 0 });
  const [skuOptions, setSkuOptions] = useState<SkuOption[]>([]);
  const [skuComparisons, setSkuComparisons] = useState<SkuComparison[]>([]);
  const [topSkuMetrics, setTopSkuMetrics] = useState<RankedSkuMetric[]>([]);
  const [storeSkuSnapshots, setStoreSkuSnapshots] = useState<StoreSkuSnapshot[]>([]);
  const [selectedSkuIds, setSelectedSkuIds] = useState<string[]>([]);
  const [skuSearchQuery, setSkuSearchQuery] = useState('');
  const [pipedriveDealByRetailer, setPipedriveDealByRetailer] = useState<Record<string, number>>({});
  const [comparisonDivisorWeeks, setComparisonDivisorWeeks] = useState(MIN_RUNNING_WEEKS);
  const [velocityWindowLabel, setVelocityWindowLabel] = useState('Running average since first order');
  const [successInsights, setSuccessInsights] = useState<RetailerSuccessInsights | null>(null);
  const [currentPromo, setCurrentPromo] = useState<CurrentAstroPromo>(defaultCurrentAstroPromo);
  const [activeView, setActiveView] = useState<InsightsView>(() => {
    const view = searchParams.get('view') as InsightsView | null;
    return view && insightsViews.some((option) => option.id === view) ? view : 'overview';
  });
  const [activeHealthPanel, setActiveHealthPanel] = useState<RetailerHealthPanel>(() => {
    const panel = searchParams.get('panel') as RetailerHealthPanel | null;
    return panel && retailerHealthPanels.some((option) => option.id === panel) ? panel : 'summary';
  });
  const [dateSelection, setDateSelection] = useState<DateRangeSelection>(() => {
    return getDateSelectionFromSearchParams(new URLSearchParams(searchParams.toString()), today);
  });
  const [showComparisonSeries, setShowComparisonSeries] = useState(true);

  useEffect(() => {
    fetchInsights();
  }, [dateSelection]);

  useEffect(() => {
    const view = searchParams.get('view') as InsightsView | null;
    const panel = searchParams.get('panel') as RetailerHealthPanel | null;
    const nextView = view && insightsViews.some((option) => option.id === view) ? view : 'overview';
    const nextPanel = panel && retailerHealthPanels.some((option) => option.id === panel) ? panel : 'summary';
    const nextSelection = getDateSelectionFromSearchParams(new URLSearchParams(searchParams.toString()), today);

    if (activeView !== nextView) setActiveView(nextView);
    if (activeHealthPanel !== nextPanel) setActiveHealthPanel(nextPanel);
    if (!isDateSelectionEqual(dateSelection, nextSelection)) setDateSelection(nextSelection);
  }, [searchParams, today]);

  useEffect(() => {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    params.set('view', activeView);
    if (activeView === 'health') {
      params.set('panel', activeHealthPanel);
    } else {
      params.delete('panel');
    }
    params.set('preset', dateSelection.preset);
    params.set('start', dateSelection.startDate);
    params.set('end', dateSelection.endDate);
    params.set('compare', dateSelection.comparisonType);
    params.set('today', String(dateSelection.includeToday));
    if (dateSelection.comparisonType === 'none') {
      params.delete('cstart');
      params.delete('cend');
    } else {
      params.set('cstart', dateSelection.comparisonStartDate);
      params.set('cend', dateSelection.comparisonEndDate);
    }
    router.push(`/admin/insights?${params.toString()}`, { scroll: false });
  }, [activeHealthPanel, activeView, dateSelection, router]);

  const fetchInsights = async () => {
    setIsLoading(true);
    try {
      const orders: OrderRecord[] = [];
      for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
        const { data: orderPage, error: ordersError } = await supabase
          .from('orders')
          .select(`
            id,
            retailer_id,
            location_id,
            total,
            status,
            created_at,
            retailer:retailers(id, company_name, business_address, created_at),
            order_items(
              order_id,
              quantity,
              product_id,
              product:products(id, name, size, category)
            )
          `)
          .range(from, from + SUPABASE_PAGE_SIZE - 1);

        if (ordersError) throw ordersError;
        const typedOrderPage = (orderPage || []) as unknown as OrderRecord[];
        orders.push(...typedOrderPage);
        if (typedOrderPage.length < SUPABASE_PAGE_SIZE) break;
      }

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

      const selectedRange = getDateRangeFromSelection(dateSelection);
      const previousRange = getComparisonRangeFromSelection(dateSelection);
      const validOrders = (orders as OrderRecord[] | null || []).filter(order => order.status !== 'canceled');
      const retailerIdsWithOrders = new Set(
        validOrders.flatMap((order) => order.retailer_id ? [order.retailer_id] : []),
      );
      const nextRetailersWithoutOrders = (retailers as RetailerRecord[] | null || [])
        .filter((retailer) => !retailerIdsWithOrders.has(retailer.id))
        .sort((a, b) => a.company_name.localeCompare(b.company_name));
      setRetailersWithoutOrders(nextRetailersWithoutOrders);
      const affiliatedShipToLocationCount = (retailerLocations as RetailerLocationRecord[] | null || [])
        .filter((location) => retailerIdsWithOrders.has(location.retailer_id))
        .length;
      setLocationsAffiliatedWithOrderingAccounts(retailerIdsWithOrders.size + affiliatedShipToLocationCount);

      const fulfilledDestinationKeys = new Set<string>();
      validOrders.forEach((order) => {
        if (!order.retailer_id || (order.status !== 'shipped' && order.status !== 'delivered')) return;
        fulfilledDestinationKeys.add(
          order.location_id ? `location:${order.location_id}` : `retailer:${order.retailer_id}`,
        );
      });
      setServedRetailerLocations(fulfilledDestinationKeys.size);
      const reportingOrders = validOrders.filter((order) => {
        const orderDate = new Date(order.created_at);
        return orderDate >= selectedRange.start && orderDate < selectedRange.endExclusive;
      });
      const previousOrders = previousRange
        ? validOrders.filter((order) => {
          const orderDate = new Date(order.created_at);
          return orderDate >= previousRange.start && orderDate < previousRange.endExclusive;
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

      const orderItems = validOrders.flatMap((order) => (
        (order.order_items || []).map((item) => ({
          ...item,
          order_id: item.order_id || order.id,
          product: Array.isArray(item.product) ? item.product[0] : item.product,
          order: {
            status: order.status,
            retailer_id: order.retailer_id,
            location_id: order.location_id,
            created_at: order.created_at,
          },
        }))
      ));

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
        if (!item.order?.created_at) return sum;
        const orderDate = new Date(item.order.created_at);
        if (orderDate < selectedRange.start || orderDate >= selectedRange.endExclusive) return sum;
        return sum + (item.quantity || 0);
      }, 0);
      const previousUnitsSoldValue = previousRange
        ? (orderItems || []).reduce((sum: number, item: any) => {
          if (item.order?.status === 'canceled' || !item.order?.created_at) return sum;
          const orderDate = new Date(item.order.created_at);
          if (orderDate < previousRange.start || orderDate >= previousRange.endExclusive) return sum;
          return sum + (item.quantity || 0);
        }, 0)
        : null;
      const itemRows = (orderItems as Array<{
        quantity: number | null;
        product_id?: string | null;
        product?: ProductRecord;
          order?: { status?: string | null; retailer_id?: string | null; location_id?: string | null; created_at?: string | null } | null;
      }> | null) || [];

      const currentYear = today.getFullYear();
      const currentMonthIndex = today.getMonth();
      const currentDayOfMonth = today.getDate();
      const sumOrdersBetween = (start: Date, endExclusive: Date) => {
        const ordersInRange = validOrders.filter((order) => {
          const orderDate = new Date(order.created_at);
          return orderDate >= start && orderDate < endExclusive;
        });
        return {
          revenue: ordersInRange.reduce((sum, order) => sum + (Number(order.total) || 0), 0),
          orders: ordersInRange.length,
        };
      };
      const sumUnitsBetween = (start: Date, endExclusive: Date) => (
        itemRows.reduce((sum, item) => {
          if (item.order?.status === 'canceled' || !item.order?.created_at) return sum;
          const orderDate = new Date(item.order.created_at);
          if (orderDate < start || orderDate >= endExclusive) return sum;
          return sum + (item.quantity || 0);
        }, 0)
      );

      setMonthlyRevenueTrend(
        Array.from({ length: currentMonthIndex + 1 }, (_, monthIndex) => {
          const monthStart = new Date(currentYear, monthIndex, 1);
          const fullMonthEndExclusive = new Date(currentYear, monthIndex + 1, 1);
          const isCurrentMonth = monthIndex === currentMonthIndex;
          const monthEndExclusive = isCurrentMonth ? addDays(today, 1) : fullMonthEndExclusive;
          const monthSummary = sumOrdersBetween(monthStart, monthEndExclusive);
          const previousMonthStart = new Date(currentYear, monthIndex - 1, 1);
          const previousMonthEndExclusive = new Date(currentYear, monthIndex, 1);
          const previousMonthLastDay = new Date(previousMonthStart.getFullYear(), previousMonthStart.getMonth() + 1, 0).getDate();
          const previousComparableEndExclusive = isCurrentMonth
            ? addDays(new Date(previousMonthStart.getFullYear(), previousMonthStart.getMonth(), Math.min(currentDayOfMonth, previousMonthLastDay)), 1)
            : previousMonthEndExclusive;
          const previousMonthSummary = monthIndex > 0 || isCurrentMonth
            ? sumOrdersBetween(previousMonthStart, previousMonthEndExclusive)
            : null;
          const comparisonSummary = monthIndex > 0 || isCurrentMonth
            ? sumOrdersBetween(previousMonthStart, previousComparableEndExclusive)
            : null;
          const comparisonRevenue = comparisonSummary?.revenue ?? null;

          return {
            month: monthStart.toLocaleString('en-US', { month: 'short' }),
            rangeLabel: formatBucketRangeLabel(monthStart, monthEndExclusive),
            revenue: monthSummary.revenue,
            orders: monthSummary.orders,
            units: sumUnitsBetween(monthStart, monthEndExclusive),
            isCurrentMonth,
            comparisonLabel: comparisonSummary
              ? isCurrentMonth
                ? `${previousMonthStart.toLocaleString('en-US', { month: 'short' })} 1-${Math.min(currentDayOfMonth, previousMonthLastDay)}`
                : previousMonthStart.toLocaleString('en-US', { month: 'long' })
              : null,
            comparisonRevenue,
            fullPreviousMonthLabel: previousMonthSummary
              ? previousMonthStart.toLocaleString('en-US', { month: 'long' })
              : null,
            fullPreviousMonthRevenue: previousMonthSummary?.revenue ?? null,
            pacingPercent: comparisonRevenue && comparisonRevenue > 0
              ? ((monthSummary.revenue - comparisonRevenue) / comparisonRevenue) * 100
              : null,
          };
        }),
      );

      setTotalRevenue(totalRevenueValue);
      setUnitsSold(unitsSoldValue);
      setAvgOrderValue(totalOrders > 0 ? totalRevenueValue / totalOrders : 0);

      const daysSinceWindowStart = getInclusiveDays(selectedRange.start, addDays(selectedRange.endExclusive, -1));
      const divisorWeeks = Math.max(MIN_RUNNING_WEEKS, daysSinceWindowStart / 7);
      const effectiveUnitsWindowStart = selectedRange.start;

      setVelocityWindowLabel(
        `${getPresetLabel(dateSelection.preset)} average (${divisorWeeks.toFixed(1)} weeks)`,
      );
      setComparisonDivisorWeeks(divisorWeeks);

      const summarizeVelocityWindow = (windowStart: Date, windowEndExclusive: Date) => {
        const windowDays = getInclusiveDays(windowStart, addDays(windowEndExclusive, -1));
        const weeks = Math.max(MIN_RUNNING_WEEKS, windowDays / 7);
        const unitsByStore = new Map<string, number>();
        const skuUnitsByStoreForWindow = new Map<string, Map<string, number>>();
        itemRows.forEach((item) => {
          if (item.order?.status === 'canceled' || !item.order?.retailer_id || !item.order?.created_at) return;
          const orderDate = new Date(item.order.created_at);
          if (orderDate < windowStart || orderDate >= windowEndExclusive) return;
          const storeKey = item.order.location_id || `retailer:${item.order.retailer_id}`;
          unitsByStore.set(storeKey, (unitsByStore.get(storeKey) || 0) + (item.quantity || 0));
          if (item.product_id) {
            const skuTotalsForStore = skuUnitsByStoreForWindow.get(storeKey) || new Map<string, number>();
            skuTotalsForStore.set(item.product_id, (skuTotalsForStore.get(item.product_id) || 0) + (item.quantity || 0));
            skuUnitsByStoreForWindow.set(storeKey, skuTotalsForStore);
          }
        });
        const totalUnits = Array.from(unitsByStore.values()).reduce((sum, quantity) => sum + quantity, 0);
        const storeCount = unitsByStore.size;
        const skuStoreCounts = new Map<string, number>();
        const skuTotalUnits = new Map<string, number>();
        skuUnitsByStoreForWindow.forEach((skuMap) => {
          skuMap.forEach((units, skuId) => {
            if (units <= 0) return;
            skuTotalUnits.set(skuId, (skuTotalUnits.get(skuId) || 0) + units);
            skuStoreCounts.set(skuId, (skuStoreCounts.get(skuId) || 0) + 1);
          });
        });

        return {
          overall: storeCount > 0 ? totalUnits / storeCount / weeks : 0,
          skuMetrics: new Map(Array.from(skuTotalUnits.entries()).map(([skuId, total]) => {
            const skuStoreCount = Math.max(skuStoreCounts.get(skuId) || 0, 1);
            return [skuId, total / skuStoreCount / weeks];
          })),
        };
      };

      const previousVelocitySummary = previousRange
        ? summarizeVelocityWindow(previousRange.start, previousRange.endExclusive)
        : null;

      const unitsByRetailerInWindow = new Map<string, number>();
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
        if (orderDate < effectiveUnitsWindowStart || orderDate >= selectedRange.endExclusive) return;
        const storeKey = item.order.location_id || `retailer:${item.order.retailer_id}`;
        if (item.product_id) {
          skuLabels.set(item.product_id, formatSkuLabel(item.product, item.product_id));
          const skuTotalsForStore = skuUnitsByStore.get(storeKey) || new Map<string, number>();
          skuTotalsForStore.set(item.product_id, (skuTotalsForStore.get(item.product_id) || 0) + (item.quantity || 0));
          skuUnitsByStore.set(storeKey, skuTotalsForStore);
        }
        unitsByRetailerInWindow.set(
          item.order.retailer_id,
          (unitsByRetailerInWindow.get(item.order.retailer_id) || 0) + (item.quantity || 0),
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
            unitsPerStorePerWeek: totalUnits / storeCount / divisorWeeks,
          };
        })
        .filter((retailer) => retailer.totalUnits > 0);

      const totalStoresInWindow = retailerUnitsPerStore.reduce((sum, retailer) => sum + retailer.storeCount, 0);
      const totalUnitsInWindow = retailerUnitsPerStore.reduce((sum, retailer) => sum + retailer.totalUnits, 0);
      const overallUnitsPerStorePerWeek =
        totalStoresInWindow > 0 ? totalUnitsInWindow / totalStoresInWindow / divisorWeeks : 0;

      const nextSkuOptions = Array.from(skuLabels.entries())
        .map(([id, label]) => ({ id, label }))
        .sort((a, b) => a.label.localeCompare(b.label));
      setSkuOptions(nextSkuOptions);

      const nextStoreSkuSnapshots = Array.from(skuUnitsByStore.entries()).map(([storeKey, skuMap]) => ({
        storeKey,
        skuUnits: Object.fromEntries(skuMap),
      }));
      setStoreSkuSnapshots(nextStoreSkuSnapshots);

      const skuStoreCounts = new Map<string, number>();
      const skuTotalUnits = new Map<string, number>();
      skuUnitsByStore.forEach((skuMap) => {
        skuMap.forEach((units, skuId) => {
          if (units <= 0) return;
          skuTotalUnits.set(skuId, (skuTotalUnits.get(skuId) || 0) + units);
          skuStoreCounts.set(skuId, (skuStoreCounts.get(skuId) || 0) + 1);
        });
      });
      setTopSkuMetrics(
        Array.from(skuTotalUnits.entries())
          .map(([skuId, totalUnits]) => {
            const storeCount = Math.max(skuStoreCounts.get(skuId) || 0, 1);
            return {
              skuId,
              label: skuLabels.get(skuId) || skuId,
              totalUnits,
              unitsPerStorePerWeek: totalUnits / storeCount / divisorWeeks,
              previousUnitsPerStorePerWeek: previousVelocitySummary?.skuMetrics.get(skuId) ?? null,
              percentChange: previousVelocitySummary?.skuMetrics.get(skuId)
                ? (((totalUnits / storeCount / divisorWeeks) - (previousVelocitySummary.skuMetrics.get(skuId) || 0)) / (previousVelocitySummary.skuMetrics.get(skuId) || 1)) * 100
                : null,
            };
          })
          .sort((a, b) => b.unitsPerStorePerWeek - a.unitsPerStorePerWeek)
          .slice(0, 5),
      );

      setUnitsPerStoreMetrics({
        overall: overallUnitsPerStorePerWeek,
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

      const newRetailersCount = (retailers as RetailerRecord[] | null || []).filter(retailer => {
        const createdAt = new Date(retailer.created_at);
        return createdAt >= selectedRange.start && createdAt < selectedRange.endExclusive;
      }).length;
      const newLocationCount = (retailerLocations as RetailerLocationRecord[] | null || []).filter(location => {
        const createdAt = new Date(location.created_at);
        return createdAt >= selectedRange.start && createdAt < selectedRange.endExclusive;
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

      const riskThreshold = selectedRange.start;
      const atRisk = Array.from(allTimeRetailerStats.values())
        .filter(retailer => retailer.last_order_date < riskThreshold)
        .map(retailer => ({
          id: retailer.id,
          company_name: retailer.company_name,
          last_order_date: retailer.last_order_date,
          days_since: Math.floor((selectedRange.endExclusive.getTime() - retailer.last_order_date.getTime()) / MS_IN_DAY),
        }))
        .sort((a, b) => b.days_since - a.days_since);
      setAtRiskRetailers(atRisk);

      const stateRevenueMap = new Map<string, number>();
      const stateRetailersMap = new Map<string, Set<string>>();
      reportingOrders.forEach(order => {
        const state = parseStateFromAddress(order.retailer?.business_address);
        if (!state) return;
        stateRevenueMap.set(state, (stateRevenueMap.get(state) || 0) + (Number(order.total) || 0));
        if (order.retailer_id) {
          const retailersForState = stateRetailersMap.get(state) || new Set<string>();
          retailersForState.add(order.retailer_id);
          stateRetailersMap.set(state, retailersForState);
        }
      });
      const previousStateRevenueMap = new Map<string, number>();
      previousOrders.forEach(order => {
        const state = parseStateFromAddress(order.retailer?.business_address);
        if (!state) return;
        previousStateRevenueMap.set(state, (previousStateRevenueMap.get(state) || 0) + (Number(order.total) || 0));
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
        totalOrders: previousRange ? previousTotalOrders : null,
        unitsSold: previousUnitsSoldValue,
        avgOrderValue: previousAvgOrderValue,
        unitsPerStorePerWeek: previousVelocitySummary?.overall ?? null,
        activeRetailers: previousActiveRetailerCount,
        reorderRate: previousReorderRate,
        activeStates: previousRange ? previousActiveStateSet.size : null,
      });

      const summarizeTrendBuckets = (
        buckets: Array<{ key: string; start: Date; end: Date }>,
        ordersToSummarize: OrderRecord[],
        itemsToSummarize: Array<{
          quantity: number | null;
          order?: { status?: string | null; retailer_id?: string | null; location_id?: string | null; created_at?: string | null } | null;
        }>,
      ) => {
        const bucketSummaries = new Map<string, { revenue: number; orders: number; units: number; storeKeys: Set<string>; weeks: number }>();
        buckets.forEach((bucket) => {
          bucketSummaries.set(bucket.key, {
            revenue: 0,
            orders: 0,
            units: 0,
            storeKeys: new Set<string>(),
            weeks: Math.max(MIN_RUNNING_WEEKS / 7, (bucket.end.getTime() - bucket.start.getTime()) / MS_IN_DAY / 7),
          });
        });

        ordersToSummarize.forEach((order) => {
          const orderDate = new Date(order.created_at);
          const bucket = buckets.find((candidate) => orderDate >= candidate.start && orderDate < candidate.end);
          if (!bucket) return;
          const summary = bucketSummaries.get(bucket.key);
          if (!summary) return;
          summary.revenue += Number(order.total) || 0;
          summary.orders += 1;
          if (order.retailer_id) {
            summary.storeKeys.add(order.location_id || `retailer:${order.retailer_id}`);
          }
        });

        itemsToSummarize.forEach((item) => {
          if (item.order?.status === 'canceled' || !item.order?.created_at) return;
          const orderDate = new Date(item.order.created_at);
          const bucket = buckets.find((candidate) => orderDate >= candidate.start && orderDate < candidate.end);
          if (!bucket) return;
          const summary = bucketSummaries.get(bucket.key);
          if (!summary) return;
          summary.units += item.quantity || 0;
          if (item.order.retailer_id) {
            summary.storeKeys.add(item.order.location_id || `retailer:${item.order.retailer_id}`);
          }
        });

        return bucketSummaries;
      };

      const chartInterval = getChartInterval(selectedRange.start, selectedRange.endExclusive);
      const trendBuckets = buildTrendBucketsBetween(selectedRange.start, selectedRange.endExclusive, chartInterval);
      const previousTrendBuckets = previousRange
        ? buildTrendBucketsBetween(previousRange.start, previousRange.endExclusive, chartInterval)
        : [];
      const currentTrendSummary = summarizeTrendBuckets(trendBuckets, reportingOrders, itemRows);
      const previousTrendSummary = previousRange
        ? summarizeTrendBuckets(previousTrendBuckets, previousOrders, itemRows)
        : new Map<string, { revenue: number; orders: number; units: number; storeKeys: Set<string>; weeks: number }>();

      setPerformanceTrend(trendBuckets.map((bucket, index) => {
        const current = currentTrendSummary.get(bucket.key);
        const previousBucket = previousTrendBuckets[index];
        const previous = previousBucket ? previousTrendSummary.get(previousBucket.key) : null;
        const currentStores = current?.storeKeys.size || 0;
        const previousStores = previous?.storeKeys.size || 0;

        return {
          period: bucket.label,
          periodRange: bucket.rangeLabel,
          previousPeriodRange: previousBucket?.rangeLabel || null,
          revenue: current?.revenue || 0,
          previousRevenue: previous ? previous.revenue : null,
          orders: current?.orders || 0,
          previousOrders: previous ? previous.orders : null,
          units: current?.units || 0,
          previousUnits: previous ? previous.units : null,
          velocity: current && currentStores > 0 ? current.units / currentStores / current.weeks : 0,
          previousVelocity: previous && previousStores > 0 ? previous.units / previousStores / previous.weeks : null,
        };
      }));

      const stateSparklineMap = new Map<string, number[]>();
      trendBuckets.forEach((bucket) => {
        const bucketRevenueByState = new Map<string, number>();
        reportingOrders.forEach((order) => {
          const orderDate = new Date(order.created_at);
          if (orderDate < bucket.start || orderDate >= bucket.end) return;
          const state = parseStateFromAddress(order.retailer?.business_address);
          if (!state) return;
          bucketRevenueByState.set(state, (bucketRevenueByState.get(state) || 0) + (Number(order.total) || 0));
        });
        stateRevenueList.forEach((stateRow) => {
          const points = stateSparklineMap.get(stateRow.state) || [];
          points.push(bucketRevenueByState.get(stateRow.state) || 0);
          stateSparklineMap.set(stateRow.state, points);
        });
      });

      setTopMarketMetrics(stateRevenueList.slice(0, 5).map((stateRow) => {
        const previousRevenue = previousRange ? previousStateRevenueMap.get(stateRow.state) || 0 : null;
        return {
          state: stateRow.state,
          revenue: stateRow.revenue,
          activeRetailers: stateRetailersMap.get(stateRow.state)?.size || 0,
          previousRevenue,
          percentChange: previousRevenue && previousRevenue > 0 ? ((stateRow.revenue - previousRevenue) / previousRevenue) * 100 : null,
          sparkline: stateSparklineMap.get(stateRow.state) || [],
        };
      }));

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

  const selectedSkuLeader = selectedSkuComparison?.metrics[0] || null;
  const selectedPerformanceMetric = performanceMetricOptions.find((metric) => metric.id === activePerformanceMetric) || performanceMetricOptions[0];
  const performanceDataKey = activePerformanceMetric === 'velocity' ? 'velocity' : activePerformanceMetric;
  const previousPerformanceDataKey =
    activePerformanceMetric === 'revenue'
      ? 'previousRevenue'
      : activePerformanceMetric === 'orders'
        ? 'previousOrders'
        : activePerformanceMetric === 'units'
          ? 'previousUnits'
          : 'previousVelocity';
  const hasPreviousPerformance = performanceTrend.some((point) => point[previousPerformanceDataKey] !== null);
  const totalOrdersInRange = performanceTrend.reduce((sum, point) => sum + point.orders, 0);
  const oldestAccountAwaitingFirstOrder = retailersWithoutOrders
    .filter((retailer) => retailer.created_at)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
  const highPerformerCount = successInsights?.byLifecycle.high_performer || 0;
  const activeDateLabel = getPresetLabel(dateSelection.preset);
  const activeRangeLabel = formatRangeLabel(dateSelection.startDate, dateSelection.endDate);
  const activeComparisonLabel = getComparisonLabel(dateSelection);
  const executiveSummary = useMemo(() => {
    const revenueDelta = comparisonMetrics.totalRevenue !== null
      ? totalRevenue - comparisonMetrics.totalRevenue
      : null;
    const reorderDelta = comparisonMetrics.reorderRate !== null
      ? reorderRate - comparisonMetrics.reorderRate
      : null;
    const revenueDirection = revenueDelta === null
      ? 'Revenue is ready for review'
      : revenueDelta >= 0
        ? 'Revenue is improving'
        : 'Revenue is softer';
    const retentionDirection = reorderDelta === null
      ? 'retailer retention needs context'
      : reorderDelta >= 0
        ? 'retailer retention is improving'
        : 'retailer retention is slipping';
    const focus = retailersWithoutOrders.length > 20
      ? 'first-order conversion remains the biggest opportunity'
      : atRiskRetailers.length > 0
        ? 'retailer health follow-up is the next best focus'
        : 'sales momentum looks broadly healthy';

    return `${revenueDirection} and ${retentionDirection}, but ${focus}.`;
  }, [
    atRiskRetailers.length,
    comparisonMetrics.reorderRate,
    comparisonMetrics.totalRevenue,
    reorderRate,
    retailersWithoutOrders.length,
    totalRevenue,
  ]);

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

  const revenueAtRisk = useMemo(() => {
    if (!successInsights) return 0;
    return successInsights.retailerRows
      .filter((row) => row.lifecycleStatus === 'at_risk' || row.lifecycleStatus === 'inactive')
      .reduce((sum, row) => sum + row.profile.totalSpend, 0);
  }, [successInsights]);

  const overdueHighValueAccounts = useMemo(() => {
    if (!successInsights) return [];
    return successInsights.retailerRows
      .filter((row) => (
        (row.lifecycleStatus === 'at_risk' || row.lifecycleStatus === 'inactive') &&
        row.profile.totalSpend > 0
      ))
      .sort((a, b) => b.profile.totalSpend - a.profile.totalSpend)
      .slice(0, 5);
  }, [successInsights]);

  const ownerPriorities = useMemo(() => {
    const priorities: Array<{
      title: string;
      count: number;
      detail: string;
      action: string;
      view: InsightsView;
      panel?: RetailerHealthPanel;
      tone: 'amber' | 'red' | 'bark' | 'green';
    }> = [];

    if (overdueHighValueAccounts.length > 0) {
      priorities.push({
        title: 'Protect reorder revenue',
        count: overdueHighValueAccounts.length,
        detail: `${formatCurrency(revenueAtRisk)} in historical account value is tied to lapsed or at-risk retailers.`,
        action: 'Review overdue accounts',
        view: 'health',
        panel: 'at_risk',
        tone: 'red',
      });
    }

    if (retailersWithoutOrders.length > 0) {
      priorities.push({
        title: 'Convert first orders',
        count: retailersWithoutOrders.length,
        detail: oldestAccountAwaitingFirstOrder
          ? `${oldestAccountAwaitingFirstOrder.company_name} has waited the longest.`
          : 'New accounts are waiting for a first wholesale order.',
        action: 'Open first-order queue',
        view: 'health',
        panel: 'needs_first_order',
        tone: 'amber',
      });
    }

    if (currentPromo.promoVisible && successInsights?.currentPromoNotRespondedCount) {
      priorities.push({
        title: 'Close promo responses',
        count: successInsights.currentPromoNotRespondedCount,
        detail: `${currentPromo.promoName || 'The current promo'} still needs retailer decisions.`,
        action: 'Start promo outreach',
        view: 'health',
        panel: 'outreach',
        tone: 'bark',
      });
    }

    if (topSkuMetrics[0]) {
      priorities.push({
        title: 'Expand the winning SKU',
        count: 1,
        detail: `${topSkuMetrics[0].label} leads velocity at ${topSkuMetrics[0].unitsPerStorePerWeek.toFixed(2)} units/store/week.`,
        action: 'View product story',
        view: 'skus',
        tone: 'green',
      });
    }

    if (topMarketMetrics[0]) {
      priorities.push({
        title: 'Lean into the strongest market',
        count: topMarketMetrics[0].activeRetailers,
        detail: `${topMarketMetrics[0].state} produced ${formatCurrency(topMarketMetrics[0].revenue)} from active retailers.`,
        action: 'View market story',
        view: 'markets',
        tone: 'green',
      });
    }

    if (priorities.length === 0) {
      priorities.push({
        title: 'Keep the rhythm',
        count: 0,
        detail: 'No urgent wholesale follow-ups stand out for this range.',
        action: 'Review retailers',
        view: 'health',
        panel: 'summary',
        tone: 'green',
      });
    }

    return priorities.slice(0, 5);
  }, [
    currentPromo.promoName,
    currentPromo.promoVisible,
    oldestAccountAwaitingFirstOrder,
    overdueHighValueAccounts,
    retailersWithoutOrders.length,
    revenueAtRisk,
    successInsights,
    topMarketMetrics,
    topSkuMetrics,
  ]);

  const retailerHealthFunnel = useMemo(() => {
    if (!successInsights) return [];
    const rows = successInsights.retailerRows;
    return [
      {
        label: 'Accounts',
        value: successInsights.totalRetailers,
        helper: 'Wholesale relationships created',
      },
      {
        label: 'First order',
        value: rows.filter((row) => row.profile.totalOrders > 0).length,
        helper: 'Accounts that started buying',
      },
      {
        label: 'Reordered',
        value: rows.filter((row) => row.profile.totalOrders >= 2).length,
        helper: 'Accounts with repeat behavior',
      },
      {
        label: 'Healthy',
        value: rows.filter((row) => row.lifecycleStatus === 'active' || row.lifecycleStatus === 'high_performer').length,
        helper: 'Active or high-performing',
      },
      {
        label: 'Needs care',
        value: rows.filter((row) => row.lifecycleStatus === 'at_risk' || row.lifecycleStatus === 'inactive').length,
        helper: 'At risk or inactive',
      },
    ];
  }, [successInsights]);

  const growthDrivers = useMemo(() => {
    const rows: Array<{
      label: string;
      value: string;
      helper: string;
      trend?: number | null;
      view: InsightsView;
      panel?: RetailerHealthPanel;
    }> = [];

    if (topRetailersByRevenue[0]) {
      rows.push({
        label: topRetailersByRevenue[0].company_name,
        value: formatCurrency(topRetailersByRevenue[0].total_spent),
        helper: 'Top retailer by revenue',
        view: 'health',
        panel: 'leaderboards',
      });
    }

    if (topSkuMetrics[0]) {
      rows.push({
        label: topSkuMetrics[0].label,
        value: `${topSkuMetrics[0].unitsPerStorePerWeek.toFixed(2)} UPW`,
        helper: 'Best SKU velocity',
        trend: topSkuMetrics[0].percentChange,
        view: 'skus',
      });
    }

    if (topMarketMetrics[0]) {
      rows.push({
        label: topMarketMetrics[0].state,
        value: formatCurrency(topMarketMetrics[0].revenue),
        helper: `${topMarketMetrics[0].activeRetailers} active retailers`,
        trend: topMarketMetrics[0].percentChange,
        view: 'markets',
      });
    }

    if (highPerformerCount > 0) {
      rows.push({
        label: 'Expansion candidates',
        value: highPerformerCount.toLocaleString(),
        helper: 'High-performing stores to grow',
        view: 'health',
        panel: 'leaderboards',
      });
    }

    return rows;
  }, [highPerformerCount, topMarketMetrics, topRetailersByRevenue, topSkuMetrics]);

  const fastestGrowingSku = useMemo(() => (
    topSkuMetrics
      .filter((sku) => typeof sku.percentChange === 'number')
      .sort((a, b) => (b.percentChange || 0) - (a.percentChange || 0))[0] || null
  ), [topSkuMetrics]);

  const softestSku = useMemo(() => (
    topSkuMetrics
      .filter((sku) => typeof sku.percentChange === 'number')
      .sort((a, b) => (a.percentChange || 0) - (b.percentChange || 0))[0] || null
  ), [topSkuMetrics]);

  const strongestVelocityMarket = useMemo(() => (
    [...topMarketMetrics]
      .sort((a, b) => {
        const bVelocity = b.activeRetailers > 0 ? b.revenue / b.activeRetailers : 0;
        const aVelocity = a.activeRetailers > 0 ? a.revenue / a.activeRetailers : 0;
        return bVelocity - aVelocity;
      })[0] || null
  ), [topMarketMetrics]);

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
            {executiveSummary}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <DateRangePicker
            selection={dateSelection}
            onApply={setDateSelection}
            today={today}
            activeDateLabel={activeDateLabel}
            activeRangeLabel={activeRangeLabel}
            activeComparisonLabel={activeComparisonLabel}
          />
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

      {activeView === 'health' && (
        <section className="sticky top-3 z-20 rounded-xl border border-gray-200 bg-gray-50/95 p-3 shadow-sm backdrop-blur">
          <div className="mb-3 flex items-center justify-between gap-4 px-1">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Retailer Health</h3>
              <p className="text-xs text-gray-500">Choose a focused view instead of scrolling through every report.</p>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Retailer Health views">
            {retailerHealthPanels.map((panel) => {
              const isActive = activeHealthPanel === panel.id;
              const count = panel.id === 'needs_first_order'
                ? retailersWithoutOrders.length
                : panel.id === 'at_risk'
                  ? atRiskRetailers.length
                  : panel.id === 'outreach'
                    ? outreachRows.length
                    : null;

              return (
                <button
                  key={panel.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`retailer-health-${panel.id}`}
                  onClick={() => setActiveHealthPanel(panel.id)}
                  title={panel.description}
                  className={`flex shrink-0 items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors ${
                    isActive
                      ? 'border-bark-500 bg-bark-500 text-white shadow-sm'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-bark-200 hover:text-bark-700'
                  }`}
                >
                  <span>{panel.label}</span>
                  {count !== null && (
                    <span className={`rounded-full px-2 py-0.5 text-xs ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {activeView === 'overview' && (
        <>
      <section className="overflow-hidden rounded-xl border border-bark-100 bg-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="bg-cream-50 px-6 py-6 lg:px-8">
            <p className="text-xs font-semibold uppercase text-bark-500/60">Owner Brief</p>
            <h3 className="mt-2 max-w-3xl text-2xl font-bold leading-tight text-gray-950">
              {executiveSummary}
            </h3>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
              {activeRangeLabel}{activeComparisonLabel ? ` compared with ${activeComparisonLabel}` : ''}. Focus on the accounts, products, and markets most likely to move wholesale momentum.
            </p>
          </div>
          <div className="grid grid-cols-2 border-t border-bark-100 bg-white lg:border-l lg:border-t-0">
            <OwnerMetric label="Revenue" value={formatCurrency(totalRevenue)} current={totalRevenue} previous={comparisonMetrics.totalRevenue} comparisonLabel={comparisonMetrics.label} />
            <OwnerMetric label="Reorder health" value={`${reorderRate.toFixed(1)}%`} current={reorderRate} previous={comparisonMetrics.reorderRate} comparisonLabel={comparisonMetrics.label} mode="points" />
            <OwnerMetric label="Active locations" value={activeRetailers.toLocaleString()} current={activeRetailers} previous={comparisonMetrics.activeRetailers} comparisonLabel={comparisonMetrics.label} />
            <OwnerMetric label="Units / store / week" value={unitsPerStoreMetrics.overall.toFixed(2)} current={unitsPerStoreMetrics.overall} previous={comparisonMetrics.unitsPerStorePerWeek} comparisonLabel={comparisonMetrics.label} />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-gray-400">Today&apos;s Priorities</p>
              <h3 className="mt-1 text-lg font-semibold text-gray-900">The next best wholesale moves</h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveView('health');
                setActiveHealthPanel('outreach');
              }}
              className="inline-flex items-center gap-1 self-start rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 hover:border-bark-200 hover:text-bark-700 sm:self-auto"
            >
              Open outreach <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-5 divide-y divide-gray-100">
            {ownerPriorities.map((priority, index) => (
              <PriorityRow
                key={priority.title}
                index={index + 1}
                title={priority.title}
                count={priority.count}
                detail={priority.detail}
                action={priority.action}
                tone={priority.tone}
                onClick={() => {
                  setActiveView(priority.view);
                  if (priority.panel) setActiveHealthPanel(priority.panel);
                }}
              />
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase text-gray-400">Business Pulse</p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <PulseMetric label="Orders" value={totalOrdersInRange.toLocaleString()} helper="Selected range" />
            <PulseMetric label="Units sold" value={unitsSold.toLocaleString()} helper="Selected range" />
            <PulseMetric label="AOV" value={formatCurrency(avgOrderValue)} helper="Per order" />
            <PulseMetric label="New locations" value={newLocationsThisMonth.toLocaleString()} helper="Selected range" />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase text-gray-400">Retailer Health</p>
              <h3 className="mt-1 text-lg font-semibold text-gray-900">Account progression</h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveView('health');
                setActiveHealthPanel('summary');
              }}
              className="text-sm font-semibold text-bark-600 hover:text-bark-700"
            >
              Details
            </button>
          </div>
          <div className="mt-5 space-y-4">
            {retailerHealthFunnel.map((stage) => (
              <HealthFunnelRow
                key={stage.label}
                label={stage.label}
                value={stage.value}
                helper={stage.helper}
                maxValue={successInsights?.totalRetailers || 0}
              />
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase text-gray-400">Growth Drivers</p>
              <h3 className="mt-1 text-lg font-semibold text-gray-900">What is working right now</h3>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            {growthDrivers.length === 0 ? (
              <EmptyPanel message="No growth drivers are available for this range yet." />
            ) : (
              growthDrivers.map((driver) => (
                <GrowthDriverCard
                  key={`${driver.helper}-${driver.label}`}
                  label={driver.label}
                  value={driver.value}
                  helper={driver.helper}
                  trend={driver.trend}
                  onClick={() => {
                    setActiveView(driver.view);
                    if (driver.panel) setActiveHealthPanel(driver.panel);
                  }}
                />
              ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-gray-400">Trend</p>
            <h3 className="mt-1 text-lg font-semibold text-gray-900">Wholesale momentum</h3>
            <p className="mt-1 text-sm text-gray-500">
              {activePerformanceMetric === 'revenue'
                ? 'Calendar-month revenue for the year, with this month shown month to date.'
                : 'Switch the signal when you want to inspect the movement behind the brief.'}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex flex-wrap gap-2">
              {performanceMetricOptions.map((metric) => {
                const isActive = activePerformanceMetric === metric.id;
                return (
                  <button
                    key={metric.id}
                    type="button"
                    onClick={() => setActivePerformanceMetric(metric.id)}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                      isActive
                        ? 'border-bark-500 bg-bark-500 text-white'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-bark-200 hover:text-bark-700'
                    }`}
                    aria-pressed={isActive}
                  >
                    {metric.label}
                  </button>
                );
              })}
            </div>
            {activePerformanceMetric !== 'revenue' && hasPreviousPerformance && (
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500">
                <input
                  type="checkbox"
                  checked={showComparisonSeries}
                  onChange={(event) => setShowComparisonSeries(event.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-bark-500 focus:ring-bark-500"
                />
                Show comparison
              </label>
            )}
          </div>
        </div>
        <div className="mt-5 h-72">
          {activePerformanceMetric === 'revenue' ? (
            monthlyRevenueTrend.length === 0 ? (
              <EmptyPanel message="No calendar-year revenue data is available yet." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyRevenueTrend} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#EFE6CB" strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fill: '#6B7280', fontSize: 12 }} />
                  <YAxis
                    width={64}
                    tick={{ fill: '#6B7280', fontSize: 12 }}
                    tickFormatter={(value) => formatCompactCurrency(Number(value))}
                  />
                  <Tooltip content={<MonthlyRevenueTooltip />} cursor={{ fill: '#F9F5EA' }} />
                  <Bar dataKey="revenue" name="Revenue" radius={[6, 6, 0, 0]}>
                    {monthlyRevenueTrend.map((point) => (
                      <Cell key={point.month} fill={point.isCurrentMonth ? '#3F1D0B' : '#B59B82'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )
          ) : performanceTrend.length === 0 ? (
            <EmptyPanel message="No performance data is available for this range yet." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <RechartsLineChart data={performanceTrend} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#EFE6CB" strokeDasharray="3 3" />
                <XAxis dataKey="period" minTickGap={24} tick={{ fill: '#6B7280', fontSize: 12 }} />
                <YAxis
                  width={64}
                  tick={{ fill: '#6B7280', fontSize: 12 }}
                  tickFormatter={(value) => Number(value).toLocaleString()}
                />
                <Tooltip
                  content={<PerformanceTooltip metric={activePerformanceMetric} metricLabel={selectedPerformanceMetric.label} comparisonLabel={comparisonMetrics.label} previousKey={previousPerformanceDataKey} />}
                />
                <Line
                  type="monotone"
                  dataKey={performanceDataKey}
                  name={selectedPerformanceMetric.label}
                  stroke={selectedPerformanceMetric.color}
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
                {hasPreviousPerformance && showComparisonSeries && (
                  <Line
                    type="monotone"
                    dataKey={previousPerformanceDataKey}
                    name={comparisonMetrics.label || 'Previous period'}
                    stroke={selectedPerformanceMetric.comparisonColor}
                    strokeWidth={1.5}
                    opacity={0.55}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                )}
              </RechartsLineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
        </>
      )}

      {activeView === 'health' && activeHealthPanel === 'summary' && successInsights && (
        <section id="retailer-health-summary" role="tabpanel" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              <button type="button" onClick={() => setActiveHealthPanel('needs_first_order')} className="text-xs font-medium text-bark-600 mt-2 hover:text-bark-700">
                View accounts →
              </button>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <MetricLabel tooltip="Every main account location plus its saved ship-to locations when that retailer has at least one non-canceled order. Accounts whose only orders are canceled are excluded.">
                Locations Affiliated with Ordering Accounts
              </MetricLabel>
              <p className="text-2xl font-bold text-gray-900 mt-1">{locationsAffiliatedWithOrderingAccounts}</p>
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
              <p className="text-sm text-gray-500">New Retail Locations in Range</p>
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
              <MetricLabel tooltip="Retailers whose last non-canceled order was before the selected range began.">
                At-Risk Retailers
              </MetricLabel>
              <p className="text-2xl font-bold text-gray-900 mt-1">{atRiskRetailers.length}</p>
              <button type="button" onClick={() => setActiveHealthPanel('at_risk')} className="text-xs font-medium text-bark-600 mt-2 hover:text-bark-700">
                Review retailers →
              </button>
            </div>
          </div>

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

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h4 className="text-md font-semibold text-gray-900">Success Tool Adoption</h4>
              <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
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
        </section>
      )}

      {activeView === 'health' && activeHealthPanel === 'outreach' && (
        <section id="retailer-health-outreach" role="tabpanel" className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Outreach Queue</h3>
              <p className="text-sm text-gray-500 mt-1">One prioritized row per retailer that needs follow-up.</p>
            </div>
            <span className="shrink-0 text-xs font-semibold text-gray-500 bg-gray-100 rounded-full px-2 py-1">
              {outreachRows.length} retailers
            </span>
          </div>
          <OutreachQueueTable rows={outreachRows} />
        </section>
      )}

      {activeView === 'skus' && (
      <section className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Product Story</h3>
            <p className="text-sm text-gray-500 mt-1">
              Start with the simple product signals, then use same-store comparisons when you want to dig deeper.
            </p>
          </div>
          <p className="text-xs text-gray-400">{velocityWindowLabel}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <InsightStoryCard
            label="Best velocity"
            value={topSkuMetrics[0]?.label || 'No SKU yet'}
            helper={topSkuMetrics[0] ? `${topSkuMetrics[0].unitsPerStorePerWeek.toFixed(2)} units/store/week` : 'No product velocity in this range'}
            trend={topSkuMetrics[0]?.percentChange}
          />
          <InsightStoryCard
            label="Fastest growing"
            value={fastestGrowingSku?.label || 'No comparison yet'}
            helper={fastestGrowingSku ? 'Biggest velocity gain vs comparison period' : 'Choose a comparison range to see movement'}
            trend={fastestGrowingSku?.percentChange}
          />
          <InsightStoryCard
            label="Needs attention"
            value={softestSku?.label || 'No softening SKU'}
            helper={softestSku ? 'Largest velocity decline among top SKUs' : 'No declining SKU stands out'}
            trend={softestSku?.percentChange}
          />
          <InsightStoryCard
            label="Assortment signal"
            value={`${skuComparisons.length} pairs`}
            helper="Suggested same-store matchups with overlapping retailer demand"
          />
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
        activeHealthPanel === 'needs_first_order' || activeHealthPanel === 'at_risk'
      ) && (
      <section id={`retailer-health-${activeHealthPanel}`} role="tabpanel" className="space-y-4">
        {activeHealthPanel === 'needs_first_order' && (
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
        )}

        {activeHealthPanel === 'at_risk' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <h4 className="text-md font-semibold text-gray-900">At-Risk Retailers</h4>
              <MetricLabel
                className="text-sm text-gray-500"
                tooltip="This list is based on retailers whose last non-canceled order was before the selected range began."
              >
                Rule
              </MetricLabel>
            </div>
            <p className="text-sm text-gray-500 mt-1">No orders during the selected date range</p>
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
        )}
      </section>
      )}

      {activeView === 'markets' && (
      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Market Story</h3>
          <p className="mt-1 text-sm text-gray-500">Use geography to decide where to protect momentum and where to expand next.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <InsightStoryCard
            label="Top revenue market"
            value={topMarketMetrics[0]?.state || 'No market yet'}
            helper={topMarketMetrics[0] ? `${formatCurrency(topMarketMetrics[0].revenue)} in selected revenue` : 'No state revenue in this range'}
            trend={topMarketMetrics[0]?.percentChange}
          />
          <InsightStoryCard
            label="Active states"
            value={activeStates.toLocaleString()}
            helper="States with ordering retailers"
          />
          <InsightStoryCard
            label="Best revenue / retailer"
            value={strongestVelocityMarket?.state || 'No market yet'}
            helper={strongestVelocityMarket ? `${formatCurrency(strongestVelocityMarket.activeRetailers > 0 ? strongestVelocityMarket.revenue / strongestVelocityMarket.activeRetailers : 0)} per active retailer` : 'No market density signal yet'}
            trend={strongestVelocityMarket?.percentChange}
          />
          <InsightStoryCard
            label="Expansion hint"
            value={topMarketMetrics.find((market) => market.activeRetailers <= 5)?.state || topMarketMetrics[0]?.state || 'No market yet'}
            helper="Strong markets with lighter account count deserve prospecting attention"
          />
        </div>
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

      {activeView === 'health' && activeHealthPanel === 'leaderboards' && (
      <section id="retailer-health-leaderboards" role="tabpanel" className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Top 10 Retailers Leaderboard</h3>
        <p className="text-sm text-gray-500 -mt-2">{activeRangeLabel} performance</p>
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

function OwnerMetric({
  label,
  value,
  current,
  previous,
  comparisonLabel,
  mode = 'percent',
}: {
  label: string;
  value: string;
  current: number;
  previous: number | null;
  comparisonLabel: string;
  mode?: 'percent' | 'points';
}) {
  return (
    <div className="min-h-[124px] border-b border-r border-gray-100 p-4 last:border-r-0 even:border-r-0">
      <p className="text-xs font-semibold uppercase text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-950">{value}</p>
      <TrendDelta current={current} previous={previous} label={comparisonLabel} mode={mode} />
    </div>
  );
}

function PriorityRow({
  index,
  title,
  count,
  detail,
  action,
  tone,
  onClick,
}: {
  index: number;
  title: string;
  count: number;
  detail: string;
  action: string;
  tone: 'amber' | 'red' | 'bark' | 'green';
  onClick: () => void;
}) {
  const toneClass = {
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    bark: 'bg-bark-50 text-bark-700',
    green: 'bg-emerald-50 text-emerald-700',
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-start gap-4 py-4 text-left first:pt-0 last:pb-0"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500">
        {index}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-gray-950 group-hover:text-bark-700">{title}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${toneClass}`}>
            {count}
          </span>
        </span>
        <span className="mt-1 block text-sm leading-5 text-gray-500">{detail}</span>
      </span>
      <span className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-bark-600 group-hover:text-bark-700 sm:inline-flex">
        {action} <ArrowUpRight className="h-4 w-4" />
      </span>
    </button>
  );
}

function PulseMetric({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-4">
      <p className="text-xs font-semibold uppercase text-gray-400">{label}</p>
      <p className="mt-2 text-xl font-bold text-gray-950">{value}</p>
      <p className="mt-1 text-xs text-gray-400">{helper}</p>
    </div>
  );
}

function HealthFunnelRow({
  label,
  value,
  helper,
  maxValue,
}: {
  label: string;
  value: number;
  helper: string;
  maxValue: number;
}) {
  const width = maxValue > 0 ? Math.max(5, (value / maxValue) * 100) : 0;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">{label}</p>
          <p className="text-xs text-gray-400">{helper}</p>
        </div>
        <p className="text-lg font-bold text-gray-950">{value.toLocaleString()}</p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-bark-500" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function GrowthDriverCard({
  label,
  value,
  helper,
  trend,
  onClick,
}: {
  label: string;
  value: string;
  helper: string;
  trend?: number | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-gray-100 bg-gray-50 p-4 text-left transition-colors hover:border-bark-200 hover:bg-white"
    >
      <p className="truncate text-sm font-semibold text-gray-950">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-xl font-bold text-bark-700">{value}</p>
          <p className="mt-1 text-xs text-gray-400">{helper}</p>
        </div>
        {typeof trend === 'number' && (
          <span className={`shrink-0 text-xs font-semibold ${trend >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
            {trend >= 0 ? '▲' : '▼'} {formatSignedPercent(Math.abs(trend)).replace('+', '')}
          </span>
        )}
      </div>
    </button>
  );
}

function InsightStoryCard({
  label,
  value,
  helper,
  trend,
}: {
  label: string;
  value: string;
  helper: string;
  trend?: number | null;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase text-gray-400">{label}</p>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xl font-bold text-gray-950">{value}</p>
          <p className="mt-2 text-sm leading-5 text-gray-500">{helper}</p>
        </div>
        {typeof trend === 'number' && (
          <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${trend >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            {trend >= 0 ? '▲' : '▼'} {formatSignedPercent(Math.abs(trend)).replace('+', '')}
          </span>
        )}
      </div>
    </div>
  );
}

function DateRangePicker({
  selection,
  onApply,
  today,
  activeDateLabel,
  activeRangeLabel,
  activeComparisonLabel,
}: {
  selection: DateRangeSelection;
  onApply: (selection: DateRangeSelection) => void;
  today: Date;
  activeDateLabel: string;
  activeRangeLabel: string;
  activeComparisonLabel: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<DateRangeSelection>(selection);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const startDate = parseDateKey(selection.startDate) || today;
    return new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  });
  const maxDate = formatDateKey(today);
  const primaryStart = parseDateKey(draft.startDate);
  const primaryEnd = parseDateKey(draft.endDate);
  const comparisonStart = parseDateKey(draft.comparisonStartDate);
  const comparisonEnd = parseDateKey(draft.comparisonEndDate);
  const primaryDays = primaryStart && primaryEnd ? getInclusiveDays(primaryStart, primaryEnd) : 0;
  const comparisonDays = comparisonStart && comparisonEnd ? getInclusiveDays(comparisonStart, comparisonEnd) : 0;
  const showComparisonWarning = draft.comparisonType === 'custom' && primaryDays > 0 && comparisonDays > 0 && primaryDays !== comparisonDays;
  const isRollingPreset = datePresetGroups.flatMap((group) => group.presets).find((option) => option.id === draft.preset)?.rolling;

  useEffect(() => {
    if (isOpen) {
      setDraft(selection);
      const startDate = parseDateKey(selection.startDate) || today;
      setCalendarMonth(new Date(startDate.getFullYear(), startDate.getMonth(), 1));
    }
  }, [isOpen, selection, today]);

  const updateDraftRange = (nextDraft: DateRangeSelection, nextStartDate: string, nextEndDate: string, nextComparisonType = nextDraft.comparisonType) => {
    const comparison = getComparisonRange(nextStartDate, nextEndDate, nextComparisonType, today, nextDraft.preset);
    return {
      ...nextDraft,
      startDate: nextStartDate,
      endDate: nextEndDate,
      comparisonType: nextComparisonType,
      comparisonStartDate: nextComparisonType === 'custom' ? nextDraft.comparisonStartDate : comparison?.startDate || '',
      comparisonEndDate: nextComparisonType === 'custom' ? nextDraft.comparisonEndDate : comparison?.endDate || '',
    };
  };

  const selectPreset = (preset: DatePresetId) => {
    if (preset === 'custom') {
      setDraft((current) => ({ ...current, preset }));
      return;
    }
    const nextRange = getPresetRange(preset, today, draft.includeToday);
    setDraft((current) => updateDraftRange({ ...current, preset }, nextRange.startDate, nextRange.endDate));
    const startDate = parseDateKey(nextRange.startDate) || today;
    setCalendarMonth(new Date(startDate.getFullYear(), startDate.getMonth(), 1));
  };

  const selectCalendarDate = (dateKey: string) => {
    if (!draft.startDate || (draft.startDate && draft.endDate)) {
      setDraft((current) => updateDraftRange({ ...current, preset: 'custom' }, dateKey, dateKey));
      return;
    }

    const startDate = parseDateKey(draft.startDate);
    const selectedDate = parseDateKey(dateKey);
    if (startDate && selectedDate && selectedDate < startDate) {
      setDraft((current) => updateDraftRange({ ...current, preset: 'custom' }, dateKey, draft.startDate));
    } else {
      setDraft((current) => updateDraftRange({ ...current, preset: 'custom' }, draft.startDate, dateKey));
    }
  };

  const setComparisonType = (comparisonType: ComparisonType) => {
    setDraft((current) => {
      const comparison = getComparisonRange(current.startDate, current.endDate, comparisonType, today, current.preset);
      return {
        ...current,
        comparisonType,
        comparisonStartDate: comparisonType === 'custom' ? current.comparisonStartDate || current.startDate : comparison?.startDate || '',
        comparisonEndDate: comparisonType === 'custom' ? current.comparisonEndDate || current.endDate : comparison?.endDate || '',
      };
    });
  };

  const applyDraft = () => {
    const startDate = parseDateKey(draft.startDate);
    const endDate = parseDateKey(draft.endDate);
    if (!startDate || !endDate || startDate > endDate || endDate > today) return;
    onApply(draft);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-left shadow-sm transition-colors hover:border-bark-200 lg:min-w-[320px]"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <span className="flex min-w-0 items-center gap-3">
          <Calendar className="h-5 w-5 shrink-0 text-bark-500" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-gray-900">{activeDateLabel}</span>
            <span className="block truncate text-xs text-gray-500">
              {activeRangeLabel}{activeComparisonLabel ? ` · Compared with ${activeComparisonLabel}` : ''}
            </span>
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Select insights date range"
          className="absolute right-0 z-40 mt-2 w-[min(980px,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white p-4 shadow-2xl"
        >
          <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
            <div className="space-y-4 rounded-lg bg-cream-50 p-3">
              {datePresetGroups.map((group) => (
                <div key={group.label}>
                  <p className="px-2 text-xs font-semibold uppercase text-gray-400">{group.label}</p>
                  <div className="mt-2 space-y-1">
                    {group.presets.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => selectPreset(preset.id)}
                        className={`w-full rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors ${
                          draft.preset === preset.id
                            ? 'bg-bark-500 text-white'
                            : 'text-gray-600 hover:bg-white hover:text-bark-700'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm font-semibold text-gray-700">
                  Start date
                  <input
                    type="date"
                    value={draft.startDate}
                    max={maxDate}
                    onChange={(event) => setDraft((current) => updateDraftRange({ ...current, preset: 'custom' }, event.target.value, current.endDate))}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bark-500"
                  />
                </label>
                <label className="text-sm font-semibold text-gray-700">
                  End date
                  <input
                    type="date"
                    value={draft.endDate}
                    min={draft.startDate}
                    max={maxDate}
                    onChange={(event) => setDraft((current) => updateDraftRange({ ...current, preset: 'custom' }, current.startDate, event.target.value))}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bark-500"
                  />
                </label>
              </div>

              {isRollingPreset && (
                <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-600">
                  <input
                    type="checkbox"
                    checked={draft.includeToday}
                    onChange={(event) => {
                      const includeToday = event.target.checked;
                      const nextRange = draft.preset === 'custom'
                        ? { startDate: draft.startDate, endDate: draft.endDate }
                        : getPresetRange(draft.preset, today, includeToday);
                      setDraft((current) => updateDraftRange({ ...current, includeToday }, nextRange.startDate, nextRange.endDate));
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-bark-500 focus:ring-bark-500"
                  />
                  Include today
                </label>
              )}

              <div className="grid gap-4 xl:grid-cols-2">
                <CalendarMonth
                  month={calendarMonth}
                  today={today}
                  startDate={primaryStart}
                  endDate={primaryEnd}
                  onSelectDate={selectCalendarDate}
                  onPreviousMonth={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                  onNextMonth={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                  showPrevious
                />
                <CalendarMonth
                  month={new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1)}
                  today={today}
                  startDate={primaryStart}
                  endDate={primaryEnd}
                  onSelectDate={selectCalendarDate}
                  onPreviousMonth={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                  onNextMonth={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                  showNext
                />
              </div>

              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div className="grid gap-3 md:grid-cols-[220px_1fr]">
                  <label className="text-sm font-semibold text-gray-700">
                    Compare
                    <select
                      value={draft.comparisonType}
                      onChange={(event) => setComparisonType(event.target.value as ComparisonType)}
                      className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bark-500"
                    >
                      {comparisonOptions.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="text-sm font-semibold text-gray-700">
                      Comparison start
                      <input
                        type="date"
                        value={draft.comparisonStartDate}
                        disabled={draft.comparisonType !== 'custom'}
                        max={maxDate}
                        onChange={(event) => setDraft((current) => ({ ...current, comparisonStartDate: event.target.value }))}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-bark-500"
                      />
                    </label>
                    <label className="text-sm font-semibold text-gray-700">
                      Comparison end
                      <input
                        type="date"
                        value={draft.comparisonEndDate}
                        disabled={draft.comparisonType !== 'custom'}
                        min={draft.comparisonStartDate}
                        max={maxDate}
                        onChange={(event) => setDraft((current) => ({ ...current, comparisonEndDate: event.target.value }))}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-bark-500"
                      />
                    </label>
                  </div>
                </div>
                {showComparisonWarning && (
                  <p className="mt-2 text-xs font-medium text-amber-700">
                    The comparison range is {comparisonDays} days while the primary range is {primaryDays} days, so rate-of-change comparisons may be less meaningful.
                  </p>
                )}
                <p className="mt-2 text-xs text-gray-500">
                  Dates use the browser's local timezone. Order filters use inclusive start and end dates in the UI, then half-open intervals internally.
                </p>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setIsOpen(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button type="button" onClick={applyDraft} className="rounded-lg bg-bark-500 px-4 py-2 text-sm font-semibold text-white hover:bg-bark-600">
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarMonth({
  month,
  today,
  startDate,
  endDate,
  onSelectDate,
  onPreviousMonth,
  onNextMonth,
  showPrevious = false,
  showNext = false,
}: {
  month: Date;
  today: Date;
  startDate: Date | null;
  endDate: Date | null;
  onSelectDate: (dateKey: string) => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  showPrevious?: boolean;
  showNext?: boolean;
}) {
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = addDays(firstOfMonth, -firstOfMonth.getDay());
  const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));

  return (
    <div className="rounded-lg border border-gray-100 p-3">
      <div className="mb-3 flex items-center justify-between">
        {showPrevious ? (
          <button type="button" onClick={onPreviousMonth} className="rounded-md p-1 text-gray-500 hover:bg-gray-100" aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </button>
        ) : <span className="h-6 w-6" />}
        <p className="text-sm font-semibold text-gray-900">
          {month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </p>
        {showNext ? (
          <button type="button" onClick={onNextMonth} className="rounded-md p-1 text-gray-500 hover:bg-gray-100" aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : <span className="h-6 w-6" />}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gray-400">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1">
        {days.map((date) => {
          const isCurrentMonth = date.getMonth() === month.getMonth();
          const isFuture = date > today;
          const isStart = startDate && formatDateKey(date) === formatDateKey(startDate);
          const isEnd = endDate && formatDateKey(date) === formatDateKey(endDate);
          const isInRange = startDate && endDate && date > startDate && date < endDate;
          return (
            <button
              key={formatDateKey(date)}
              type="button"
              disabled={isFuture}
              onClick={() => onSelectDate(formatDateKey(date))}
              className={`h-9 rounded-md text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:text-gray-300 ${
                isStart || isEnd
                  ? 'bg-bark-500 text-white'
                  : isInRange
                    ? 'bg-bark-50 text-bark-700'
                    : isCurrentMonth
                      ? 'text-gray-700 hover:bg-gray-100'
                      : 'text-gray-300 hover:bg-gray-50'
              }`}
              aria-label={date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MonthlyRevenueTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number | null; payload?: MonthlyRevenuePoint }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  const comparisonDelta = point.comparisonRevenue === null ? null : point.revenue - point.comparisonRevenue;

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-gray-900">
        {label}{point.isCurrentMonth ? ' MTD' : ''}
      </p>
      <p className="mt-1 text-gray-500">{point.rangeLabel}</p>
      <div className="mt-2 space-y-1 text-gray-600">
        <p className="flex justify-between gap-6">
          <span>{point.isCurrentMonth ? 'MTD revenue' : 'Revenue'}</span>
          <span className="font-semibold text-gray-900">{formatCurrency(point.revenue)}</span>
        </p>
        <p className="flex justify-between gap-6">
          <span>Orders</span>
          <span className="font-semibold text-gray-900">{point.orders.toLocaleString()}</span>
        </p>
        <p className="flex justify-between gap-6">
          <span>Units</span>
          <span className="font-semibold text-gray-900">{point.units.toLocaleString()}</span>
        </p>
        {point.comparisonRevenue !== null && point.comparisonLabel && (
          <>
            <p className="flex justify-between gap-6 border-t border-gray-100 pt-2">
              <span>{point.isCurrentMonth ? `${point.comparisonLabel} revenue` : `${point.comparisonLabel} revenue`}</span>
              <span className="font-semibold text-gray-900">{formatCurrency(point.comparisonRevenue)}</span>
            </p>
            <p className="flex justify-between gap-6">
              <span>{point.isCurrentMonth ? 'Pacing' : 'Change'}</span>
              <span className={`font-semibold ${comparisonDelta !== null && comparisonDelta >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {point.pacingPercent === null ? 'n/a' : formatSignedPercent(point.pacingPercent)}
              </span>
            </p>
          </>
        )}
        {point.isCurrentMonth && point.fullPreviousMonthRevenue !== null && point.fullPreviousMonthLabel && (
          <p className="flex justify-between gap-6">
            <span>Full {point.fullPreviousMonthLabel}</span>
            <span className="font-semibold text-gray-900">{formatCurrency(point.fullPreviousMonthRevenue)}</span>
          </p>
        )}
      </div>
    </div>
  );
}

function PerformanceTooltip({
  active,
  payload,
  label,
  metric,
  metricLabel,
  comparisonLabel,
  previousKey,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string | number; value?: number | null; payload?: PerformanceTrendPoint }>;
  label?: string;
  metric: PerformanceMetric;
  metricLabel: string;
  comparisonLabel: string;
  previousKey: string;
}) {
  if (!active || !payload?.length) return null;
  const currentValue = Number(payload.find((item) => item.dataKey !== previousKey)?.value || 0);
  const previousRawValue = payload.find((item) => item.dataKey === previousKey)?.value;
  const previousValue = previousRawValue === null || previousRawValue === undefined ? null : Number(previousRawValue);
  const delta = previousValue === null ? null : currentValue - previousValue;
  const percentDelta = previousValue && previousValue !== 0 && delta !== null ? (delta / previousValue) * 100 : null;
  const point = payload[0]?.payload;
  const formatValue = (value: number) => metric === 'revenue'
    ? formatCurrency(value)
    : value.toLocaleString(undefined, { maximumFractionDigits: metric === 'velocity' ? 2 : 0 });

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-gray-900">{label}</p>
      {point?.periodRange && (
        <p className="mt-1 text-gray-500">{point.periodRange}</p>
      )}
      <div className="mt-2 space-y-1 text-gray-600">
        <p className="flex justify-between gap-6">
          <span>Current {metricLabel}</span>
          <span className="font-semibold text-gray-900">{formatValue(currentValue)}</span>
        </p>
        {previousValue !== null && (
          <>
            <p className="flex justify-between gap-6">
              <span>{point?.previousPeriodRange || comparisonLabel || 'Comparison'}</span>
              <span className="font-semibold text-gray-900">{formatValue(previousValue)}</span>
            </p>
            <p className="flex justify-between gap-6">
              <span>Difference</span>
              <span className={`font-semibold ${delta !== null && delta >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {delta !== null ? `${delta >= 0 ? '+' : '-'}${formatValue(Math.abs(delta))}` : 'n/a'}
              </span>
            </p>
            <p className="flex justify-between gap-6">
              <span>% Difference</span>
              <span className={`font-semibold ${percentDelta !== null && percentDelta >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {percentDelta === null ? 'n/a' : formatSignedPercent(percentDelta)}
              </span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
      {message}
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
          onClick={(event) => event.stopPropagation()}
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
