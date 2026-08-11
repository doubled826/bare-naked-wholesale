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
  type DiscountApplicationMethod,
  type DiscountBenefitCategory,
  type DiscountEligibility,
  type DiscountPayload,
  type DiscountQualificationType,
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

type LinkedAnnouncement = {
  id: string;
  title: string;
  bar_message?: string | null;
  message?: string | null;
  is_active: boolean;
  popup_enabled?: boolean | null;
  popup_headline?: string | null;
  popup_body?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  linked_discount_code_id?: string | null;
};

type MessagingForm = {
  enabled: boolean;
  title: string;
  bar_message: string;
  popup_enabled: boolean;
  popup_headline: string;
  popup_body: string;
  cta_label: string;
  cta_url: string;
};

const emptyDiscount: DiscountPayload = {
  code: '',
  name: '',
  description: '',
  application_method: 'promo_code',
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
  benefit_category: 'order_discount',
  priority: 0,
  priority_override: false,
  stackable_with_other_discounts: false,
  qualification_type: 'none',
  qualification_starts_at: null,
  qualification_ends_at: null,
  redemption_starts_at: null,
  redemption_ends_at: null,
};

const emptyMessagingForm: MessagingForm = {
  enabled: false,
  title: '',
  bar_message: '',
  popup_enabled: false,
  popup_headline: '',
  popup_body: '',
  cta_label: '',
  cta_url: '',
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

const benefitCategoryOptions: Array<{ value: DiscountBenefitCategory; label: string }> = [
  { value: 'order_discount', label: 'General order discount' },
  { value: 'first_order_discount', label: 'First-order discount' },
];

const qualificationOptions: Array<{ value: DiscountQualificationType; label: string }> = [
  { value: 'none', label: 'No persistent qualification' },
  { value: 'retailer_signup_window', label: 'Retailer signed up during window' },
];

const statusOptions: Array<{ value: DiscountStatus; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const applicationMethodOptions: Array<{ value: DiscountApplicationMethod; label: string; description: string }> = [
  { value: 'automatic', label: 'Automatic', description: 'Applied automatically when an eligible retailer checks out.' },
  { value: 'promo_code', label: 'Promo Code', description: 'Retailer must enter this code at checkout.' },
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
  const [messagingForm, setMessagingForm] = useState<MessagingForm>(emptyMessagingForm);
  const [linkedAnnouncementId, setLinkedAnnouncementId] = useState<string | null>(null);
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
  const isAutomaticToPromoWithInternalCode = Boolean(
    selectedDiscount &&
    (selectedDiscount.application_method || 'promo_code') === 'automatic' &&
    form.application_method === 'promo_code' &&
    normalizeDiscountCode(form.code).startsWith('AUTO_'),
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
      application_method: selectedDiscount.application_method || 'promo_code',
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
      benefit_category: selectedDiscount.benefit_category || 'order_discount',
      priority: Number(selectedDiscount.priority || 0),
      priority_override: Boolean(selectedDiscount.priority_override),
      stackable_with_other_discounts: Boolean(selectedDiscount.stackable_with_other_discounts),
      qualification_type: selectedDiscount.qualification_type || 'none',
      qualification_starts_at: selectedDiscount.qualification_starts_at || null,
      qualification_ends_at: selectedDiscount.qualification_ends_at || null,
      redemption_starts_at: selectedDiscount.redemption_starts_at || selectedDiscount.starts_at || null,
      redemption_ends_at: selectedDiscount.redemption_ends_at || selectedDiscount.ends_at || null,
    });
    setRetailerSearch('');
    loadLinkedAnnouncement(selectedDiscount.id);
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

  const loadLinkedAnnouncement = async (discountId: string) => {
    try {
      const response = await fetch('/api/admin/announcements', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Unable to load linked announcement.');
      const linked = ((data.announcements || []) as LinkedAnnouncement[])
        .find((announcement) => announcement.linked_discount_code_id === discountId);

      if (!linked) {
        setLinkedAnnouncementId(null);
        setMessagingForm({
          ...emptyMessagingForm,
          title: selectedDiscount?.name || '',
          bar_message: selectedDiscount?.description || '',
        });
        return;
      }

      setLinkedAnnouncementId(linked.id);
      setMessagingForm({
        enabled: true,
        title: linked.title || '',
        bar_message: linked.bar_message || linked.message || '',
        popup_enabled: Boolean(linked.popup_enabled),
        popup_headline: linked.popup_headline || '',
        popup_body: linked.popup_body || '',
        cta_label: linked.cta_label || '',
        cta_url: linked.cta_url || '',
      });
    } catch (error) {
      console.error('Linked announcement load error:', error);
    }
  };

  const startNewDiscount = () => {
    setSelectedId('new');
    setForm(emptyDiscount);
    setMessagingForm(emptyMessagingForm);
    setLinkedAnnouncementId(null);
    setRetailerSearch('');
  };

  const updateForm = <K extends keyof DiscountPayload>(key: K, value: DiscountPayload[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateMessagingForm = <K extends keyof MessagingForm>(key: K, value: MessagingForm[K]) => {
    setMessagingForm((current) => ({ ...current, [key]: value }));
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
    if (isAutomaticToPromoWithInternalCode) {
      showNotice('error', 'Enter a customer-facing promo code before saving this as Promo Code.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        code: normalizeDiscountCode(form.code),
        starts_at: form.starts_at || form.redemption_starts_at,
        ends_at: form.ends_at || form.redemption_ends_at,
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
      if (messagingForm.enabled) {
        const announcementPayload = {
          title: messagingForm.title || data.discount.name,
          bar_message: messagingForm.bar_message || data.discount.description || data.discount.name,
          is_active: data.discount.status === 'active',
          popup_enabled: messagingForm.popup_enabled,
          popup_headline: messagingForm.popup_headline,
          popup_body: messagingForm.popup_body,
          cta_label: messagingForm.cta_label,
          cta_url: messagingForm.cta_url,
          targeting_type: 'linked_discount',
          linked_discount_code_id: data.discount.id,
          inherit_discount_eligibility: true,
          starts_at: data.discount.redemption_starts_at || data.discount.starts_at,
          ends_at: data.discount.redemption_ends_at || data.discount.ends_at,
        };
        const announcementResponse = await fetch(
          linkedAnnouncementId ? `/api/admin/announcements?id=${linkedAnnouncementId}` : '/api/admin/announcements',
          {
            method: linkedAnnouncementId ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(announcementPayload),
          },
        );
        const announcementData = await announcementResponse.json();
        if (!announcementResponse.ok) throw new Error(announcementData?.error || 'Discount saved, but messaging could not be saved.');
        setLinkedAnnouncementId(announcementData.announcement?.id || linkedAnnouncementId);
      }
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
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                            {(discount.application_method || 'promo_code') === 'automatic' ? 'Auto' : 'Code'}
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
                  {getDiscountLabel(form)} off · {form.eligibility.replace('_', ' ')} · {(form.application_method || 'promo_code') === 'automatic' ? 'automatic' : 'promo code'}
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
            <div>
              <span className="text-xs font-semibold uppercase text-gray-500">Application Method</span>
              <div className="mt-2 grid gap-3 lg:grid-cols-2">
                {applicationMethodOptions.map((option) => {
                  const isActive = (form.application_method || 'promo_code') === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateForm('application_method', option.value)}
                      className={cn(
                        'rounded-lg border p-4 text-left transition-colors',
                        isActive
                          ? 'border-bark-500 bg-cream-100 text-bark-500'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-cream-300 hover:bg-cream-50',
                      )}
                    >
                      <span className="block font-semibold">{option.label}</span>
                      <span className="mt-1 block text-xs leading-5 opacity-80">{option.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold uppercase text-gray-500">
                  {form.application_method === 'automatic' ? 'Internal Code' : 'Promo Code'}
                </span>
                <input
                  type="text"
                  value={form.code}
                  onChange={(event) => updateForm('code', normalizeDiscountCode(event.target.value))}
                  placeholder={form.application_method === 'automatic' ? 'Generated if left blank' : 'SUMMER10'}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm font-semibold uppercase focus:border-bark-500 focus:outline-none focus:ring-2 focus:ring-bark-500/20"
                />
                <span className="mt-1 block text-xs text-gray-500">
                  {form.application_method === 'automatic'
                    ? 'Retailers do not need this code; it is only for admin identification.'
                    : 'Retailers must enter this code at checkout.'}
                </span>
                {isAutomaticToPromoWithInternalCode && (
                  <span className="mt-2 block rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                    This looks like an internal automatic-offer code. Enter the public code retailers should type before saving.
                  </span>
                )}
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

            <div className="rounded-lg border border-gray-200 p-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold uppercase text-gray-500">Benefit Category</span>
                  <select
                    value={form.benefit_category || 'order_discount'}
                    onChange={(event) => updateForm('benefit_category', event.target.value as DiscountBenefitCategory)}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-bark-500 focus:outline-none focus:ring-2 focus:ring-bark-500/20"
                  >
                    {benefitCategoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase text-gray-500">Qualification</span>
                  <select
                    value={form.qualification_type || 'none'}
                    onChange={(event) => updateForm('qualification_type', event.target.value as DiscountQualificationType)}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-bark-500 focus:outline-none focus:ring-2 focus:ring-bark-500/20"
                  >
                    {qualificationOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              {form.qualification_type === 'retailer_signup_window' && (
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-semibold uppercase text-gray-500">Signup Window Starts</span>
                    <input
                      type="datetime-local"
                      value={toDatetimeInput(form.qualification_starts_at)}
                      onChange={(event) => updateForm('qualification_starts_at', fromDatetimeInput(event.target.value))}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-bark-500 focus:outline-none focus:ring-2 focus:ring-bark-500/20"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold uppercase text-gray-500">Signup Window Ends</span>
                    <input
                      type="datetime-local"
                      value={toDatetimeInput(form.qualification_ends_at)}
                      onChange={(event) => updateForm('qualification_ends_at', fromDatetimeInput(event.target.value))}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-bark-500 focus:outline-none focus:ring-2 focus:ring-bark-500/20"
                    />
                  </label>
                </div>
              )}

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold uppercase text-gray-500">Redemption Starts</span>
                  <input
                    type="datetime-local"
                    value={toDatetimeInput(form.redemption_starts_at)}
                    onChange={(event) => updateForm('redemption_starts_at', fromDatetimeInput(event.target.value))}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-bark-500 focus:outline-none focus:ring-2 focus:ring-bark-500/20"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase text-gray-500">Redemption Ends</span>
                  <input
                    type="datetime-local"
                    value={toDatetimeInput(form.redemption_ends_at)}
                    onChange={(event) => updateForm('redemption_ends_at', fromDatetimeInput(event.target.value))}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-bark-500 focus:outline-none focus:ring-2 focus:ring-bark-500/20"
                  />
                </label>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[160px_1fr_1fr]">
                <label className="block">
                  <span className="text-xs font-semibold uppercase text-gray-500">Priority</span>
                  <input
                    type="number"
                    value={form.priority || 0}
                    onChange={(event) => updateForm('priority', Number(event.target.value))}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-bark-500 focus:outline-none focus:ring-2 focus:ring-bark-500/20"
                  />
                </label>
                <label className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={Boolean(form.priority_override)}
                    onChange={(event) => updateForm('priority_override', event.target.checked)}
                    className="rounded border-gray-300 text-bark-500 focus:ring-bark-500"
                  />
                  Priority can override better value
                </label>
                <label className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={Boolean(form.stackable_with_other_discounts)}
                    onChange={(event) => updateForm('stackable_with_other_discounts', event.target.checked)}
                    className="rounded border-gray-300 text-bark-500 focus:ring-bark-500"
                  />
                  Can stack with other discounts
                </label>
              </div>
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

            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-bark-500">
                <input
                  type="checkbox"
                  checked={messagingForm.enabled}
                  onChange={(event) => updateMessagingForm('enabled', event.target.checked)}
                  className="rounded border-cream-300 text-bark-500 focus:ring-bark-500"
                />
                Create retailer-facing promotion messaging
              </label>

              {messagingForm.enabled && (
                <div className="mt-4 space-y-4">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <label className="block">
                      <span className="text-xs font-semibold uppercase text-gray-500">Announcement Title</span>
                      <input
                        type="text"
                        value={messagingForm.title}
                        onChange={(event) => updateMessagingForm('title', event.target.value)}
                        placeholder={form.name || 'SuperZoo first-order offer'}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-bark-500 focus:outline-none focus:ring-2 focus:ring-bark-500/20"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold uppercase text-gray-500">CTA URL</span>
                      <input
                        type="url"
                        value={messagingForm.cta_url}
                        onChange={(event) => updateMessagingForm('cta_url', event.target.value)}
                        placeholder="/catalog"
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-bark-500 focus:outline-none focus:ring-2 focus:ring-bark-500/20"
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="text-xs font-semibold uppercase text-gray-500">Announcement Bar Message</span>
                    <textarea
                      value={messagingForm.bar_message}
                      onChange={(event) => updateMessagingForm('bar_message', event.target.value)}
                      rows={2}
                      placeholder="SuperZoo retailers receive 15% off their first wholesale order this week."
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-bark-500 focus:outline-none focus:ring-2 focus:ring-bark-500/20"
                    />
                  </label>
                  <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-bark-500">
                      <input
                        type="checkbox"
                        checked={messagingForm.popup_enabled}
                        onChange={(event) => updateMessagingForm('popup_enabled', event.target.checked)}
                        className="rounded border-cream-300 text-bark-500 focus:ring-bark-500"
                      />
                      Show popup once per version
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold uppercase text-gray-500">CTA Label</span>
                      <input
                        type="text"
                        value={messagingForm.cta_label}
                        onChange={(event) => updateMessagingForm('cta_label', event.target.value)}
                        placeholder="Build My First Order"
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-bark-500 focus:outline-none focus:ring-2 focus:ring-bark-500/20"
                      />
                    </label>
                  </div>
                  {messagingForm.popup_enabled && (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <label className="block">
                        <span className="text-xs font-semibold uppercase text-gray-500">Popup Headline</span>
                        <input
                          type="text"
                          value={messagingForm.popup_headline}
                          onChange={(event) => updateMessagingForm('popup_headline', event.target.value)}
                          placeholder="Your SuperZoo launch offer is ready."
                          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-bark-500 focus:outline-none focus:ring-2 focus:ring-bark-500/20"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold uppercase text-gray-500">Popup Body</span>
                        <textarea
                          value={messagingForm.popup_body}
                          onChange={(event) => updateMessagingForm('popup_body', event.target.value)}
                          rows={3}
                          placeholder="For a limited time, your first wholesale order receives the stronger SuperZoo discount while your other Welcome Offer benefits stay intact."
                          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-bark-500 focus:outline-none focus:ring-2 focus:ring-bark-500/20"
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>

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
