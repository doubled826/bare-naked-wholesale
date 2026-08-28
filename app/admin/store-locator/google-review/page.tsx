'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Store,
  XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GooglePlaceReviewStatus } from '@/types';

type QueueLocation = {
  id: string;
  retailer_id: string;
  location_name: string;
  public_display_name?: string | null;
  business_address: string;
  phone?: string | null;
  is_public?: boolean;
  google_place_id?: string | null;
  google_place_match_confidence?: number | null;
  google_place_matched_at?: string | null;
  google_place_match_error?: string | null;
  google_place_review_status?: GooglePlaceReviewStatus | null;
  google_place_reviewed_at?: string | null;
  google_place_review_notes?: string | null;
  retailer?: { id: string; company_name: string } | Array<{ id: string; company_name: string }> | null;
};

type GooglePlaceMatch = {
  placeId: string;
  displayName: string | null;
  formattedAddress: string | null;
  nationalPhoneNumber: string | null;
  internationalPhoneNumber: string | null;
  websiteUri: string | null;
  googleMapsUri: string | null;
  businessStatus: string | null;
  latitude: number | null;
  longitude: number | null;
  confidence: number;
};

type Notice = {
  type: 'success' | 'error';
  message: string;
};

const statusOptions: Array<{ value: GooglePlaceReviewStatus | 'all'; label: string }> = [
  { value: 'needs_review', label: 'Needs review' },
  { value: 'high_confidence', label: 'High confidence' },
  { value: 'low_confidence', label: 'Low confidence' },
  { value: 'no_listing', label: 'No listing' },
  { value: 'approved_portal_data', label: 'Approved portal data' },
  { value: 'use_google_manually', label: 'Use Google manually' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: 'all', label: 'All' },
];

const statusLabels: Record<GooglePlaceReviewStatus, string> = {
  needs_review: 'Needs review',
  high_confidence: 'High confidence',
  low_confidence: 'Low confidence',
  no_listing: 'No listing',
  approved_portal_data: 'Approved portal data',
  use_google_manually: 'Use Google manually',
  dismissed: 'Dismissed',
};

const statusStyles: Record<GooglePlaceReviewStatus, string> = {
  needs_review: 'border-gray-200 bg-gray-50 text-gray-700',
  high_confidence: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  low_confidence: 'border-amber-100 bg-amber-50 text-amber-800',
  no_listing: 'border-red-100 bg-red-50 text-red-700',
  approved_portal_data: 'border-blue-100 bg-blue-50 text-blue-700',
  use_google_manually: 'border-purple-100 bg-purple-50 text-purple-700',
  dismissed: 'border-gray-200 bg-gray-100 text-gray-600',
};

const formatDate = (value?: string | null) => {
  if (!value) return 'Never';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
};

const getRetailer = (location: QueueLocation) => (
  Array.isArray(location.retailer) ? location.retailer[0] : location.retailer
);

const getDisplayName = (location: QueueLocation) =>
  location.public_display_name || location.location_name || getRetailer(location)?.company_name || 'Unnamed location';

const normalizeStatus = (status?: GooglePlaceReviewStatus | null): GooglePlaceReviewStatus =>
  status || 'needs_review';

type StatCard = {
  label: string;
  value: number;
  icon: LucideIcon;
};

