'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Search, Users, Edit2, Eye, X, CheckCircle, ShoppingCart, DollarSign, Plus, Mail, Download, SlidersHorizontal, MapPin } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

interface RetailerLocationSummary {
  id: string;
  location_name?: string | null;
  business_address?: string | null;
  phone?: string | null;
  public_display_name?: string | null;
}
interface Retailer { id: string; company_name: string; contact_name?: string | null; business_address: string; phone: string; account_number: string; created_at: string; status?: string; email?: string; tax_id?: string | null; how_heard_about_us?: string | null; how_heard_about_us_other?: string | null; locations?: RetailerLocationSummary[] }
interface RetailerWithStats extends Retailer { total_orders: number; total_spent: number; last_order_date: string | null }
type RetailerLocationDisplay = {
  key: string;
  name: string;
  label: string;
  address: string;
  isPrimary: boolean;
};
type BuyingStatusFilter = 'all' | 'never_ordered' | 'ordered_once' | 'repeat_buyer';
type LastOrderFilter = 'any' | 'last_30' | 'days_31_90' | 'days_90_plus' | 'never';
type RevenueFilter = 'any' | 'zero' | 'under_250' | 'between_250_1000' | 'over_1000';
type AccountAgeFilter = 'any' | 'last_30' | 'days_31_90' | 'days_90_plus' | 'days_30_plus_never_ordered';
type SortOption = 'created_desc' | 'name_asc' | 'revenue_desc' | 'revenue_asc' | 'orders_desc' | 'orders_asc' | 'last_order_desc' | 'last_order_asc';
type Notification = {
  type: 'success' | 'error';
  message: string;
};

const buyingStatusOptions: Array<{ value: BuyingStatusFilter; label: string }> = [
  { value: 'all', label: 'All retailers' },
  { value: 'never_ordered', label: 'Never ordered' },
  { value: 'ordered_once', label: 'Ordered once' },
  { value: 'repeat_buyer', label: 'Repeat buyer' },
];

const lastOrderOptions: Array<{ value: LastOrderFilter; label: string }> = [
  { value: 'any', label: 'Any last order' },
  { value: 'last_30', label: 'Last 30 days' },
  { value: 'days_31_90', label: '31–90 days ago' },
  { value: 'days_90_plus', label: '90+ days ago' },
  { value: 'never', label: 'Never' },
];

const revenueOptions: Array<{ value: RevenueFilter; label: string }> = [
  { value: 'any', label: 'Any revenue' },
  { value: 'zero', label: '$0' },
  { value: 'under_250', label: 'Under $250' },
  { value: 'between_250_1000', label: '$250–$1,000' },
  { value: 'over_1000', label: '$1,000+' },
];

const accountAgeOptions: Array<{ value: AccountAgeFilter; label: string }> = [
  { value: 'any', label: 'Any age' },
  { value: 'last_30', label: 'Created last 30 days' },
  { value: 'days_31_90', label: 'Created 31–90 days ago' },
  { value: 'days_90_plus', label: 'Created 90+ days ago' },
  { value: 'days_30_plus_never_ordered', label: '30+ days old, never ordered' },
];

const sortOptions: Array<{ value: SortOption; label: string }> = [
  { value: 'created_desc', label: 'Newest accounts' },
  { value: 'name_asc', label: 'Retailer A–Z' },
  { value: 'revenue_desc', label: 'Revenue high to low' },
  { value: 'revenue_asc', label: 'Revenue low to high' },
  { value: 'orders_desc', label: 'Orders high to low' },
  { value: 'orders_asc', label: 'Orders low to high' },
  { value: 'last_order_desc', label: 'Last order newest' },
  { value: 'last_order_asc', label: 'Last order oldest' },
];

const hearAboutUsLabels: Record<string, string> = {
  facebook_instagram: 'Facebook/Instagram',
  google_search: 'Google Search',
  referral: 'Referral',
  team_outreach: 'Bare Naked team reached out',
  other: 'Other',
};

const US_STATE_ABBREVIATIONS = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC',
]);

