'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Calendar, CheckCircle2, Clock, Mail, RefreshCw, X } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

type PromoStatus = 'dates_needed' | 'scheduled' | 'active' | 'awaiting_sales_summary' | 'completed' | 'canceled' | 'pending' | 'approved';

type PrivatePromoRow = {
  id: string;
  retailer_id: string;
  promo_discount_percent: number;
  duration_weeks: number;
  start_date: string | null;
  end_date: string | null;
  source: 'welcome_offer' | 'dashboard_request' | 'admin_created';
  status: PromoStatus;
  computed_status: PromoStatus;
  sales_summary_requested_at: string | null;
  sales_summary_received_at: string | null;
  last_reminder_sent_at: string | null;
  last_email_stage: string | null;
  pos_sales_amount: number | string | null;
  credit_amount: number | string | null;
  credit_id: string | null;
  credit_issued_at: string | null;
  created_at: string;
  retailer?: {
    id: string;
    company_name: string;
    account_number?: string | null;
    business_address?: string | null;
    phone?: string | null;
    status?: string | null;
  } | null;
};

const statusLabels: Record<string, string> = {
  dates_needed: 'Needs dates',
  scheduled: 'Scheduled',
  active: 'Active',
  awaiting_sales_summary: 'Awaiting POS summary',
  completed: 'Completed',
  canceled: 'Canceled',
  pending: 'Pending',
  approved: 'Approved',
};

const sourceLabels: Record<string, string> = {
  welcome_offer: 'Welcome Offer',
  dashboard_request: 'Dashboard',
  admin_created: 'Admin',
};

function formatDate(value?: string | null) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function statusClass(status: string) {
  switch (status) {
    case 'active':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'awaiting_sales_summary':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'scheduled':
      return 'border-blue-200 bg-blue-50 text-blue-700';
    case 'completed':
      return 'border-gray-200 bg-gray-50 text-gray-600';
    case 'canceled':
      return 'border-red-200 bg-red-50 text-red-700';
    default:
      return 'border-purple-200 bg-purple-50 text-purple-700';
  }
}

