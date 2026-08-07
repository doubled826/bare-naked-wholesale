'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Clock,
  ExternalLink,
  Globe2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  Store,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

type LeadStatus =
  | 'new'
  | 'approved'
  | 'sample_pack_pending'
  | 'tracking_added'
  | 'delivered'
  | 'follow_up_due'
  | 'converted'
  | 'closed';

type WholesaleLead = {
  id: string;
  contact_name: string;
  email: string;
  store_name: string;
  phone: string | null;
  store_url: string | null;
  store_type: string | null;
  location_count: number | null;
  currently_buying_wholesale: string | null;
  shipping_address_1: string;
  shipping_address_2: string | null;
  shipping_city: string;
  shipping_state: string;
  shipping_postal_code: string;
  status: LeadStatus;
  source: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  gclid: string | null;
  fbclid: string | null;
  landing_page_url: string | null;
  referrer: string | null;
  approved_at: string | null;
  tracking_carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  tracking_added_at: string | null;
  delivered_at: string | null;
  converted_retailer_id: string | null;
  converted_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  raw_payload: Record<string, unknown> | null;
};

type LeadTab = 'all' | 'samples' | 'canada';

const provinceMeta = [
  { key: 'BC', label: 'British Columbia', x: 14, y: 57 },
  { key: 'AB', label: 'Alberta', x: 25, y: 56 },
  { key: 'SK', label: 'Saskatchewan', x: 35, y: 57 },
  { key: 'MB', label: 'Manitoba', x: 45, y: 58 },
  { key: 'ON', label: 'Ontario', x: 58, y: 68 },
  { key: 'QC', label: 'Quebec', x: 72, y: 62 },
  { key: 'NB', label: 'New Brunswick', x: 80, y: 72 },
  { key: 'NS', label: 'Nova Scotia', x: 86, y: 76 },
  { key: 'PE', label: 'Prince Edward Island', x: 85, y: 70 },
  { key: 'NL', label: 'Newfoundland and Labrador', x: 91, y: 55 },
  { key: 'YT', label: 'Yukon', x: 16, y: 28 },
  { key: 'NT', label: 'Northwest Territories', x: 34, y: 31 },
  { key: 'NU', label: 'Nunavut', x: 55, y: 27 },
] as const;

const provinceAliases = provinceMeta.reduce<Record<string, string>>((aliases, province) => {
  aliases[province.key.toLowerCase()] = province.key;
  aliases[province.label.toLowerCase()] = province.key;
  return aliases;
}, {
  nwt: 'NT',
  'northwest territory': 'NT',
  'newfoundland': 'NL',
  labrador: 'NL',
  pei: 'PE',
  'p.e.i.': 'PE',
});

const statusOptions: Array<{ value: LeadStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All leads' },
  { value: 'new', label: 'New' },
  { value: 'approved', label: 'Approved' },
  { value: 'sample_pack_pending', label: 'Sample pending' },
  { value: 'tracking_added', label: 'Tracking added' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'follow_up_due', label: 'Follow-up due' },
  { value: 'converted', label: 'Converted' },
  { value: 'closed', label: 'Closed' },
];

const statusLabels: Record<LeadStatus, string> = {
  new: 'New',
  approved: 'Approved',
  sample_pack_pending: 'Sample pending',
  tracking_added: 'Tracking added',
  delivered: 'Delivered',
  follow_up_due: 'Follow-up due',
  converted: 'Converted',
  closed: 'Closed',
};

const statusStyles: Record<LeadStatus, string> = {
  new: 'bg-blue-100 text-blue-700',
  approved: 'bg-emerald-100 text-emerald-700',
  sample_pack_pending: 'bg-amber-100 text-amber-700',
  tracking_added: 'bg-indigo-100 text-indigo-700',
  delivered: 'bg-teal-100 text-teal-700',
  follow_up_due: 'bg-orange-100 text-orange-700',
  converted: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-700',
};