const US_STATE_NAMES: Record<string, string> = {
  Alabama: 'AL',
  Alaska: 'AK',
  Arizona: 'AZ',
  Arkansas: 'AR',
  California: 'CA',
  Colorado: 'CO',
  Connecticut: 'CT',
  Delaware: 'DE',
  Florida: 'FL',
  Georgia: 'GA',
  Hawaii: 'HI',
  Idaho: 'ID',
  Illinois: 'IL',
  Indiana: 'IN',
  Iowa: 'IA',
  Kansas: 'KS',
  Kentucky: 'KY',
  Louisiana: 'LA',
  Maine: 'ME',
  Maryland: 'MD',
  Massachusetts: 'MA',
  Michigan: 'MI',
  Minnesota: 'MN',
  Mississippi: 'MS',
  Missouri: 'MO',
  Montana: 'MT',
  Nebraska: 'NE',
  Nevada: 'NV',
  'New Hampshire': 'NH',
  'New Jersey': 'NJ',
  'New Mexico': 'NM',
  'New York': 'NY',
  'North Carolina': 'NC',
  'North Dakota': 'ND',
  Ohio: 'OH',
  Oklahoma: 'OK',
  Oregon: 'OR',
  Pennsylvania: 'PA',
  'Rhode Island': 'RI',
  'South Carolina': 'SC',
  'South Dakota': 'SD',
  Tennessee: 'TN',
  Texas: 'TX',
  Utah: 'UT',
  Vermont: 'VT',
  Virginia: 'VA',
  Washington: 'WA',
  'West Virginia': 'WV',
  Wisconsin: 'WI',
  Wyoming: 'WY',
};

const DAYS_IN_MS = 24 * 60 * 60 * 1000;

const buyingStatusValues = new Set(buyingStatusOptions.map((option) => option.value));
const lastOrderValues = new Set(lastOrderOptions.map((option) => option.value));
const revenueValues = new Set(revenueOptions.map((option) => option.value));
const accountAgeValues = new Set(accountAgeOptions.map((option) => option.value));
const sortValues = new Set(sortOptions.map((option) => option.value));

const getValidatedParam = <T extends string>(params: URLSearchParams, key: string, allowedValues: Set<T>, fallback: T) => {
  const value = params.get(key);
  return value && allowedValues.has(value as T) ? value as T : fallback;
};

const normalizeSearchText = (value: string | number | null | undefined) => (
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
);

