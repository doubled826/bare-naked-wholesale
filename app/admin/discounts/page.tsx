'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  BadgePercent,
  CalendarDays,
  CheckCircle,
  DollarSign,
  Loader2,
  Plus,
  Save,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import {
  type DiscountCode,
  type DiscountEligibility,
  type DiscountPayload,
  type DiscountStatus,
  type DiscountType,
  normalizeDiscountCode,
} from '@/lib/discountCodes';

type RetailerOption = {
  id: string;
  company_name: string;
  account_number?: string | null;
};

type DiscountResponse = {
  discounts?: DiscountCode[];
  discount?: DiscountCode;
  setupRequired?: boolean;
  setupMessage?: string;
  error?: string;
};

const emptyDiscount: DiscountPayload = {
  code: '',
  name: '',
  description: '',
  discount_type: 'percent',
  discount_value: 10,
  status: 'active',
  eligibility: 'all_retailers',
  manual_retailer_ids: [],
  min_order_subtotal: 0,
  max_redemptions: null,
  max_redemptions_per_retailer: 1,
  starts_at: null,
  ends_at: null,
};

const discountTypeOptions: Array<{ value: DiscountType; label: string; icon: typeof BadgePercent }> = [
  { value: 'percent', label: 'Percent', icon: BadgePercent },
  { value: 'fixed_amount', label: 'Fixed Amount', icon: DollarSign },
];

const eligibilityOptions: Array<{ value: DiscountEligibility; label: string }> = [
  { value: 'all_retailers', label: 'All retailers' },
  { value: 'first_order', label: 'First order' },
  { value: 'repeat_buyers', label: 'Repeat buyers' },
  { value: 'manual', label: 'Selected retailers' },
];

