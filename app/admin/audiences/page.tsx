'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Download,
  Loader2,
  RefreshCw,
  Target,
  Users,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

type AudienceType = 'top_revenue' | 'repeat_buyers' | 'all_purchasers';

type PreviewRow = {
  id: string;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  totalOrders: number;
  totalSpent: number;
  lastOrderAt?: string | null;
};

type PreviewPayload = {
  audienceType: AudienceType;
  limit: number;
  count: number;
  totalValue: number;
  rows: PreviewRow[];
};

type Notice = {
  type: 'success' | 'error';
  message: string;
};

const audienceOptions: Array<{
  value: AudienceType;
  label: string;
  description: string;
}> = [
  {
    value: 'top_revenue',
    label: 'Top stores by revenue',
    description: 'Best for value-based lookalikes from your strongest wholesale customers.',
  },
  {
    value: 'repeat_buyers',
    label: 'Repeat buyers',
    description: 'Stores with at least two non-canceled orders.',
  },
  {
    value: 'all_purchasers',
    label: 'All purchasers',
    description: 'Every retailer with at least one non-canceled order, sorted by recency.',
  },
];

const limitOptions = [100, 250, 500, 1000];

const formatDate = (value?: string | null) => {
  if (!value) return 'Never';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
};

export default function AdminAudiencesPage() {
  const [audienceType, setAudienceType] = useState<AudienceType>('top_revenue');
  const [limit, setLimit] = useState(250);
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const selectedAudience = useMemo(
    () => audienceOptions.find((option) => option.value === audienceType) || audienceOptions[0],
    [audienceType],
  );

  async function loadPreview() {
    setIsLoading(true);
    setNotice(null);

    try {
      const params = new URLSearchParams({
        format: 'json',
        audience: audienceType,
        limit: String(limit),
      });
      const response = await fetch(`/api/admin/export/meta-audience?${params.toString()}`, {
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to load Meta audience preview.');
      }

      setPreview(payload as PreviewPayload);
    } catch (error) {
      setPreview(null);
      setNotice({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to load Meta audience preview.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadPreview();
  }, [audienceType, limit]);

  function downloadCsv() {
    const params = new URLSearchParams({
      audience: audienceType,
      limit: String(limit),
    });
    window.location.href = `/api/admin/export/meta-audience?${params.toString()}`;
    setNotice({ type: 'success', message: 'Meta audience CSV download started.' });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-bark-500">Audiences</h1>
          <p className="mt-2 text-sm text-gray-600">
            Export Meta-ready customer lists from wholesale retailer performance.
          </p>
        </div>
        <button
          type="button"
          onClick={downloadCsv}
          disabled={isLoading || !preview?.count}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-bark-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-bark-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {notice && (
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg border px-4 py-3 text-sm',
            notice.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-900'
              : 'border-red-200 bg-red-50 text-red-900',
          )}
        >
          {notice.type === 'success' ? (
            <CheckCircle className="h-4 w-4 text-emerald-600" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-600" />
          )}
          {notice.message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {audienceOptions.map((option) => {
          const isActive = option.value === audienceType;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setAudienceType(option.value)}
              className={cn(
                'rounded-lg border bg-white p-5 text-left shadow-sm transition',
                isActive ? 'border-bark-500 ring-2 ring-bark-500/10' : 'border-gray-200 hover:border-bark-200',
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className={cn('rounded-lg p-2', isActive ? 'bg-bark-500 text-white' : 'bg-cream-100 text-bark-500')}>
                  <Target className="h-5 w-5" />
                </div>
                {isActive && <CheckCircle className="h-5 w-5 text-emerald-600" />}
              </div>
              <h2 className="mt-4 font-semibold text-gray-900">{option.label}</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">{option.description}</p>
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-200 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{selectedAudience.label}</h2>
            <p className="mt-1 text-sm text-gray-600">{selectedAudience.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 outline-none transition focus:border-bark-500 focus:ring-4 focus:ring-bark-500/10"
            >
              {limitOptions.map((option) => (
                <option key={option} value={option}>Top {option}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={loadPreview}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 border-b border-gray-200 p-5 md:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Rows exported</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{isLoading ? '...' : preview?.count || 0}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Audience value</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{formatCurrency(preview?.totalValue || 0)}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Meta columns</p>
            <p className="mt-2 text-sm font-semibold text-gray-900">email, phone, fn, ln, zip, ct, st, country, uid, value</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading audience preview...
            </div>
          ) : !preview?.rows.length ? (
            <div className="p-10 text-center">
              <Users className="mx-auto h-10 w-10 text-gray-300" />
              <p className="mt-3 text-sm font-semibold text-gray-900">No eligible retailers found.</p>
              <p className="mt-1 text-sm text-gray-500">Retailers need at least one identifier and a qualifying order.</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold">Retailer</th>
                  <th className="px-5 py-3 text-left font-semibold">Identifier</th>
                  <th className="px-5 py-3 text-left font-semibold">Orders</th>
                  <th className="px-5 py-3 text-left font-semibold">Value</th>
                  <th className="px-5 py-3 text-left font-semibold">Last order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {preview.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-gray-900">{row.companyName || 'Unnamed retailer'}</p>
                      <p className="mt-1 font-mono text-xs text-gray-400">{row.id}</p>
                    </td>
                    <td className="px-5 py-4 text-gray-600">
                      <p>{row.email || 'No email'}</p>
                      <p className="mt-1 text-gray-400">{row.phone || 'No phone'}</p>
                    </td>
                    <td className="px-5 py-4 font-semibold text-gray-900">{row.totalOrders}</td>
                    <td className="px-5 py-4 font-semibold text-gray-900">{formatCurrency(row.totalSpent)}</td>
                    <td className="px-5 py-4 text-gray-600">{formatDate(row.lastOrderAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
