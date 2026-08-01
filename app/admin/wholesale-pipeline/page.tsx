'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Clock,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  Store,
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
};

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

const getAddress = (lead: WholesaleLead) =>
  [
    lead.shipping_address_1,
    lead.shipping_address_2,
    `${lead.shipping_city}, ${lead.shipping_state} ${lead.shipping_postal_code}`,
  ]
    .filter(Boolean)
    .join('\n');

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
  const [selectedLead, setSelectedLead] = useState<WholesaleLead | null>(null);
  const [approvingLeadId, setApprovingLeadId] = useState<string | null>(null);

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

  const filteredLeads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return leads.filter((lead) => {
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
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    });
  }, [leads, query, statusFilter]);

  const stats = useMemo(() => {
    const pendingSamples = leads.filter((lead) => ['new', 'approved', 'sample_pack_pending'].includes(lead.status)).length;
    return {
      total: leads.length,
      new: leads.filter((lead) => lead.status === 'new').length,
      trackingAdded: leads.filter((lead) => lead.status === 'tracking_added').length,
      converted: leads.filter((lead) => lead.status === 'converted').length,
      pendingSamples,
    };
  }, [leads]);

  const statCards: StatCard[] = [
    { label: 'Total leads', value: stats.total, icon: Store },
    { label: 'New', value: stats.new, icon: Clock },
    { label: 'Needs sample action', value: stats.pendingSamples, icon: Truck },
    { label: 'Tracking added', value: stats.trackingAdded, icon: ArrowUpRight },
    { label: 'Converted', value: stats.converted, icon: Store },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="page-title">Wholesale Pipeline</h1>
          <p className="mt-2 text-sm text-gray-600">
            Sample requests from the retailer landing page and ad campaigns.
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
                  <th className="table-header px-5 py-3">Ship To</th>
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
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-700">
                      <p className="font-medium text-gray-900">{lead.contact_name}</p>
                      <p className="mt-1">{lead.email}</p>
                      {lead.phone && <p className="mt-1 text-gray-500">{lead.phone}</p>}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-700">
                      {lead.shipping_city}, {lead.shipping_state} {lead.shipping_postal_code}
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
                {selectedLead.converted_retailer_id && (
                  <span className="inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">Converted</span>
                )}
              </div>

              {selectedLead.status === 'new' && (
                <button
                  type="button"
                  onClick={() => approveLead(selectedLead)}
                  disabled={approvingLeadId === selectedLead.id}
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
                <h3 className="font-semibold text-gray-900">Shipping</h3>
                <div className="mt-4 flex gap-3 whitespace-pre-line text-sm text-gray-700">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  {getAddress(selectedLead)}
                </div>
              </section>

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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