export default function GoogleReviewQueuePage() {
  const [locations, setLocations] = useState<QueueLocation[]>([]);
  const [statusFilter, setStatusFilter] = useState<GooglePlaceReviewStatus | 'all'>('needs_review');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(25);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunningBulk, setIsRunningBulk] = useState(false);
  const [checkingLocationId, setCheckingLocationId] = useState<string | null>(null);
  const [savingLocationId, setSavingLocationId] = useState<string | null>(null);
  const [matches, setMatches] = useState<Record<string, GooglePlaceMatch>>({});
  const [notice, setNotice] = useState<Notice | null>(null);

  const fetchQueue = async () => {
    setIsLoading(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/store-locator/google-place-review?status=${encodeURIComponent(statusFilter)}`);
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Unable to load Google review queue.');
      }
      setLocations((payload.locations || []) as QueueLocation[]);
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to load Google review queue.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, [statusFilter]);

  const stats = useMemo(() => {
    const counts = locations.reduce<Record<string, number>>((totals, location) => {
      const status = normalizeStatus(location.google_place_review_status);
      totals[status] = (totals[status] || 0) + 1;
      return totals;
    }, {});

    return {
      total: locations.length,
      high: counts.high_confidence || 0,
      low: counts.low_confidence || 0,
      noListing: counts.no_listing || 0,
    };
  }, [locations]);

  const filteredLocations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return locations;

    return locations.filter((location) => [
      getDisplayName(location),
      getRetailer(location)?.company_name,
      location.business_address,
      location.phone,
      location.google_place_match_error,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedQuery)));
  }, [locations, query]);

  const runBulkReview = async () => {
    setIsRunningBulk(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/store-locator/google-place-review?status=${encodeURIComponent(statusFilter === 'all' ? 'needs_review' : statusFilter)}&limit=${limit}`, {
        method: 'POST',
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Unable to run Google review.');
      }
      setNotice({
        type: 'success',
        message: `Processed ${payload.processed} locations: ${payload.highConfidence} high, ${payload.lowConfidence} low, ${payload.noListing} no listing.`,
      });
      await fetchQueue();
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to run Google review.' });
    } finally {
      setIsRunningBulk(false);
    }
  };

  const compareLocation = async (locationId: string) => {
    setCheckingLocationId(locationId);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/retailer-locations/${locationId}/google-place`, {
        method: 'POST',
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Unable to compare with Google.');
      }
      setMatches((current) => ({ ...current, [locationId]: payload.match as GooglePlaceMatch }));
      await fetchQueue();
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to compare with Google.' });
    } finally {
      setCheckingLocationId(null);
    }
  };

  const updateReviewStatus = async (location: QueueLocation, status: GooglePlaceReviewStatus) => {
    setSavingLocationId(location.id);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/retailer-locations/${location.id}/google-place-review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          notes: location.google_place_review_notes || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Unable to update review status.');
      }
      setLocations((current) => current.map((item) => item.id === location.id ? payload.location as QueueLocation : item));
      setNotice({ type: 'success', message: `Marked ${getDisplayName(location)} as ${statusLabels[status].toLowerCase()}.` });
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to update review status.' });
    } finally {
      setSavingLocationId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="page-title">Google Review Queue</h1>
          <p className="mt-2 text-sm text-gray-600">
            Compare public locator locations against Google Business listings without changing public store data.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={limit}
            onChange={(event) => setLimit(Number(event.target.value))}
            className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-bark-500 focus:outline-none focus:ring-2 focus:ring-bark-500/10"
          >
            {[10, 25, 50, 100].map((value) => (
              <option key={value} value={value}>{value} per run</option>
            ))}
          </select>
          <button
            type="button"
            onClick={runBulkReview}
            disabled={isRunningBulk || statusFilter === 'all'}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-bark-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-bark-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRunningBulk ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Run Batch
          </button>
          <button
            type="button"
            onClick={fetchQueue}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            Refresh
          </button>
        </div>
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {([
          { label: 'Visible in queue', value: stats.total, icon: Store },
          { label: 'High confidence', value: stats.high, icon: CheckCircle },
          { label: 'Low confidence', value: stats.low, icon: AlertCircle },
          { label: 'No listing', value: stats.noListing, icon: XCircle },
        ] satisfies StatCard[]).map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">{label}</p>
              <Icon className="h-5 w-5 text-bark-500/55" />
            </div>
            <p className="mt-3 text-3xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search retailer, location, address, phone..."
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm focus:border-bark-500 focus:outline-none focus:ring-2 focus:ring-bark-500/10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatusFilter(option.value)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-sm font-medium transition',
                  statusFilter === option.value
                    ? 'border-bark-500 bg-bark-500 text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-bark-500 hover:text-bark-500',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading queue...
          </div>
        ) : filteredLocations.length === 0 ? (
          <div className="p-12 text-center">
            <Store className="mx-auto h-9 w-9 text-gray-300" />
            <p className="mt-3 text-sm font-medium text-gray-800">No locations found.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredLocations.map((location) => {
              const status = normalizeStatus(location.google_place_review_status);
              const retailer = getRetailer(location);
              const match = matches[location.id];

              return (
                <div key={location.id} className="space-y-4 p-4">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold text-gray-900">{getDisplayName(location)}</h2>
                        <span className={cn('rounded-full border px-2 py-0.5 text-xs font-semibold', statusStyles[status])}>
                          {statusLabels[status]}
                        </span>
                        {location.google_place_match_confidence !== null && location.google_place_match_confidence !== undefined && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                            {Math.round(Number(location.google_place_match_confidence) * 100)}%
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-gray-600">{retailer?.company_name || 'Retailer not found'}</p>
                      <p className="mt-2 flex items-start gap-2 whitespace-pre-line text-sm text-gray-600">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                        {location.business_address}
                      </p>
                      {location.phone && <p className="mt-1 text-sm text-gray-500">{location.phone}</p>}
                      <p className="mt-2 text-xs text-gray-500">
                        Last checked: {formatDate(location.google_place_matched_at)}
                        {location.google_place_match_error ? ` · ${location.google_place_match_error}` : ''}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 xl:justify-end">
                      <button
                        type="button"
                        onClick={() => compareLocation(location.id)}
                        disabled={checkingLocationId === location.id}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
                      >
                        {checkingLocationId === location.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        Compare
                      </button>
                      <Link
                        href={`/admin/retailers/${location.retailer_id}`}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                      >
                        Retailer
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>

                  {match && (
                    <div className="grid gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm md:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Google listing</p>
                        <p className="mt-1 font-semibold text-gray-900">{match.displayName || 'Unnamed listing'}</p>
                        <p className="mt-1 whitespace-pre-line text-gray-600">{match.formattedAddress || 'No address returned'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Google details</p>
                        <p className="mt-1 text-gray-700">{match.nationalPhoneNumber || match.internationalPhoneNumber || 'No phone returned'}</p>
                        <div className="mt-2 flex flex-wrap gap-3">
                          {match.websiteUri && (
                            <a href={match.websiteUri} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-bark-500 hover:text-bark-600">
                              Website <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {match.googleMapsUri && (
                            <a href={match.googleMapsUri} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-bark-500 hover:text-bark-600">
                              Maps <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                        <p className="mt-2 text-xs text-gray-500">Source: Google Places. Review internally before changing portal fields.</p>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {[
                      ['approved_portal_data', 'Approve portal data'],
                      ['use_google_manually', 'Use Google manually'],
                      ['needs_review', 'Needs review'],
                      ['dismissed', 'Dismiss'],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => updateReviewStatus(location, value as GooglePlaceReviewStatus)}
                        disabled={savingLocationId === location.id}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-bark-500 hover:text-bark-500 disabled:opacity-60"
                      >
                        {savingLocationId === location.id && <Loader2 className="h-4 w-4 animate-spin" />}
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