const statusOptions: Array<{ value: DiscountStatus; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const formatDate = (value?: string | null) => {
  if (!value) return 'No date';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
};

const toDatetimeInput = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const fromDatetimeInput = (value: string) => (value ? new Date(value).toISOString() : null);

const getDiscountLabel = (discount: Pick<DiscountPayload, 'discount_type' | 'discount_value'>) => {
  const value = Number(discount.discount_value || 0);
  return discount.discount_type === 'percent' ? `${value}%` : formatCurrency(value);
};

const getUsageLabel = (discount: DiscountCode) => {
  const used = Number(discount.usage_count || 0);
  if (discount.max_redemptions) return `${used} / ${discount.max_redemptions}`;
  return `${used}`;
};

export default function AdminDiscountsPage() {
  const supabase = createClientComponentClient();
  const [discounts, setDiscounts] = useState<DiscountCode[]>([]);
  const [retailers, setRetailers] = useState<RetailerOption[]>([]);
  const [selectedId, setSelectedId] = useState('new');
  const [form, setForm] = useState<DiscountPayload>(emptyDiscount);
  const [searchQuery, setSearchQuery] = useState('');
  const [retailerSearch, setRetailerSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [setupMessage, setSetupMessage] = useState('');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const selectedDiscount = useMemo(
    () => discounts.find((discount) => discount.id === selectedId) || null,
    [discounts, selectedId],
  );

  const filteredDiscounts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return discounts;
    return discounts.filter((discount) =>
      discount.code.toLowerCase().includes(query) ||
      discount.name.toLowerCase().includes(query) ||
      (discount.description || '').toLowerCase().includes(query),
    );
  }, [discounts, searchQuery]);

  const selectedRetailerIds = useMemo(() => new Set(form.manual_retailer_ids || []), [form.manual_retailer_ids]);
  const selectedRetailers = useMemo(
    () => retailers.filter((retailer) => selectedRetailerIds.has(retailer.id)),
    [retailers, selectedRetailerIds],
  );
  const visibleRetailers = useMemo(() => {
    const query = retailerSearch.trim().toLowerCase();
    return retailers
      .filter((retailer) => !selectedRetailerIds.has(retailer.id))
      .filter((retailer) =>
        !query ||
        retailer.company_name.toLowerCase().includes(query) ||
        (retailer.account_number || '').toLowerCase().includes(query),
      )
      .slice(0, 8);
  }, [retailerSearch, retailers, selectedRetailerIds]);

  const stats = useMemo(() => {
    const active = discounts.filter((discount) => discount.status === 'active').length;
    const redemptions = discounts.reduce((sum, discount) => sum + Number(discount.usage_count || 0), 0);
    const limited = discounts.filter((discount) => Boolean(discount.max_redemptions || discount.max_redemptions_per_retailer)).length;
    return { active, redemptions, limited };
  }, [discounts]);

  useEffect(() => {
    loadDiscounts();
    loadRetailers();
  }, []);

  useEffect(() => {
    if (!selectedDiscount) return;
    setForm({
      code: selectedDiscount.code,
      name: selectedDiscount.name,
      description: selectedDiscount.description || '',
      discount_type: selectedDiscount.discount_type,
      discount_value: Number(selectedDiscount.discount_value || 0),
      status: selectedDiscount.status,
      eligibility: selectedDiscount.eligibility,
      manual_retailer_ids: selectedDiscount.manual_retailer_ids || [],
      min_order_subtotal: Number(selectedDiscount.min_order_subtotal || 0),
      max_redemptions: selectedDiscount.max_redemptions ?? null,
      max_redemptions_per_retailer: selectedDiscount.max_redemptions_per_retailer ?? null,
      starts_at: selectedDiscount.starts_at || null,
      ends_at: selectedDiscount.ends_at || null,
    });
    setRetailerSearch('');
  }, [selectedDiscount]);

  const showNotice = (type: 'success' | 'error', message: string) => {
    setNotice({ type, message });
    window.setTimeout(() => setNotice(null), 3500);
  };

  const loadDiscounts = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/discount-codes', { cache: 'no-store' });
      const data = (await response.json()) as DiscountResponse;
      if (!response.ok) throw new Error(data.error || 'Unable to load discounts.');
      setDiscounts(data.discounts || []);
      setSetupMessage(data.setupRequired ? data.setupMessage || '' : '');
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : 'Unable to load discounts.');
    } finally {
      setLoading(false);
    }
  };

  const loadRetailers = async () => {
    const { data, error } = await supabase
      .from('retailers')
      .select('id, company_name, account_number')
      .order('company_name');

    if (error) {
      console.error('Retailer load error:', error);
      return;
    }

    setRetailers(data || []);
  };

  const startNewDiscount = () => {
    setSelectedId('new');
    setForm(emptyDiscount);
    setRetailerSearch('');
  };

  const updateForm = <K extends keyof DiscountPayload>(key: K, value: DiscountPayload[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const toggleRetailer = (retailerId: string) => {
    setForm((current) => {
      const currentIds = current.manual_retailer_ids || [];
      const nextIds = currentIds.includes(retailerId)
        ? currentIds.filter((id) => id !== retailerId)
        : [...currentIds, retailerId];
      return { ...current, manual_retailer_ids: nextIds };
    });
  };

  const saveDiscount = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        code: normalizeDiscountCode(form.code),
        manual_retailer_ids: form.eligibility === 'manual' ? form.manual_retailer_ids : [],
      };
      const endpoint = selectedDiscount ? `/api/admin/discount-codes/${selectedDiscount.id}` : '/api/admin/discount-codes';
      const response = await fetch(endpoint, {
        method: selectedDiscount ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as DiscountResponse;
      if (!response.ok || !data.discount) throw new Error(data.error || 'Unable to save discount.');

      setDiscounts((current) => {
        if (selectedDiscount) return current.map((discount) => (discount.id === data.discount?.id ? data.discount : discount));
        return [data.discount as DiscountCode, ...current];
      });
      setSelectedId(data.discount.id);
      showNotice('success', 'Discount saved.');
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : 'Unable to save discount.');
    } finally {
      setSaving(false);
    }
  };

  const deleteDiscount = async () => {
    if (!selectedDiscount) return;
    const confirmed = window.confirm(`Delete ${selectedDiscount.code}? Existing orders keep their promotion code history.`);
    if (!confirmed) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/discount-codes/${selectedDiscount.id}`, { method: 'DELETE' });
      const data = (await response.json()) as DiscountResponse;
      if (!response.ok) throw new Error(data.error || 'Unable to delete discount.');

      setDiscounts((current) => current.filter((discount) => discount.id !== selectedDiscount.id));
      startNewDiscount();
      showNotice('success', 'Discount deleted.');
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : 'Unable to delete discount.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {notice && (
        <div
          className={cn(
            'fixed right-4 top-20 z-50 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-lg',
            notice.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800',
          )}
        >
          {notice.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <X className="h-4 w-4" />}
          {notice.message}
        </div>
      )}

      <div className="rounded-xl border border-cream-200 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-bark-500" style={{ fontFamily: 'var(--font-poppins)' }}>
              Discounts
            </h1>
            <p className="mt-1 text-sm text-bark-500/60">
              Create and manage wholesale order discount codes.
            </p>
          </div>
          <button
            type="button"
            onClick={startNewDiscount}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-bark-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-bark-600"
          >
            <Plus className="h-4 w-4" />
            New Discount
          </button>
        </div>
      </div>

      {setupMessage && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {setupMessage}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-green-100 text-green-700">
              <BadgePercent className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active Codes</p>
              <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <CheckCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Redemptions</p>
              <p className="text-2xl font-bold text-gray-900">{stats.redemptions}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-cream-100 text-bark-500">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Limited Codes</p>
              <p className="text-2xl font-bold text-gray-900">{stats.limited}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(320px,420px)_1fr]">
        <section className="rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search discounts..."
                className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-bark-500 focus:outline-none focus:ring-2 focus:ring-bark-500/20"
              />
            </div>
          </div>

          <div className="max-h-[680px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 p-8 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading discounts
              </div>
            ) : filteredDiscounts.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">No discounts found.</div>
            ) : (
              filteredDiscounts.map((discount) => {
                const isSelected = discount.id === selectedId;
                return (
                  <button
                    key={discount.id}
                    type="button"
                    onClick={() => setSelectedId(discount.id)}
                    className={cn(
                      'block w-full border-b border-gray-100 p-4 text-left transition-colors hover:bg-gray-50',
                      isSelected && 'bg-cream-50',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-bark-500 px-2 py-1 font-mono text-sm font-bold text-white">
                            {discount.code}
                          </span>
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-xs font-semibold',
                              discount.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600',
                            )}
                          >
                            {discount.status}
                          </span>
                        </div>
                        <p className="mt-2 truncate font-semibold text-gray-900">{discount.name}</p>
                        <p className="mt-1 text-sm text-gray-500">
                          {getDiscountLabel(discount)} off · Used {getUsageLabel(discount)}
                        </p>
                      </div>
                      <BadgePercent className="h-5 w-5 shrink-0 text-bark-500/50" />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {selectedDiscount ? selectedDiscount.code : 'New Discount'}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {getDiscountLabel(form)} off · {form.eligibility.replace('_', ' ')}
                </p>
              </div>
              <div className="flex gap-2">
                {selectedDiscount && (
                  <button
                    type="button"
                    onClick={deleteDiscount}
                    disabled={deleting || saving}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Delete
                  </button>
                )}
                <button
                  type="button"
                  onClick={saveDiscount}
                  disabled={saving || deleting}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-bark-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-bark-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6 p-5">
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold uppercase text-gray-500">Code</span>
                <input
                  type="text"
                  value={form.code}
                  onChange={(event) => updateForm('code', normalizeDiscountCode(event.target.value))}
                  placeholder="SUMMER10"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm font-semibold uppercase focus:border-bark-500 focus:outline-none focus:ring-2 focus:ring-bark-500/20"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase text-gray-500">Name</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) => updateForm('name', event.target.value)}
                  placeholder="Summer wholesale promo"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-bark-500 focus:outline-none focus:ring-2 focus:ring-bark-500/20"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-xs font-semibold uppercase text-gray-500">Description</span>
              <textarea
                value={form.description || ''}
                onChange={(event) => updateForm('description', event.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-bark-500 focus:outline-none focus:ring-2 focus:ring-bark-500/20"
              />
            </label>

            <div className="grid gap-4 lg:grid-cols-[1fr_180px]">
              <div>
                <span className="text-xs font-semibold uppercase text-gray-500">Discount Type</span>
                <div className="mt-1 grid grid-cols-2 rounded-lg border border-gray-200 bg-gray-50 p-1">
                  {discountTypeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateForm('discount_type', option.value)}
                      className={cn(
                        'flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors',
                        form.discount_type === option.value ? 'bg-white text-bark-500 shadow-sm' : 'text-gray-600 hover:text-gray-900',
                      )}
                    >
                      <option.icon className="h-4 w-4" />
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block">
                <span className="text-xs font-semibold uppercase text-gray-500">Value</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.discount_value}
                  onChange={(event) => updateForm('discount_value', Number(event.target.value))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-bark-500 focus:outline-none focus:ring-2 focus:ring-bark-500/20"
                />
              </label>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <label className="block">
                <span className="text-xs font-semibold uppercase text-gray-500">Status</span>
                <select
                  value={form.status}
                  onChange={(event) => updateForm('status', event.target.value as DiscountStatus)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-bark-500 focus:outline-none focus:ring-2 focus:ring-bark-500/20"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase text-gray-500">Eligibility</span>
                <select
                  value={form.eligibility}
                  onChange={(event) => updateForm('eligibility', event.target.value as DiscountEligibility)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-bark-500 focus:outline-none focus:ring-2 focus:ring-bark-500/20"
                >
                  {eligibilityOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase text-gray-500">Minimum Subtotal</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.min_order_subtotal}
                  onChange={(event) => updateForm('min_order_subtotal', Number(event.target.value))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-bark-500 focus:outline-none focus:ring-2 focus:ring-bark-500/20"
                />
              </label>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold uppercase text-gray-500">Total Limit</span>
                <input
                  type="number"
                  min="1"
                  value={form.max_redemptions ?? ''}
                  onChange={(event) => updateForm('max_redemptions', event.target.value ? Number(event.target.value) : null)}
                  placeholder="Unlimited"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-bark-500 focus:outline-none focus:ring-2 focus:ring-bark-500/20"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase text-gray-500">Per Retailer Limit</span>
                <input
                  type="number"
                  min="1"
                  value={form.max_redemptions_per_retailer ?? ''}
                  onChange={(event) => updateForm('max_redemptions_per_retailer', event.target.value ? Number(event.target.value) : null)}
                  placeholder="Unlimited"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-bark-500 focus:outline-none focus:ring-2 focus:ring-bark-500/20"
                />
              </label>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <label className="block">
                <span className="flex items-center gap-1 text-xs font-semibold uppercase text-gray-500">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Starts
                </span>
                <input
                  type="datetime-local"
                  value={toDatetimeInput(form.starts_at)}
                  onChange={(event) => updateForm('starts_at', fromDatetimeInput(event.target.value))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-bark-500 focus:outline-none focus:ring-2 focus:ring-bark-500/20"
                />
              </label>
              <label className="block">
                <span className="flex items-center gap-1 text-xs font-semibold uppercase text-gray-500">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Ends
                </span>
                <input
                  type="datetime-local"
                  value={toDatetimeInput(form.ends_at)}
                  onChange={(event) => updateForm('ends_at', fromDatetimeInput(event.target.value))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-bark-500 focus:outline-none focus:ring-2 focus:ring-bark-500/20"
                />
              </label>
            </div>

            {form.eligibility === 'manual' && (
              <div className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">Selected Retailers</h3>
                    <p className="text-sm text-gray-500">{selectedRetailers.length} selected</p>
                  </div>
                  <Users className="h-5 w-5 text-bark-500/60" />
                </div>

                {selectedRetailers.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedRetailers.map((retailer) => (
                      <button
                        key={retailer.id}
                        type="button"
                        onClick={() => toggleRetailer(retailer.id)}
                        className="inline-flex items-center gap-1 rounded-full bg-cream-100 px-3 py-1 text-sm font-medium text-bark-500 hover:bg-cream-200"
                      >
                        {retailer.company_name}
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ))}
                  </div>
                )}

                <div className="relative mt-4">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="search"
                    value={retailerSearch}
                    onChange={(event) => setRetailerSearch(event.target.value)}
                    placeholder="Search retailers..."
                    className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-bark-500 focus:outline-none focus:ring-2 focus:ring-bark-500/20"
                  />
                </div>

                <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-gray-100">
                  {visibleRetailers.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-gray-500">No matching retailers.</div>
                  ) : (
                    visibleRetailers.map((retailer) => (
                      <button
                        key={retailer.id}
                        type="button"
                        onClick={() => toggleRetailer(retailer.id)}
                        className="flex w-full items-center justify-between gap-3 border-b border-gray-100 px-3 py-2 text-left text-sm hover:bg-gray-50 last:border-b-0"
                      >
                        <span className="font-medium text-gray-900">{retailer.company_name}</span>
                        <span className="text-xs text-gray-500">{retailer.account_number || 'New account'}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {selectedDiscount && (
              <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
                Used {getUsageLabel(selectedDiscount)} times · Active window {formatDate(selectedDiscount.starts_at)} to {formatDate(selectedDiscount.ends_at)}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