export default function AdminRetailersPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialParams = useMemo(() => new URLSearchParams(searchParams.toString()), []);

  const [retailers, setRetailers] = useState<RetailerWithStats[]>([]);
  const [filteredRetailers, setFilteredRetailers] = useState<RetailerWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(() => initialParams.get('q') || '');
  const [buyingStatusFilter, setBuyingStatusFilter] = useState<BuyingStatusFilter>(() => getValidatedParam(initialParams, 'buying', buyingStatusValues, 'all'));
  const [lastOrderFilter, setLastOrderFilter] = useState<LastOrderFilter>(() => getValidatedParam(initialParams, 'lastOrder', lastOrderValues, 'any'));
  const [revenueFilter, setRevenueFilter] = useState<RevenueFilter>(() => getValidatedParam(initialParams, 'revenue', revenueValues, 'any'));
  const [accountStatusFilter, setAccountStatusFilter] = useState(() => initialParams.get('status') || 'all');
  const [stateFilter, setStateFilter] = useState(() => initialParams.get('state') || 'all');
  const [accountAgeFilter, setAccountAgeFilter] = useState<AccountAgeFilter>(() => getValidatedParam(initialParams, 'age', accountAgeValues, 'any'));
  const [sortOption, setSortOption] = useState<SortOption>(() => getValidatedParam(initialParams, 'sort', sortValues, 'created_desc'));
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ company_name: '', business_address: '', phone: '', email: '' });
  const [isUpdating, setIsUpdating] = useState(false);
  const [isLoadingEditRetailer, setIsLoadingEditRetailer] = useState(false);
  const [notification, setNotification] = useState<Notification | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [resendInviteId, setResendInviteId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    company_name: '',
    business_address: '',
    phone: '',
    contact_name: '',
    email: '',
    tax_id: '',
  });

  useEffect(() => { fetchRetailers(); }, []);
  useEffect(() => { filterRetailers(); }, [retailers, searchQuery, buyingStatusFilter, lastOrderFilter, revenueFilter, accountStatusFilter, stateFilter, accountAgeFilter, sortOption]);

  const retailerListQuery = useMemo(() => {
    const nextParams = new URLSearchParams();
    const trimmedSearch = searchQuery.trim();

    if (trimmedSearch) nextParams.set('q', trimmedSearch);
    if (buyingStatusFilter !== 'all') nextParams.set('buying', buyingStatusFilter);
    if (lastOrderFilter !== 'any') nextParams.set('lastOrder', lastOrderFilter);
    if (revenueFilter !== 'any') nextParams.set('revenue', revenueFilter);
    if (accountStatusFilter !== 'all') nextParams.set('status', accountStatusFilter);
    if (stateFilter !== 'all') nextParams.set('state', stateFilter);
    if (accountAgeFilter !== 'any') nextParams.set('age', accountAgeFilter);
    if (sortOption !== 'created_desc') nextParams.set('sort', sortOption);

    return nextParams.toString();
  }, [searchQuery, buyingStatusFilter, lastOrderFilter, revenueFilter, accountStatusFilter, stateFilter, accountAgeFilter, sortOption]);

  useEffect(() => {
    const nextQuery = retailerListQuery;
    const currentQuery = searchParams.toString();
    if (nextQuery === currentQuery) return;

    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [retailerListQuery, pathname, router, searchParams]);

  const fetchRetailers = async () => {
    try {
      const response = await fetch('/api/admin/retailers');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || 'Failed to load retailers');
      }

      setRetailers(result.retailers || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  };

  const filterRetailers = () => {
    const searchTerms = normalizeSearchText(searchQuery).split(' ').filter(Boolean);
    const now = Date.now();
    const matchesSearch = (retailer: RetailerWithStats) => {
      if (searchTerms.length === 0) return true;
      const searchIndex = buildRetailerSearchIndex(retailer);
      return searchTerms.every((term) => searchIndex.includes(term));
    };
    const getDaysSince = (date: string | null | undefined) => (
      date ? Math.floor((now - new Date(date).getTime()) / DAYS_IN_MS) : null
    );
    const matchesBuyingStatus = (retailer: RetailerWithStats) => {
      if (buyingStatusFilter === 'never_ordered') return retailer.total_orders === 0;
      if (buyingStatusFilter === 'ordered_once') return retailer.total_orders === 1;
      if (buyingStatusFilter === 'repeat_buyer') return retailer.total_orders >= 2;
      return true;
    };
    const matchesLastOrder = (retailer: RetailerWithStats) => {
      const daysSinceLastOrder = getDaysSince(retailer.last_order_date);
      if (lastOrderFilter === 'never') return daysSinceLastOrder === null;
      if (lastOrderFilter === 'last_30') return daysSinceLastOrder !== null && daysSinceLastOrder <= 30;
      if (lastOrderFilter === 'days_31_90') return daysSinceLastOrder !== null && daysSinceLastOrder > 30 && daysSinceLastOrder <= 90;
      if (lastOrderFilter === 'days_90_plus') return daysSinceLastOrder !== null && daysSinceLastOrder > 90;
      return true;
    };
    const matchesRevenue = (retailer: RetailerWithStats) => {
      if (revenueFilter === 'zero') return retailer.total_spent === 0;
      if (revenueFilter === 'under_250') return retailer.total_spent > 0 && retailer.total_spent < 250;
      if (revenueFilter === 'between_250_1000') return retailer.total_spent >= 250 && retailer.total_spent <= 1000;
      if (revenueFilter === 'over_1000') return retailer.total_spent > 1000;
      return true;
    };
    const matchesAccountStatus = (retailer: RetailerWithStats) => {
      if (accountStatusFilter === 'all') return true;
      return getRetailerStatus(retailer) === accountStatusFilter;
    };
    const matchesState = (retailer: RetailerWithStats) => {
      if (stateFilter === 'all') return true;
      return getRetailerStates(retailer).includes(stateFilter);
    };
    const matchesAccountAge = (retailer: RetailerWithStats) => {
      const daysSinceCreated = getDaysSince(retailer.created_at);
      if (daysSinceCreated === null) return accountAgeFilter === 'any';
      if (accountAgeFilter === 'last_30') return daysSinceCreated <= 30;
      if (accountAgeFilter === 'days_31_90') return daysSinceCreated > 30 && daysSinceCreated <= 90;
      if (accountAgeFilter === 'days_90_plus') return daysSinceCreated > 90;
      if (accountAgeFilter === 'days_30_plus_never_ordered') return daysSinceCreated > 30 && retailer.total_orders === 0;
      return true;
    };
    const getLastOrderTime = (retailer: RetailerWithStats) => (
      retailer.last_order_date ? new Date(retailer.last_order_date).getTime() : null
    );

    const nextRetailers = retailers
      .filter(retailer => (
        matchesSearch(retailer) &&
        matchesBuyingStatus(retailer) &&
        matchesLastOrder(retailer) &&
        matchesRevenue(retailer) &&
        matchesAccountStatus(retailer) &&
        matchesState(retailer) &&
        matchesAccountAge(retailer)
      ))
      .sort((a, b) => {
        switch (sortOption) {
          case 'name_asc':
            return (a.company_name || '').localeCompare(b.company_name || '');
          case 'revenue_desc':
            return b.total_spent - a.total_spent;
          case 'revenue_asc':
            return a.total_spent - b.total_spent;
          case 'orders_desc':
            return b.total_orders - a.total_orders;
          case 'orders_asc':
            return a.total_orders - b.total_orders;
          case 'last_order_desc': {
            const aTime = getLastOrderTime(a) ?? -Infinity;
            const bTime = getLastOrderTime(b) ?? -Infinity;
            return bTime - aTime;
          }
          case 'last_order_asc': {
            const aTime = getLastOrderTime(a) ?? -Infinity;
            const bTime = getLastOrderTime(b) ?? -Infinity;
            return aTime - bTime;
          }
          case 'created_desc':
          default:
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
      });

    setFilteredRetailers(nextRetailers);
  };

  const resetFilters = () => {
    setSearchQuery('');
    setBuyingStatusFilter('all');
    setLastOrderFilter('any');
    setRevenueFilter('any');
    setAccountStatusFilter('all');
    setStateFilter('all');
    setAccountAgeFilter('any');
    setSortOption('created_desc');
  };

  const getBuyingStatusCount = (filter: BuyingStatusFilter) => {
    if (filter === 'never_ordered') return retailers.filter((retailer) => retailer.total_orders === 0).length;
    if (filter === 'ordered_once') return retailers.filter((retailer) => retailer.total_orders === 1).length;
    if (filter === 'repeat_buyer') return retailers.filter((retailer) => retailer.total_orders >= 2).length;
    return retailers.length;
  };

  const getRetailerStatus = (retailer: RetailerWithStats) => (retailer.status || 'unknown').toLowerCase();

  const formatStatus = (status: string) => (
    status === 'unknown' ? 'Unknown' : status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
  );

  const getRetailerState = (address?: string | null) => {
    if (!address) return null;
    const abbreviationMatches = address.toUpperCase().match(/\b[A-Z]{2}\b/g) || [];
    const abbreviation = abbreviationMatches.find((match) => US_STATE_ABBREVIATIONS.has(match));
    if (abbreviation) return abbreviation;

    const normalizedAddress = address.toLowerCase();
    const stateName = Object.keys(US_STATE_NAMES).find((name) => normalizedAddress.includes(name.toLowerCase()));
    return stateName ? US_STATE_NAMES[stateName] : null;
  };

  const getLocationLabel = (address?: string | null) => {
    if (!address) return '—';
    const state = getRetailerState(address);
    const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2 && state) {
      return `${parts[parts.length - 2]}, ${state}`;
    }
    return address;
  };

  const isGenericLocationName = (value?: string | null) => {
    const normalized = value?.trim().toLowerCase();
    return !normalized || normalized === 'primary address';
  };

  const normalizeLocationKey = (value?: string | null) => (
    normalizeSearchText(value || '')
  );

  const getRetailerLocationDisplays = (retailer: Retailer): RetailerLocationDisplay[] => {
    const locations: RetailerLocationDisplay[] = [];
    const seenAddresses = new Set<string>();
    const primaryAddressKey = normalizeLocationKey(retailer.business_address);

    if (retailer.business_address) {
      seenAddresses.add(primaryAddressKey);
      locations.push({
        key: `primary-${primaryAddressKey}`,
        name: 'Primary',
        label: getLocationLabel(retailer.business_address),
        address: retailer.business_address,
        isPrimary: true,
      });
    }

    for (const location of retailer.locations || []) {
      const addressKey = normalizeLocationKey(location.business_address);
      if (addressKey && seenAddresses.has(addressKey)) continue;
      if (addressKey) seenAddresses.add(addressKey);

      const rawName = location.public_display_name || location.location_name || '';
      const name = isGenericLocationName(rawName) ? 'Ship-to' : rawName.trim();
      const address = location.business_address || '';

      locations.push({
        key: location.id || `${name}-${addressKey || locations.length}`,
        name,
        label: getLocationLabel(address),
        address,
        isPrimary: false,
      });
    }

    return locations;
  };

  const formatRetailerLocationsForExport = (retailer: Retailer) => (
    getRetailerLocationDisplays(retailer)
      .map((location) => `${location.name}: ${location.address || location.label}`)
      .join(' | ')
  );

  const getRetailerStates = (retailer: Retailer) => {
    const states = [
      getRetailerState(retailer.business_address),
      ...((retailer.locations || []).map((location) => getRetailerState(location.business_address))),
    ].filter((state): state is string => Boolean(state));

    return Array.from(new Set(states));
  };

  const accountStatusOptions = Array.from(new Set(retailers.map(getRetailerStatus))).sort();
  const stateOptions = Array.from(new Set(retailers.flatMap(getRetailerStates))).sort();
  const retailerListReturnTo = retailerListQuery ? `${pathname}?${retailerListQuery}` : pathname;
  const getRetailerDetailHref = (retailerId: string) => (
    `/admin/retailers/${retailerId}?returnTo=${encodeURIComponent(retailerListReturnTo)}`
  );

  const formatHearAboutUs = (retailer: Retailer) => {
    const label = retailer.how_heard_about_us ? hearAboutUsLabels[retailer.how_heard_about_us] || retailer.how_heard_about_us : '';
    if (retailer.how_heard_about_us === 'other' && retailer.how_heard_about_us_other) {
      return `${label}: ${retailer.how_heard_about_us_other}`;
    }
    return label || '—';
  };

  const buildRetailerSearchIndex = (retailer: RetailerWithStats) => {
    const searchableValues = [
      retailer.company_name,
      retailer.contact_name,
      retailer.account_number,
      retailer.status,
      retailer.business_address,
      getRetailerState(retailer.business_address),
      retailer.phone,
      retailer.email,
      retailer.tax_id,
      formatHearAboutUs(retailer),
      retailer.total_orders,
      retailer.total_spent,
      ...((retailer.locations || []).flatMap((location) => [
        location.location_name,
        location.public_display_name,
        location.business_address,
        getRetailerState(location.business_address),
        location.phone,
      ])),
    ];

    return normalizeSearchText(searchableValues.filter(Boolean).join(' '));
  };

  const hasActiveFilters = Boolean(
    searchQuery ||
    buyingStatusFilter !== 'all' ||
    lastOrderFilter !== 'any' ||
    revenueFilter !== 'any' ||
    accountStatusFilter !== 'all' ||
    stateFilter !== 'all' ||
    accountAgeFilter !== 'any' ||
    sortOption !== 'created_desc'
  );

  const activeFilterChips = [
    searchQuery ? { label: `Search: ${searchQuery}`, onRemove: () => setSearchQuery('') } : null,
    buyingStatusFilter !== 'all' ? { label: buyingStatusOptions.find((option) => option.value === buyingStatusFilter)?.label || 'Buying status', onRemove: () => setBuyingStatusFilter('all') } : null,
    lastOrderFilter !== 'any' ? { label: lastOrderOptions.find((option) => option.value === lastOrderFilter)?.label || 'Last order', onRemove: () => setLastOrderFilter('any') } : null,
    revenueFilter !== 'any' ? { label: revenueOptions.find((option) => option.value === revenueFilter)?.label || 'Revenue', onRemove: () => setRevenueFilter('any') } : null,
    accountStatusFilter !== 'all' ? { label: `Status: ${formatStatus(accountStatusFilter)}`, onRemove: () => setAccountStatusFilter('all') } : null,
    stateFilter !== 'all' ? { label: `State: ${stateFilter}`, onRemove: () => setStateFilter('all') } : null,
    accountAgeFilter !== 'any' ? { label: accountAgeOptions.find((option) => option.value === accountAgeFilter)?.label || 'Account age', onRemove: () => setAccountAgeFilter('any') } : null,
    sortOption !== 'created_desc' ? { label: `Sort: ${sortOptions.find((option) => option.value === sortOption)?.label}`, onRemove: () => setSortOption('created_desc') } : null,
  ].filter((chip): chip is { label: string; onRemove: () => void } => Boolean(chip));

  const showNotification = (type: Notification['type'], message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const escapeCsvValue = (value: string | number | null | undefined) => {
    const stringValue = value == null ? '' : String(value);
    return `"${stringValue.replace(/"/g, '""')}"`;
  };

  const handleExportRetailers = () => {
    if (filteredRetailers.length === 0) {
      showNotification('error', 'No retailers to export');
      return;
    }

    const headers = [
      'Retailer',
      'Account Number',
      'Status',
      'Address',
      'State',
      'Contact',
      'Email',
      'How Heard About Us',
      'Orders',
      'Total Spent',
      'Last Order',
      'Created At',
      'Locations',
    ];

    const rows = filteredRetailers.map((retailer) => [
      retailer.company_name,
      retailer.account_number,
      formatStatus(getRetailerStatus(retailer)),
      retailer.business_address,
      getRetailerState(retailer.business_address) || '',
      retailer.phone,
      retailer.email || '',
      formatHearAboutUs(retailer),
      retailer.total_orders,
      retailer.total_spent.toFixed(2),
      retailer.last_order_date ? new Date(retailer.last_order_date).toLocaleDateString() : 'Never',
      retailer.created_at ? new Date(retailer.created_at).toLocaleDateString() : '',
      formatRetailerLocationsForExport(retailer),
    ]);

    const csv = [
      headers.map(escapeCsvValue).join(','),
      ...rows.map((row) => row.map(escapeCsvValue).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStamp = new Date().toISOString().split('T')[0];
    const filterSlugs = [
      buyingStatusFilter !== 'all' ? buyingStatusFilter.replace(/_/g, '-') : null,
      lastOrderFilter !== 'any' ? `last-order-${lastOrderFilter.replace(/_/g, '-')}` : null,
      revenueFilter !== 'any' ? `revenue-${revenueFilter.replace(/_/g, '-')}` : null,
      accountStatusFilter !== 'all' ? `status-${accountStatusFilter.replace(/_/g, '-')}` : null,
      stateFilter !== 'all' ? `state-${stateFilter.toLowerCase()}` : null,
      accountAgeFilter !== 'any' ? `created-${accountAgeFilter.replace(/_/g, '-')}` : null,
    ].filter(Boolean);
    const filterSlug = filterSlugs.length > 0 ? filterSlugs.join('-') : 'all';

    link.href = url;
    link.download = `retailers-${filterSlug}-${dateStamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showNotification('success', `Exported ${filteredRetailers.length} retailer${filteredRetailers.length === 1 ? '' : 's'}`);
  };

  const handleEditRetailer = async (retailer: RetailerWithStats) => {
    setIsLoadingEditRetailer(true);
    setEditForm({
      company_name: retailer.company_name || '',
      business_address: retailer.business_address || '',
      phone: retailer.phone || '',
      email: retailer.email || '',
    });
    setShowEditModal(true);
    setPendingEditRetailer(retailer);

    try {
      const response = await fetch(`/api/admin/retailers/${retailer.id}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || 'Failed to load retailer details');
      }

      setEditForm({
        company_name: result.retailer?.company_name || retailer.company_name || '',
        business_address: result.retailer?.business_address || retailer.business_address || '',
        phone: result.retailer?.phone || retailer.phone || '',
        email: result.retailer?.email || '',
      });
    } catch (error) {
      console.error('Error:', error);
      showNotification('error', error instanceof Error ? error.message : 'Failed to load retailer details');
    } finally {
      setIsLoadingEditRetailer(false);
    }
  };

  const [pendingEditRetailer, setPendingEditRetailer] = useState<RetailerWithStats | null>(null);

  const handleUpdateRetailer = async () => {
    if (!pendingEditRetailer) return;
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/admin/retailers/${pendingEditRetailer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || 'Failed to update retailer');
      }

      showNotification('success', 'Retailer updated!');
      setShowEditModal(false);
      setPendingEditRetailer(null);
      fetchRetailers();
    } catch (error) {
      console.error('Error:', error);
      showNotification('error', error instanceof Error ? error.message : 'Failed to update');
    }
    finally { setIsUpdating(false); }
  };

  const handleResendInvite = async (retailer: RetailerWithStats) => {
    setResendInviteId(retailer.id);
    try {
      const response = await fetch('/api/admin/retailers/resend-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retailerId: retailer.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || 'Failed to send setup email');
      showNotification('success', 'Setup email sent!');
    } catch (error) {
      console.error('Error:', error);
      showNotification('error', 'Failed to send setup email');
    } finally {
      setResendInviteId(null);
    }
  };

  const handleCreateRetailer = async () => {
    if (!createForm.company_name || !createForm.email) {
      showNotification('error', 'Company name and email are required');
      return;
    }
    setIsCreating(true);
    try {
      const response = await fetch('/api/admin/retailers/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: createForm.company_name,
          businessAddress: createForm.business_address,
          name: createForm.contact_name,
          email: createForm.email,
          phone: createForm.phone,
          taxId: createForm.tax_id,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || 'Failed to create retailer');
      showNotification('success', 'Invite sent! Retailer can set a password from the email.');
      setShowCreateModal(false);
      setCreateForm({ company_name: '', business_address: '', phone: '', contact_name: '', email: '', tax_id: '' });
      fetchRetailers();
    } catch (error) {
      console.error('Error:', error);
      showNotification('error', 'Failed to create retailer');
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-bark-500"></div></div>;

  return (
    <div className="space-y-6">
      {notification && <div className={cn("fixed top-20 right-6 z-50 border rounded-xl p-4 shadow-lg flex items-center gap-3", notification.type === 'success' ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200")}>{notification.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}<span className={notification.type === 'success' ? 'text-green-900' : 'text-red-900'}>{notification.message}</span></div>}

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="text" placeholder="Search name, address, email, contact, phone..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500" />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={handleExportRetailers}
                disabled={filteredRetailers.length === 0}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                Export Filtered CSV
              </button>
              <button onClick={() => setShowCreateModal(true)} className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-bark-500 text-white rounded-lg hover:bg-bark-600">
                <Plus className="w-4 h-4" />
                New Retailer
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 text-sm font-medium text-gray-600">
                <SlidersHorizontal className="w-4 h-4" />
                Buying status
              </span>
              {buyingStatusOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setBuyingStatusFilter(option.value)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                    buyingStatusFilter === option.value
                      ? 'bg-bark-500 text-white shadow-sm'
                      : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {option.label}
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                    buyingStatusFilter === option.value ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {getBuyingStatusCount(option.value)}
                  </span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
              <div>
                <label htmlFor="last-order-filter" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Last order</label>
                <select
                  id="last-order-filter"
                  value={lastOrderFilter}
                  onChange={(event) => setLastOrderFilter(event.target.value as LastOrderFilter)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-bark-500"
                >
                  {lastOrderOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="revenue-filter" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Revenue</label>
                <select
                  id="revenue-filter"
                  value={revenueFilter}
                  onChange={(event) => setRevenueFilter(event.target.value as RevenueFilter)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-bark-500"
                >
                  {revenueOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="account-status-filter" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Account status</label>
                <select
                  id="account-status-filter"
                  value={accountStatusFilter}
                  onChange={(event) => setAccountStatusFilter(event.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-bark-500"
                >
                  <option value="all">Any status</option>
                  {accountStatusOptions.map((status) => (
                    <option key={status} value={status}>{formatStatus(status)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="state-filter" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">State</label>
                <select
                  id="state-filter"
                  value={stateFilter}
                  onChange={(event) => setStateFilter(event.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-bark-500"
                >
                  <option value="all">Any state</option>
                  {stateOptions.map((state) => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="account-age-filter" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Account age</label>
                <select
                  id="account-age-filter"
                  value={accountAgeFilter}
                  onChange={(event) => setAccountAgeFilter(event.target.value as AccountAgeFilter)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-bark-500"
                >
                  {accountAgeOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="retailer-sort" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Sort by</label>
                <select
                  id="retailer-sort"
                  value={sortOption}
                  onChange={(event) => setSortOption(event.target.value as SortOption)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-bark-500"
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {activeFilterChips.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                <span className="text-sm font-medium text-gray-600">Active filters:</span>
                {activeFilterChips.map((chip) => (
                  <button
                    key={chip.label}
                    onClick={chip.onRemove}
                    className="inline-flex items-center gap-1 rounded-full bg-bark-50 px-3 py-1 text-sm font-medium text-bark-700 hover:bg-bark-100"
                  >
                    {chip.label}
                    <X className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-2 border-t border-gray-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-500">
                Showing <span className="font-semibold text-gray-900">{filteredRetailers.length}</span> of {retailers.length} retailers. Export uses this filtered list.
              </p>
              {hasActiveFilters && (
                <button onClick={resetFilters} className="text-sm font-medium text-bark-600 hover:text-bark-700">
                  Clear filters
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center"><Users className="w-5 h-5 text-purple-600" /></div><div><p className="text-sm text-gray-500">Total Retailers</p><p className="text-xl font-bold text-gray-900">{retailers.length}</p></div></div></div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center"><DollarSign className="w-5 h-5 text-emerald-600" /></div><div><p className="text-sm text-gray-500">Total Revenue</p><p className="text-xl font-bold text-gray-900">{formatCurrency(retailers.reduce((sum, r) => sum + r.total_spent, 0))}</p></div></div></div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><ShoppingCart className="w-5 h-5 text-blue-600" /></div><div><p className="text-sm text-gray-500">Total Orders</p><p className="text-xl font-bold text-gray-900">{retailers.reduce((sum, r) => sum + r.total_orders, 0)}</p></div></div></div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Retailer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orders</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Order</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Locations</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRetailers.length === 0 ? <tr><td colSpan={9} className="px-6 py-12 text-center text-gray-500"><Users className="w-12 h-12 mx-auto mb-4 text-gray-300" /><p>No retailers found</p></td></tr> : filteredRetailers.map((retailer) => (
                <tr key={retailer.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <Link href={getRetailerDetailHref(retailer.id)} className="font-medium text-gray-900 hover:text-bark-600">
                        {retailer.company_name}
                      </Link>
                      <p className="text-sm text-gray-500">
                        <span className="font-mono">{retailer.account_number || 'No account #'}</span>
                        {retailer.email ? <span> · {retailer.email}</span> : null}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                      {formatStatus(getRetailerStatus(retailer))}
                    </span>
                  </td>
                  <td className="px-6 py-4"><span className="font-medium text-gray-900">{retailer.total_orders}</span></td>
                  <td className="px-6 py-4 font-medium text-gray-900">{formatCurrency(retailer.total_spent)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{retailer.last_order_date ? new Date(retailer.last_order_date).toLocaleDateString() : 'Never'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <span className="block max-w-[180px] truncate" title={formatHearAboutUs(retailer)}>{formatHearAboutUs(retailer)}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{retailer.created_at ? new Date(retailer.created_at).toLocaleDateString() : '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {(() => {
                      const retailerLocations = getRetailerLocationDisplays(retailer);
                      const title = retailerLocations
                        .map((location) => `${location.name}: ${location.address || location.label}`)
                        .join('\n');

                      if (retailerLocations.length === 0) {
                        return <span>—</span>;
                      }

                      return (
                        <div className="max-w-[260px]" title={title}>
                          <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                            <MapPin className="h-3 w-3" />
                            {retailerLocations.length} {retailerLocations.length === 1 ? 'location' : 'locations'}
                          </div>
                          <div className="space-y-1">
                            {retailerLocations.slice(0, 3).map((location) => (
                              <p key={location.key} className="truncate">
                                <span className="font-medium text-gray-700">{location.name}</span>
                                <span className="text-gray-400"> · </span>
                                <span>{location.label}</span>
                              </p>
                            ))}
                            {retailerLocations.length > 3 && (
                              <p className="text-xs font-medium text-gray-500">+{retailerLocations.length - 3} more</p>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Link href={getRetailerDetailHref(retailer.id)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                        <Eye className="w-4 h-4" />
                      </Link>
                      <button onClick={() => handleEditRetailer(retailer)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                      {retailer.status === 'pending' && (
                        <button
                          onClick={() => handleResendInvite(retailer)}
                          disabled={resendInviteId === retailer.id}
                          className="p-2 text-emerald-700 hover:bg-emerald-50 rounded-lg disabled:opacity-50"
                          title="Resend setup link"
                        >
                          {resendInviteId === retailer.id ? <div className="w-4 h-4 border-2 border-emerald-700/30 border-t-emerald-700 rounded-full animate-spin" /> : <Mail className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showEditModal && pendingEditRetailer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Edit Retailer</h3>
              <button onClick={() => { setShowEditModal(false); setPendingEditRetailer(null); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              {isLoadingEditRetailer && (
                <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-bark-500" />
                  Loading retailer details...
                </div>
              )}
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label><input type="text" value={editForm.company_name} onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Business Address</label><textarea value={editForm.business_address} onChange={(e) => setEditForm({ ...editForm, business_address: e.target.value })} rows={3} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500" /></div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500" />
                <p className="mt-1 text-xs text-gray-500">This updates the retailer's login email and the email on file.</p>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label><input type="text" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500" /></div>
              <div className="flex gap-3 pt-4"><button onClick={() => { setShowEditModal(false); setPendingEditRetailer(null); }} className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button><button onClick={handleUpdateRetailer} disabled={isUpdating || isLoadingEditRetailer} className="flex-1 px-4 py-2 bg-bark-500 text-white rounded-lg hover:bg-bark-600 disabled:opacity-50 flex items-center justify-center">{isUpdating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Save Changes'}</button></div>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Create Retailer</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label><input type="text" value={createForm.company_name} onChange={(e) => setCreateForm({ ...createForm, company_name: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label><input type="text" value={createForm.contact_name} onChange={(e) => setCreateForm({ ...createForm, contact_name: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500" /></div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500" />
                <p className="text-xs text-gray-500 mt-1">An invite email will be sent to set a password.</p>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label><input type="text" value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Business Address</label><textarea value={createForm.business_address} onChange={(e) => setCreateForm({ ...createForm, business_address: e.target.value })} rows={3} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Tax ID (optional)</label><input type="text" value={createForm.tax_id} onChange={(e) => setCreateForm({ ...createForm, tax_id: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500" /></div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setShowCreateModal(false)} className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={handleCreateRetailer} disabled={isCreating} className="flex-1 px-4 py-2 bg-bark-500 text-white rounded-lg hover:bg-bark-600 disabled:opacity-50 flex items-center justify-center">{isCreating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Create Retailer'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