type StatCard = {
  label: string;
  value: number;
  icon: LucideIcon;
};

const formatDate = (value?: string | null) => {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
};

const rawString = (lead: WholesaleLead, keys: string[]) => {
  const payload = lead.raw_payload || {};

  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  }

  return '';
};

const rawNumber = (lead: WholesaleLead, keys: string[]) => {
  const value = rawString(lead, keys);
  if (!value) return null;

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const rawList = (lead: WholesaleLead, keys: string[]) => {
  const payload = lead.raw_payload || {};

  for (const key of keys) {
    const value = payload[key];
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean);
    }
    if (typeof value === 'string' && value.trim()) {
      return value
        .split(/[,;\n]/)
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
};

const isCanadaLead = (lead: WholesaleLead) => {
  const source = (lead.source || '').toLowerCase();
  const campaign = (lead.utm_campaign || '').toLowerCase();
  const country = rawString(lead, ['country']).toLowerCase();
  const province = rawString(lead, ['province', 'provinceTerritory', 'province_territory']);

  return source.includes('canada') || campaign.includes('canada') || country === 'canada' || Boolean(province);
};

const isSampleLead = (lead: WholesaleLead) => !isCanadaLead(lead) || (lead.source || '').toLowerCase().includes('sample');

const getLeadTypeLabel = (lead: WholesaleLead) => (isCanadaLead(lead) ? 'Canada early access' : 'Sample request');

const getAddress = (lead: WholesaleLead) =>
  [
    lead.shipping_address_1,
    lead.shipping_address_2,
    `${lead.shipping_city}, ${lead.shipping_state} ${lead.shipping_postal_code}`,
  ]
    .filter(Boolean)
    .join('\n');

const getLocation = (lead: WholesaleLead) =>
  [lead.shipping_city, lead.shipping_state, lead.shipping_postal_code]
    .filter((value) => value && value !== 'Not collected')
    .join(', ');

const getDistributorMentions = (lead: WholesaleLead) =>
  rawList(lead, ['distributors', 'currentDistributors', 'current_distributors', 'distributorsCurrentlyUsed']);

const getProductInterest = (lead: WholesaleLead) =>
  rawList(lead, ['productInterest', 'product_interest', 'interestedProducts', 'products_interest']);

const getFirstOrderRange = (lead: WholesaleLead) =>
  rawString(lead, ['estimatedFirstOrderRange', 'estimated_first_order_range', 'firstOrderRange', 'comfortableFirstOrder']);

const getLeadScore = (lead: WholesaleLead) => rawNumber(lead, ['leadScore', 'lead_score']);

const getProvince = (lead: WholesaleLead) =>
  rawString(lead, ['province', 'provinceTerritory', 'province_territory']) || lead.shipping_state;

const getProvinceKey = (value?: string | null) => {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) return '';
  return provinceAliases[normalized] || value?.trim().toUpperCase() || '';
};

const getLeadProvinceKey = (lead: WholesaleLead) => getProvinceKey(getProvince(lead));

const normalizeUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('@')) return `https://instagram.com/${trimmed.slice(1)}`;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

