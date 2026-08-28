'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  ExternalLink,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  Store,
  Trash2,
  X,
} from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import type { StoreNomination, StoreNominationStatus } from '@/types';

type Notice = {
  type: 'success' | 'error';
  message: string;
};

const statusOptions: Array<{ value: StoreNominationStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All nominations' },
  { value: 'new', label: 'New' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'converted', label: 'Converted' },
  { value: 'dismissed', label: 'Dismissed' },
];

const statusLabels: Record<StoreNominationStatus, string> = {
  new: 'New',
  reviewing: 'Reviewing',
  contacted: 'Contacted',
  converted: 'Converted',
  dismissed: 'Dismissed',
};

const statusStyles: Record<StoreNominationStatus, string> = {
  new: 'bg-blue-100 text-blue-700',
  reviewing: 'bg-amber-100 text-amber-800',
  contacted: 'bg-purple-100 text-purple-700',
  converted: 'bg-emerald-100 text-emerald-700',
  dismissed: 'bg-gray-100 text-gray-700',
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

const formatAddress = (nomination: StoreNomination) =>
  [
    nomination.store_address,
    [nomination.store_city, nomination.store_state, nomination.store_postal_code].filter(Boolean).join(', '),
  ]
    .filter(Boolean)
    .join('\n');

const normalizeUrl = (value?: string | null) => {
  const trimmed = (value || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('@')) return `https://instagram.com/${trimmed.slice(1)}`;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

export default function StoreNominationsPage() {
  const supabase = createClientComponentClient();
  const [nominations, setNominations] = useState<StoreNomination[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StoreNominationStatus | 'all'>('all');
  const [selectedNomination, setSelectedNomination] = useState<StoreNomination | null>(null);
  const [statusDraft, setStatusDraft] = useState<StoreNominationStatus>('new');
  const [adminNotesDraft, setAdminNotesDraft] = useState('');
  const [updatingNominationId, setUpdatingNominationId] = useState<string | null>(null);
  const [deletingNominationId, setDeletingNominationId] = useState<string | null>(null);

  useEffect(() => {
    fetchNominations();
  }, []);

  useEffect(() => {
    if (!selectedNomination) return;
    setStatusDraft(selectedNomination.status);
    setAdminNotesDraft(selectedNomination.admin_notes || '');
  }, [selectedNomination]);

  const fetchNominations = async () => {
    setIsLoading(true);
    setNotice(null);

    const { data, error } = await supabase
      .from('store_nominations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Store nominations load error:', error);
      setNotice({ type: 'error', message: error.message || 'Unable to load store nominations.' });
      setNominations([]);
      setIsLoading(false);
      return;
    }

    setNominations((data || []) as StoreNomination[]);
    setIsLoading(false);
  };

  const updateNomination = async (nomination: StoreNomination) => {
    setUpdatingNominationId(nomination.id);
    setNotice(null);

    try {
      const response = await fetch(`/api/admin/store-nominations/${nomination.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: statusDraft,
          adminNotes: adminNotesDraft,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Unable to update store nomination.');
      }

      const updatedNomination = payload.nomination as StoreNomination;
      setNominations((current) => current.map((item) => (item.id === updatedNomination.id ? updatedNomination : item)));
      setSelectedNomination(updatedNomination);
      setNotice({ type: 'success', message: `Updated ${updatedNomination.store_name}.` });
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to update store nomination.' });
    } finally {
      setUpdatingNominationId(null);
    }
  };

  const deleteNomination = async (nomination: StoreNomination) => {
    const confirmed = window.confirm(`Delete ${nomination.store_name} from Store Nominations? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingNominationId(nomination.id);
    setNotice(null);

    try {
      const response = await fetch(`/api/admin/store-nominations/${nomination.id}`, {
        method: 'DELETE',
      });
      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Unable to delete store nomination.');
      }

      setNominations((current) => current.filter((item) => item.id !== nomination.id));
      setSelectedNomination(null);
      setNotice({ type: 'success', message: `Deleted ${nomination.store_name}.` });
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to delete store nomination.' });
    } finally {
      setDeletingNominationId(null);
    }
  };

  const filteredNominations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return nominations.filter((nomination) => {
      if (statusFilter !== 'all' && nomination.status !== statusFilter) return false;
      if (!normalizedQuery) return true;

      return [
        nomination.store_name,
        nomination.store_city,
        nomination.store_state,
        nomination.consumer_name,
        nomination.consumer_email,
        nomination.consumer_phone,
        nomination.store_url,
        nomination.note,
        nomination.source,
        nomination.utm_campaign,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    });
  }, [nominations, query, statusFilter]);

  const stats = useMemo(() => ({
    total: nominations.length,
    new: nominations.filter((nomination) => nomination.status === 'new').length,
    reviewing: nominations.filter((nomination) => nomination.status === 'reviewing').length,
    contacted: nominations.filter((nomination) => nomination.status === 'contacted').length,
    converted: nominations.filter((nomination) => nomination.status === 'converted').length,
  }), [nominations]);

  const statCards: Array<{ label: string; value: number; icon: LucideIcon }> = [
    { label: 'Total', value: stats.total, icon: Store },
    { label: 'New', value: stats.new, icon: Clock },
    { label: 'Reviewing', value: stats.reviewing, icon: Search },
    { label: 'Contacted', value: stats.contacted, icon: Mail },
    { label: 'Converted', value: stats.converted, icon: CheckCircle },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="page-title">Store Nominations</h1>
          <p className="mt-2 text-sm text-gray-600">
            Review consumer requests for neighborhood stores to carry Bare.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchNominations}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-bark-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-bark-600"
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {notice && (
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg border px-4 py-3 text-sm',
            notice.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-700',
          )}
        >
          {notice.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {notice.message}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {statCards.map(({ label, value, icon: StatIcon }) => {
          return (
            <div key={label} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500">{label}</p>
                <StatIcon className="h-5 w-5 text-bark-500/55" />
              </div>
              <p className="mt-3 text-3xl font-bold text-gray-900">{value}</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-xl flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search store, city, customer, email..."
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm focus:border-bark-500 focus:outline-none focus:ring-2 focus:ring-bark-500/10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StoreNominationStatus | 'all')}
            className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-bark-500 focus:outline-none focus:ring-2 focus:ring-bark-500/10"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="h-6 w-6 animate-spin text-bark-500" />
          </div>
        ) : filteredNominations.length === 0 ? (
          <div className="py-16 text-center">
            <Store className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-3 text-sm font-medium text-gray-900">No store nominations found</p>
            <p className="mt-1 text-sm text-gray-500">New Replit submissions will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredNominations.map((nomination) => (
              <button
                key={nomination.id}
                type="button"
                onClick={() => setSelectedNomination(nomination)}
                className="block w-full px-4 py-4 text-left transition hover:bg-gray-50"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-base font-semibold text-gray-900">{nomination.store_name}</h2>
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', statusStyles[nomination.status])}>
                        {statusLabels[nomination.status]}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        {[nomination.store_city, nomination.store_state].filter(Boolean).join(', ')}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-4 w-4 text-gray-400" />
                        {nomination.consumer_email}
                      </span>
                    </div>
                    {nomination.note && (
                      <p className="mt-2 line-clamp-2 text-sm text-gray-500">{nomination.note}</p>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 lg:text-right">
                    <p>{formatDate(nomination.created_at)}</p>
                    <p className="mt-1">{nomination.source || 'store_locator'}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedNomination && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
          <div className="mx-auto my-6 max-w-4xl rounded-lg bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-6">
              <div>
                <p className="text-sm font-medium text-gray-500">Store nomination</p>
                <h2 className="mt-1 text-2xl font-bold text-gray-900">{selectedNomination.store_name}</h2>
                <p className="mt-2 whitespace-pre-line text-sm text-gray-600">{formatAddress(selectedNomination) || 'Address not provided'}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNomination(null)}
                className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-6">
                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Submitted by</h3>
                  <div className="mt-3 rounded-lg border border-gray-200 p-4">
                    <p className="font-semibold text-gray-900">{selectedNomination.consumer_name}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-600">
                      <a className="inline-flex items-center gap-1 text-bark-500 hover:underline" href={`mailto:${selectedNomination.consumer_email}`}>
                        <Mail className="h-4 w-4" />
                        {selectedNomination.consumer_email}
                      </a>
                      {selectedNomination.consumer_phone && (
                        <a className="inline-flex items-center gap-1 text-bark-500 hover:underline" href={`tel:${selectedNomination.consumer_phone}`}>
                          <Phone className="h-4 w-4" />
                          {selectedNomination.consumer_phone}
                        </a>
                      )}
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Store details</h3>
                  <div className="mt-3 rounded-lg border border-gray-200 p-4">
                    <dl className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Store</dt>
                        <dd className="mt-1 text-sm text-gray-900">{selectedNomination.store_name}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Website or social</dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {selectedNomination.store_url ? (
                            <a
                              href={normalizeUrl(selectedNomination.store_url)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-bark-500 hover:underline"
                            >
                              {selectedNomination.store_url}
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : (
                            'Not provided'
                          )}
                        </dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Customer note</dt>
                        <dd className="mt-1 whitespace-pre-line text-sm text-gray-900">{selectedNomination.note || 'Not provided'}</dd>
                      </div>
                    </dl>
                  </div>
                </section>

                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Attribution</h3>
                  <div className="mt-3 rounded-lg border border-gray-200 p-4">
                    <dl className="grid gap-4 sm:grid-cols-2">
                      {[
                        ['Source', selectedNomination.source || 'store_locator'],
                        ['Campaign', selectedNomination.utm_campaign || 'Not captured'],
                        ['Medium', selectedNomination.utm_medium || 'Not captured'],
                        ['Landing page', selectedNomination.landing_page_url || 'Not captured'],
                        ['Referrer', selectedNomination.referrer || 'Not captured'],
                        ['Submitted', formatDate(selectedNomination.created_at)],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
                          <dd className="mt-1 break-words text-sm text-gray-900">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </section>
              </div>

              <aside className="space-y-4">
                <div className="rounded-lg border border-gray-200 p-4">
                  <label className="text-sm font-semibold text-gray-900" htmlFor="nomination-status">
                    Status
                  </label>
                  <select
                    id="nomination-status"
                    value={statusDraft}
                    onChange={(event) => setStatusDraft(event.target.value as StoreNominationStatus)}
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-bark-500 focus:outline-none focus:ring-2 focus:ring-bark-500/10"
                  >
                    {statusOptions.filter((option) => option.value !== 'all').map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  <label className="mt-4 block text-sm font-semibold text-gray-900" htmlFor="admin-notes">
                    Admin notes
                  </label>
                  <textarea
                    id="admin-notes"
                    value={adminNotesDraft}
                    onChange={(event) => setAdminNotesDraft(event.target.value)}
                    rows={6}
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-bark-500 focus:outline-none focus:ring-2 focus:ring-bark-500/10"
                  />

                  <button
                    type="button"
                    onClick={() => updateNomination(selectedNomination)}
                    disabled={updatingNominationId === selectedNomination.id}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-bark-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-bark-600 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {updatingNominationId === selectedNomination.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                    Save triage
                  </button>
                </div>

                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <div className="flex items-start gap-3">
                    <MessageSquare className="mt-0.5 h-4 w-4 text-red-600" />
                    <p className="text-sm text-red-800">
                      Convert qualified nominations manually into Wholesale Pipeline for now.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteNomination(selectedNomination)}
                    disabled={deletingNominationId === selectedNomination.id}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {deletingNominationId === selectedNomination.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Delete nomination
                  </button>
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