export default function AdminPrivateLaunchPromosPage() {
  const [promos, setPromos] = useState<PrivatePromoRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [creditPromo, setCreditPromo] = useState<PrivatePromoRow | null>(null);
  const [posSalesAmount, setPosSalesAmount] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [creditNotes, setCreditNotes] = useState('');
  const [issuingCredit, setIssuingCredit] = useState(false);

  async function loadPromos(initial = false) {
    try {
      if (initial) setIsLoading(true);
      else setRefreshing(true);
      const response = await fetch('/api/admin/private-launch-promos', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Unable to load private promos.');
      setPromos(payload.promos || []);
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to load private promos.' });
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadPromos(true);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const stats = useMemo(() => {
    const active = promos.filter((promo) => promo.computed_status === 'active').length;
    const needsDates = promos.filter((promo) => promo.computed_status === 'dates_needed').length;
    const awaitingSummary = promos.filter((promo) => promo.computed_status === 'awaiting_sales_summary').length;
    const scheduled = promos.filter((promo) => promo.computed_status === 'scheduled').length;
    return { active, needsDates, awaitingSummary, scheduled };
  }, [promos]);

  async function markSummaryReceived(promoId: string) {
    try {
      const response = await fetch(`/api/admin/private-launch-promos/${promoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_summary_received' }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Unable to mark summary received.');
      setNotice({ type: 'success', message: 'POS summary marked received.' });
      loadPromos();
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to update promo.' });
    }
  }

  function openIssueCredit(promo: PrivatePromoRow) {
    const existingPosSales = Number(promo.pos_sales_amount || 0);
    const suggestedPosSales = existingPosSales > 0 ? existingPosSales : 0;
    const suggestedCredit = Number(promo.credit_amount || 0) || Number((suggestedPosSales * Number(promo.promo_discount_percent || 10) / 100).toFixed(2));
    setCreditPromo(promo);
    setPosSalesAmount(suggestedPosSales > 0 ? String(suggestedPosSales.toFixed(2)) : '');
    setCreditAmount(suggestedCredit > 0 ? String(suggestedCredit.toFixed(2)) : '');
    setCreditNotes('');
  }

  function updatePosSalesAmount(value: string, promo = creditPromo) {
    setPosSalesAmount(value);
    const sales = Number(value || 0);
    if (!promo || sales <= 0) {
      setCreditAmount('');
      return;
    }
    setCreditAmount(String((sales * Number(promo.promo_discount_percent || 10) / 100).toFixed(2)));
  }

  async function issuePromoCredit() {
    if (!creditPromo) return;
    setIssuingCredit(true);
    try {
      const response = await fetch(`/api/admin/private-launch-promos/${creditPromo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'issue_credit',
          posSalesAmount: Number(posSalesAmount || 0),
          creditAmount: Number(creditAmount || 0),
          notes: creditNotes,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Unable to issue promo credit.');
      setNotice({ type: 'success', message: 'Promo credit issued and POS summary marked received.' });
      setCreditPromo(null);
      loadPromos();
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to issue promo credit.' });
    } finally {
      setIssuingCredit(false);
    }
  }

  return (
    <div className="space-y-6">
      {creditPromo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Issue promo credit</h2>
                <p className="mt-1 text-sm text-gray-600">
                  {creditPromo.retailer?.company_name || 'Retailer'} · {formatDate(creditPromo.start_date)} - {formatDate(creditPromo.end_date)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreditPromo(null)}
                disabled={issuingCredit}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
                aria-label="Close credit modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">POS sales from promo range</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={posSalesAmount}
                  onChange={(event) => updatePosSalesAmount(event.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-bark-500 focus:outline-none focus:ring-2 focus:ring-bark-500/10"
                  placeholder="0.00"
                />
                <p className="mt-1 text-xs text-gray-500">Enter the Bare POS sales total from the retailer summary.</p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Credit to issue</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={creditAmount}
                  onChange={(event) => setCreditAmount(event.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-bark-500 focus:outline-none focus:ring-2 focus:ring-bark-500/10"
                  placeholder="0.00"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Defaults to {creditPromo.promo_discount_percent}% of POS sales. You can adjust it before issuing.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Internal note</label>
                <textarea
                  value={creditNotes}
                  onChange={(event) => setCreditNotes(event.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-bark-500 focus:outline-none focus:ring-2 focus:ring-bark-500/10"
                  placeholder="Optional note about the POS summary"
                />
              </div>

              <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">
                This creates an account credit for future orders and marks the private promo completed.
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={issuePromoCredit}
                disabled={issuingCredit || Number(posSalesAmount || 0) <= 0 || Number(creditAmount || 0) <= 0}
                className="rounded-lg bg-bark-500 px-4 py-2 text-sm font-semibold text-white hover:bg-bark-600 disabled:opacity-50"
              >
                {issuingCredit ? 'Issuing...' : `Issue ${formatCurrency(Number(creditAmount || 0))} Credit`}
              </button>
              <button
                type="button"
                onClick={() => setCreditPromo(null)}
                disabled={issuingCredit}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-cream-200 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-bark-500" style={{ fontFamily: 'var(--font-poppins)' }}>
              Private Launch Promos
            </h1>
            <p className="mt-1 text-sm text-bark-500/60">
              Automated promo scheduling, lifecycle emails, and POS summary follow-up.
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadPromos()}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-bark-500/20 bg-white px-4 py-2 text-sm font-semibold text-bark-500 hover:bg-cream-100 disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {notice && (
        <div className={cn(
          'rounded-xl border px-4 py-3 text-sm font-semibold',
          notice.type === 'success'
            ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
            : 'border-red-100 bg-red-50 text-red-700',
        )}>
          {notice.message}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Calendar} label="Scheduled" value={stats.scheduled} />
        <StatCard icon={Clock} label="Active Now" value={stats.active} />
        <StatCard icon={Mail} label="Need Dates" value={stats.needsDates} />
        <StatCard icon={CheckCircle2} label="Awaiting POS" value={stats.awaitingSummary} />
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="font-semibold text-gray-900">Promo Pipeline</h2>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-500">Loading private promos...</div>
        ) : promos.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">No private launch promos yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-3">Retailer</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Dates</th>
                  <th className="px-5 py-3">Source</th>
                  <th className="px-5 py-3">Last email</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {promos.map((promo) => (
                  <tr key={promo.id} className="align-top">
                    <td className="px-5 py-4">
                      <Link href={`/admin/retailers/${promo.retailer_id}`} className="font-semibold text-bark-500 hover:underline">
                        {promo.retailer?.company_name || 'Unknown retailer'}
                      </Link>
                      <p className="mt-1 text-xs text-gray-500">{promo.retailer?.account_number || 'No account number'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold', statusClass(promo.computed_status))}>
                        {statusLabels[promo.computed_status] || promo.computed_status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-700">
                      <p>{formatDate(promo.start_date)} - {formatDate(promo.end_date)}</p>
                      <p className="mt-1 text-xs text-gray-500">{promo.duration_weeks} weeks at {promo.promo_discount_percent}% off</p>
                    </td>
                    <td className="px-5 py-4 text-gray-700">{sourceLabels[promo.source] || promo.source}</td>
                    <td className="px-5 py-4 text-gray-700">
                      <p>{promo.last_email_stage ? statusLabels[promo.last_email_stage] || promo.last_email_stage.replaceAll('_', ' ') : 'None yet'}</p>
                      <p className="mt-1 text-xs text-gray-500">{promo.last_reminder_sent_at ? formatDate(promo.last_reminder_sent_at) : ''}</p>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {promo.computed_status === 'awaiting_sales_summary' ? (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openIssueCredit(promo)}
                            disabled={Boolean(promo.credit_id)}
                            className="rounded-lg bg-bark-500 px-3 py-2 text-xs font-semibold text-white hover:bg-bark-600 disabled:opacity-50"
                          >
                            {promo.credit_id ? 'Credit Issued' : 'Issue Credit'}
                          </button>
                          {!promo.credit_id && (
                            <button
                              type="button"
                              onClick={() => markSummaryReceived(promo.id)}
                              className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                            >
                              No Credit
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500">
                          {promo.credit_id ? `Credit ${formatCurrency(Number(promo.credit_amount || 0))}` : 'No action'}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cream-100 text-bark-500">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}