export default function WholesalePipelinePage() {
  const supabase = createClientComponentClient();
  const [leads, setLeads] = useState<WholesaleLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');
  const [activeTab, setActiveTab] = useState<LeadTab>('all');
  const [selectedProvinceKey, setSelectedProvinceKey] = useState('');
  const [selectedLead, setSelectedLead] = useState<WholesaleLead | null>(null);
  const [approvingLeadId, setApprovingLeadId] = useState<string | null>(null);
  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null);

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    setIsLoading(true);
    setNotice('');

    const { data, error } = await supabase
      .from('wholesale_leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Wholesale lead load error:', error);
      setNotice(error.message || 'Unable to load wholesale leads.');
      setLeads([]);
      setIsLoading(false);
      return;
    }

    setLeads((data || []) as WholesaleLead[]);
    setIsLoading(false);
  };

  const approveLead = async (lead: WholesaleLead) => {
    setApprovingLeadId(lead.id);
    setNotice('');

    try {
      const response = await fetch(`/api/admin/wholesale-leads/${lead.id}/approve`, {
        method: 'POST',
      });
      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Unable to approve sample request.');
      }

      const updatedLead = payload.lead as WholesaleLead;
      setLeads((current) => current.map((item) => (item.id === updatedLead.id ? updatedLead : item)));
      setSelectedLead(updatedLead);
      setNotice(`Approved ${updatedLead.store_name}. Fulfillment email sent to info@barenakedpet.com.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to approve sample request.');
    } finally {
      setApprovingLeadId(null);
    }
  };

  const deleteLead = async (lead: WholesaleLead) => {
    const confirmed = window.confirm(`Delete ${lead.store_name} from the Wholesale Pipeline? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingLeadId(lead.id);
    setNotice('');

    try {
      const response = await fetch(`/api/admin/wholesale-leads/${lead.id}`, {
        method: 'DELETE',
      });
      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Unable to delete wholesale lead.');
      }

      setLeads((current) => current.filter((item) => item.id !== lead.id));
      setSelectedLead(null);
      setNotice(`Deleted ${lead.store_name} from the Wholesale Pipeline.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to delete wholesale lead.');
    } finally {
      setDeletingLeadId(null);
    }
  };

  const filteredLeads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return leads.filter((lead) => {
      if (activeTab === 'samples' && !isSampleLead(lead)) return false;
      if (activeTab === 'canada' && !isCanadaLead(lead)) return false;
      if (activeTab === 'canada' && selectedProvinceKey && getLeadProvinceKey(lead) !== selectedProvinceKey) return false;
      if (statusFilter !== 'all' && lead.status !== statusFilter) return false;
      if (!normalizedQuery) return true;

      return [
        lead.store_name,
        lead.contact_name,
        lead.email,
        lead.phone,
        lead.shipping_city,
        lead.shipping_state,
        lead.store_url,
        lead.utm_campaign,
        lead.source,
        getLeadTypeLabel(lead),
        getDistributorMentions(lead).join(' '),
        getProductInterest(lead).join(' '),
        getFirstOrderRange(lead),
        getProvince(lead),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    });
  }, [activeTab, leads, query, selectedProvinceKey, statusFilter]);

  const stats = useMemo(() => {
    const sampleLeads = leads.filter(isSampleLead);
    const canadaLeads = leads.filter(isCanadaLead);
    const pendingSamples = sampleLeads.filter((lead) => ['new', 'approved', 'sample_pack_pending'].includes(lead.status)).length;
    return {
      total: leads.length,
      new: leads.filter((lead) => lead.status === 'new').length,
      samples: sampleLeads.length,
      canada: canadaLeads.length,
      trackingAdded: leads.filter((lead) => lead.status === 'tracking_added').length,
      converted: leads.filter((lead) => lead.status === 'converted').length,
      pendingSamples,
    };
  }, [leads]);

  const statCards: StatCard[] = [
    { label: 'Total leads', value: stats.total, icon: Store },
    { label: 'New', value: stats.new, icon: Clock },
    { label: 'Canada early access', value: stats.canada, icon: Globe2 },
    { label: 'Needs sample action', value: stats.pendingSamples, icon: Truck },
    { label: 'Converted', value: stats.converted, icon: BarChart3 },
  ];

  const leadTabs: Array<{ id: LeadTab; label: string; count: number; description: string }> = [
    { id: 'all', label: 'All Leads', count: stats.total, description: 'Every wholesale inquiry in one view.' },
    { id: 'samples', label: 'Sample Requests', count: stats.samples, description: 'Requests that need fulfillment and tracking.' },
    { id: 'canada', label: 'Canada Early Access', count: stats.canada, description: 'Canadian retailers interested in launch availability.' },
  ];

  const canadaStats = useMemo(() => {
    const canadaLeads = leads.filter(isCanadaLead);
    const provinceCounts = canadaLeads.reduce<Record<string, number>>((counts, lead) => {
      const province = getLeadProvinceKey(lead) || 'Unknown';
      counts[province] = (counts[province] || 0) + 1;
      return counts;
    }, {});
    const distributorCounts = canadaLeads.reduce<Record<string, number>>((counts, lead) => {
      getDistributorMentions(lead).forEach((distributor) => {
        counts[distributor] = (counts[distributor] || 0) + 1;
      });
      return counts;
    }, {});
    const scores = canadaLeads.map(getLeadScore).filter((score): score is number => score !== null);
    const topProvince = Object.entries(provinceCounts).sort((a, b) => b[1] - a[1])[0];
    const topDistributor = Object.entries(distributorCounts).sort((a, b) => b[1] - a[1])[0];
    const provinceRows = provinceMeta
      .map((province) => ({
        ...province,
        count: provinceCounts[province.key] || 0,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    const maxProvinceCount = Math.max(...provinceRows.map((province) => province.count), 0);

    return {
      total: canadaLeads.length,
      provinceRows,
      maxProvinceCount,
      topProvince: topProvince ? `${provinceMeta.find((province) => province.key === topProvince[0])?.label || topProvince[0]} (${topProvince[1]})` : 'None yet',
      averageScore: scores.length ? (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1) : 'Not scored',
      topDistributor: topDistributor ? `${topDistributor[0]} (${topDistributor[1]})` : 'None captured',
    };
  }, [leads]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="page-title">Wholesale Pipeline</h1>
          <p className="mt-2 text-sm text-gray-600">
            Review sample requests and Canadian retailer early-access leads from landing pages and campaigns.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchLeads}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-bark-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-bark-600"
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {notice && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {notice}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {statCards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">{label}</p>
              <Icon className="h-5 w-5 text-bark-500/55" />
            </div>
            <p className="mt-3 text-3xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 p-2">
          <div className="grid gap-2 lg:grid-cols-3">
            {leadTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'rounded-md px-4 py-3 text-left transition',
                  activeTab === tab.id
                    ? 'bg-bark-500 text-white shadow-sm'
                    : 'text-gray-700 hover:bg-gray-50'
                )}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">{tab.label}</span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-semibold',
                      activeTab === tab.id ? 'bg-white/15 text-white' : 'bg-gray-100 text-gray-600'
                    )}
                  >
                    {tab.count}
                  </span>
                </span>
                <span className={cn('mt-1 block text-xs', activeTab === tab.id ? 'text-cream-100/80' : 'text-gray-500')}>
                  {tab.description}
                </span>
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'canada' && (
          <div className="border-b border-gray-200 bg-cream-50 p-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ['Canada leads', canadaStats.total],
                ['Top province', canadaStats.topProvince],
                ['Average lead score', canadaStats.averageScore],
                ['Top distributor', canadaStats.topDistributor],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-cream-200 bg-white px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-bark-500/60">{label}</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <section className="rounded-lg border border-cream-200 bg-white p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">Store Interest Map</h2>
                    <p className="mt-1 text-xs text-gray-500">Canadian retailer interest by province and territory.</p>
                  </div>
                  {selectedProvinceKey && (
                    <button
                      type="button"
                      onClick={() => setSelectedProvinceKey('')}
                      className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-bark-500 hover:text-bark-500"
                    >
                      Clear province
                    </button>
                  )}
                </div>

                <div className="relative mt-4 h-[320px] overflow-hidden rounded-lg border border-cream-200 bg-[#f6efe2]">
                  <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(59,42,30,0.05)_1px,transparent_1px),linear-gradient(rgba(59,42,30,0.05)_1px,transparent_1px)] bg-[size:48px_48px]" />
                  <div className="absolute left-[7%] top-[18%] h-[68%] w-[84%] rounded-[45%] border border-bark-500/10 bg-white/35 shadow-inner" />
                  <div className="absolute left-[49%] top-[12%] h-[44%] w-[30%] rotate-[-10deg] rounded-[45%] border border-bark-500/10 bg-white/25" />
                  <div className="absolute left-[68%] top-[48%] h-[28%] w-[25%] rotate-[12deg] rounded-[45%] border border-bark-500/10 bg-white/30" />

                  {canadaStats.provinceRows.map((province) => {
                    const isSelected = selectedProvinceKey === province.key;
                    const hasLeads = province.count > 0;
                    const size = hasLeads && canadaStats.maxProvinceCount
                      ? 18 + Math.round((province.count / canadaStats.maxProvinceCount) * 28)
                      : 12;

                    return (
                      <button
                        key={province.key}
                        type="button"
                        disabled={!hasLeads}
                        onClick={() => setSelectedProvinceKey(isSelected ? '' : province.key)}
                        className={cn(
                          'absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 text-[10px] font-bold shadow-sm transition',
                          hasLeads
                            ? 'border-white bg-bark-500 text-white hover:scale-110 hover:bg-bark-600'
                            : 'border-cream-300 bg-white/80 text-gray-400',
                          isSelected && 'scale-125 ring-4 ring-bark-500/20'
                        )}
                        style={{
                          left: `${province.x}%`,
                          top: `${province.y}%`,
                          width: size,
                          height: size,
                        }}
                        aria-label={`${province.label}: ${province.count} leads`}
                        title={`${province.label}: ${province.count} leads`}
                      >
                        {hasLeads ? province.count : ''}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-lg border border-cream-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">Province Density</h2>
                    <p className="mt-1 text-xs text-gray-500">
                      {selectedProvinceKey
                        ? `${provinceMeta.find((province) => province.key === selectedProvinceKey)?.label || selectedProvinceKey} selected`
                        : 'Ranked by Canadian lead count.'}
                    </p>
                  </div>
                  <MapPin className="h-4 w-4 text-bark-500/55" />
                </div>
                <div className="mt-4 space-y-2">
                  {canadaStats.provinceRows.slice(0, 8).map((province) => {
                    const isSelected = selectedProvinceKey === province.key;
                    const percent = canadaStats.maxProvinceCount ? (province.count / canadaStats.maxProvinceCount) * 100 : 0;

                    return (
                      <button
                        key={province.key}
                        type="button"
                        onClick={() => setSelectedProvinceKey(isSelected ? '' : province.key)}
                        className={cn(
                          'w-full rounded-md border px-3 py-2 text-left transition',
                          isSelected
                            ? 'border-bark-500 bg-bark-50'
                            : 'border-gray-100 hover:border-bark-500/40 hover:bg-gray-50'
                        )}
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-gray-800">{province.label}</span>
                          <span className="text-xs font-semibold text-gray-500">{province.count}</span>
                        </span>
                        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-gray-100">
                          <span
                            className="block h-full rounded-full bg-bark-500"
                            style={{ width: `${percent}%` }}
                          />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 border-b border-gray-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-xl flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search store, contact, email, city, campaign..."
              className="w-full rounded-lg border border-gray-200 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-bark-500 focus:ring-4 focus:ring-bark-500/10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as LeadStatus | 'all')}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 outline-none transition focus:border-bark-500 focus:ring-4 focus:ring-bark-500/10"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <div className="flex min-h-[280px] items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-bark-500 border-t-transparent" />
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">
            <Store className="h-10 w-10 text-gray-300" />
            <p className="mt-3 font-semibold text-gray-900">No wholesale leads found</p>
            <p className="mt-1 max-w-md text-sm text-gray-500">
              Replit submissions will appear here after the form reaches the portal endpoint.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-header px-5 py-3">Store</th>
                  <th className="table-header px-5 py-3">Contact</th>
                  <th className="table-header px-5 py-3">Location</th>
                  <th className="table-header px-5 py-3">Source</th>
                  <th className="table-header px-5 py-3">Status</th>
                  <th className="table-header px-5 py-3">Received</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-gray-900">{lead.store_name}</p>
                      <p className="mt-1 text-xs text-gray-500">{lead.store_type || 'Store type not provided'}</p>
                      <p className="mt-1 text-xs font-semibold text-bark-500/70">{getLeadTypeLabel(lead)}</p>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-700">
                      <p className="font-medium text-gray-900">{lead.contact_name}</p>
                      <p className="mt-1">{lead.email}</p>
                      {lead.phone && <p className="mt-1 text-gray-500">{lead.phone}</p>}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-700">
                      {getLocation(lead) || 'Not captured'}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-700">
                      <p className="font-medium">{lead.utm_campaign || lead.source || 'landing_page'}</p>
                      <p className="mt-1 text-xs text-gray-500">{[lead.utm_source, lead.utm_medium].filter(Boolean).join(' / ') || 'No UTM'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-semibold', statusStyles[lead.status])}>
                        {statusLabels[lead.status]}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600">{formatDate(lead.created_at)}</td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedLead(lead)}
                        className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:border-bark-500 hover:text-bark-500"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedLead && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/35">
          <div className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-gray-200 bg-white p-6">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-bark-500/70">Wholesale lead</p>
                <h2 className="mt-1 font-display text-2xl font-bold text-gray-900">{selectedLead.store_name}</h2>
                <p className="mt-1 text-sm text-gray-500">Received {formatDate(selectedLead.created_at)}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLead(null)}
                className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6 p-6">
              <div className="flex flex-wrap gap-2">
                <span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-semibold', statusStyles[selectedLead.status])}>
                  {statusLabels[selectedLead.status]}
                </span>
                <span className="inline-flex rounded-full bg-cream-100 px-2.5 py-1 text-xs font-semibold text-bark-500">
                  {getLeadTypeLabel(selectedLead)}
                </span>
                {selectedLead.converted_retailer_id && (
                  <span className="inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">Converted</span>
                )}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                {selectedLead.status === 'new' && isSampleLead(selectedLead) && (
                  <button
                    type="button"
                    onClick={() => approveLead(selectedLead)}
                    disabled={approvingLeadId === selectedLead.id || deletingLeadId === selectedLead.id}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-bark-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-bark-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    {approvingLeadId === selectedLead.id ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Approving...
                      </>
                    ) : (
                      <>
                        <Truck className="h-4 w-4" />
                        Approve Sample Request
                      </>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => deleteLead(selectedLead)}
                  disabled={approvingLeadId === selectedLead.id || deletingLeadId === selectedLead.id}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {deletingLeadId === selectedLead.id ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      Delete Lead
                    </>
                  )}
                </button>
              </div>

              <section className="rounded-lg border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900">Contact</h3>
                <div className="mt-4 grid gap-3 text-sm text-gray-700 sm:grid-cols-2">
                  <div className="flex gap-3">
                    <Store className="mt-0.5 h-4 w-4 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">{selectedLead.store_name}</p>
                      <p>{selectedLead.store_type || 'Store type not provided'}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Mail className="mt-0.5 h-4 w-4 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">{selectedLead.contact_name}</p>
                      <a className="text-bark-500 hover:underline" href={`mailto:${selectedLead.email}`}>
                        {selectedLead.email}
                      </a>
                    </div>
                  </div>
                  {selectedLead.phone && (
                    <div className="flex gap-3">
                      <Phone className="mt-0.5 h-4 w-4 text-gray-400" />
                      <a className="text-bark-500 hover:underline" href={`tel:${selectedLead.phone}`}>
                        {selectedLead.phone}
                      </a>
                    </div>
                  )}
                  {selectedLead.store_url && (
                    <div className="flex gap-3">
                      <ExternalLink className="mt-0.5 h-4 w-4 text-gray-400" />
                      <a
                        className="break-all text-bark-500 hover:underline"
                        href={normalizeUrl(selectedLead.store_url)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {selectedLead.store_url}
                      </a>
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-lg border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900">{isSampleLead(selectedLead) ? 'Shipping' : 'Location'}</h3>
                <div className="mt-4 flex gap-3 whitespace-pre-line text-sm text-gray-700">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  {isSampleLead(selectedLead) ? getAddress(selectedLead) : getLocation(selectedLead) || 'Not captured'}
                </div>
              </section>

              {isCanadaLead(selectedLead) && (
                <section className="rounded-lg border border-gray-200 p-5">
                  <h3 className="font-semibold text-gray-900">Canada Launch Planning</h3>
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    {[
                      ['Province', getProvince(selectedLead)],
                      ['Lead score', getLeadScore(selectedLead)?.toString()],
                      ['Product interest', getProductInterest(selectedLead).join(', ')],
                      ['Estimated first order', getFirstOrderRange(selectedLead)],
                      ['Distributors', getDistributorMentions(selectedLead).join(', ')],
                      ['Consent', rawString(selectedLead, ['consentAccepted', 'consent_accepted'])],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-md bg-gray-50 p-3">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
                        <dd className="mt-1 break-words font-medium text-gray-900">{value || 'Not captured'}</dd>
                      </div>
                    ))}
                  </dl>
                  {rawString(selectedLead, ['additionalNotes', 'anythingElse', 'notes', 'anything_else']) && (
                    <div className="mt-4 rounded-md bg-gray-50 p-3 text-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Retailer notes</p>
                      <p className="mt-1 whitespace-pre-line font-medium text-gray-900">
                        {rawString(selectedLead, ['additionalNotes', 'anythingElse', 'notes', 'anything_else'])}
                      </p>
                    </div>
                  )}
                </section>
              )}

              <section className="rounded-lg border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900">Attribution</h3>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  {[
                    ['Source', selectedLead.source],
                    ['UTM source', selectedLead.utm_source],
                    ['UTM medium', selectedLead.utm_medium],
                    ['UTM campaign', selectedLead.utm_campaign],
                    ['UTM content', selectedLead.utm_content],
                    ['UTM term', selectedLead.utm_term],
                    ['GCLID', selectedLead.gclid],
                    ['FBCLID', selectedLead.fbclid],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-md bg-gray-50 p-3">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
                      <dd className="mt-1 break-all font-medium text-gray-900">{value || 'Not captured'}</dd>
                    </div>
                  ))}
                </dl>
                {(selectedLead.landing_page_url || selectedLead.referrer) && (
                  <div className="mt-4 space-y-2 text-sm">
                    {selectedLead.landing_page_url && (
                      <p>
                        <span className="font-semibold text-gray-700">Landing page: </span>
                        <span className="break-all text-gray-600">{selectedLead.landing_page_url}</span>
                      </p>
                    )}
                    {selectedLead.referrer && (
                      <p>
                        <span className="font-semibold text-gray-700">Referrer: </span>
                        <span className="break-all text-gray-600">{selectedLead.referrer}</span>
                      </p>
                    )}
                  </div>
                )}
              </section>

              {isSampleLead(selectedLead) && (
                <section className="rounded-lg border border-gray-200 p-5">
                  <h3 className="font-semibold text-gray-900">Fulfillment</h3>
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-gray-500">Approved</dt>
                      <dd className="mt-1 font-medium text-gray-900">{formatDate(selectedLead.approved_at)}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Tracking</dt>
                      <dd className="mt-1 font-medium text-gray-900">
                        {selectedLead.tracking_number
                          ? [selectedLead.tracking_carrier, selectedLead.tracking_number].filter(Boolean).join(' ')
                          : 'Not added'}
                      </dd>
                    </div>
                  </dl>
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
