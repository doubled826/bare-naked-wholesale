'use client';

import { useEffect, useMemo, useState } from 'react';
import { format, formatDistanceToNowStrict } from 'date-fns';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ClipboardList,
  ChevronsUpDown,
  ExternalLink,
  Link2,
  RefreshCw,
  Search,
  StickyNote,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type RetailerOption = {
  id: string;
  company_name: string;
  business_address: string;
  account_number: string;
};

type DealSearchResult = {
  id: number;
  title: string;
};

type ChecklistItem = {
  id: string;
  label: string;
  note: string;
  talkingPoint: string;
  agreementPlaceholder: string;
  checked: boolean;
  agreement: string;
  completedAt?: string | null;
};

type ChecklistSection = {
  title: string;
  items: ChecklistItem[];
};

type OnboardingRecord = {
  id: string;
  retailer_id: string;
  retailer?: RetailerOption | null;
  pipedrive_deal_id: number | null;
  pipedrive_stage_name?: string | null;
  first_order_received_at?: string | null;
  second_order_received_at?: string | null;
  third_order_received_at?: string | null;
  next_follow_up_at?: string | null;
  follow_up_status?: 'upcoming' | 'due' | 'overdue' | 'complete' | 'needs_link';
  owner_name?: string | null;
  linked_deal?: {
    id: number;
    title: string;
    stageName: string;
    ownerName: string | null;
    orgName: string | null;
  } | null;
  checklist_sections: ChecklistSection[];
  agreement_snapshot: string[];
  checklist_progress: {
    completed: number;
    total: number;
    percent: number;
  };
  is_active_onboarding: boolean;
  notes: {
    id: string;
    body: string;
    source: string;
    pipedrive_note_id?: number | null;
    created_by?: string | null;
    created_at: string;
  }[];
};

const STAGE_FILTERS = ['all', 'First Order Received', 'Second Order Received', 'Third Order Received'] as const;
const FOLLOW_UP_FILTERS = ['all', 'upcoming', 'due', 'overdue', 'complete'] as const;
const VIEW_FILTERS = ['active', 'completed', 'all'] as const;

function formatDate(value?: string | null) {
  if (!value) return 'Not set';
  try {
    return format(new Date(value), 'MMM d, yyyy');
  } catch {
    return 'Not set';
  }
}

function toDateInput(value?: string | null) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

function daysSince(value?: string | null) {
  if (!value) return 'Unknown';
  try {
    return formatDistanceToNowStrict(new Date(value), { addSuffix: false });
  } catch {
    return 'Unknown';
  }
}

function statusBadge(status?: OnboardingRecord['follow_up_status']) {
  switch (status) {
    case 'overdue':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'due':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'complete':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'needs_link':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    default:
      return 'bg-blue-100 text-blue-700 border-blue-200';
  }
}

export default function OnboardingHealthPage() {
  const [records, setRecords] = useState<OnboardingRecord[]>([]);
  const [availableRetailers, setAvailableRetailers] = useState<RetailerOption[]>([]);
  const [portalRetailers, setPortalRetailers] = useState<RetailerOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState('');

  const [stageFilter, setStageFilter] = useState<(typeof STAGE_FILTERS)[number]>('all');
  const [followUpFilter, setFollowUpFilter] = useState<(typeof FOLLOW_UP_FILTERS)[number]>('all');
  const [viewFilter, setViewFilter] = useState<(typeof VIEW_FILTERS)[number]>('active');
  const [ownerFilter, setOwnerFilter] = useState('all');

  const [selectedRetailerId, setSelectedRetailerId] = useState('');
  const [retailerQuery, setRetailerQuery] = useState('');
  const [retailerPickerOpen, setRetailerPickerOpen] = useState(false);
  const [dealQuery, setDealQuery] = useState('');
  const [dealResults, setDealResults] = useState<DealSearchResult[]>([]);
  const [searchingDeals, setSearchingDeals] = useState(false);
  const [linking, setLinking] = useState(false);

  const [savingMeta, setSavingMeta] = useState(false);
  const [savingChecklistId, setSavingChecklistId] = useState<string | null>(null);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  async function fetchData(initial = false) {
    try {
      if (initial) setIsLoading(true);
      else setRefreshing(true);

      const response = await fetch('/api/admin/onboarding-health');
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to load onboarding health.');
      }

      const nextRecords = (payload.onboarding || []) as OnboardingRecord[];
      setRecords(nextRecords);
      setAvailableRetailers(payload.availableRetailers || []);
      setPortalRetailers(payload.portalRetailers || []);

      setSelectedId((current) => {
        if (current && nextRecords.some((record) => record.id === current)) {
          return current;
        }
        return nextRecords[0]?.id || null;
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to load onboarding health.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchData(true);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const owners = useMemo(() => {
    return Array.from(new Set(records.map((record) => record.owner_name).filter(Boolean) as string[])).sort();
  }, [records]);

  const retailerOptions = useMemo(() => {
    const query = retailerQuery.trim().toLowerCase();
    const source = portalRetailers.length > 0 ? portalRetailers : availableRetailers;

    return source
      .filter((retailer) => {
        if (!query) return true;
        return (
          retailer.company_name?.toLowerCase().includes(query) ||
          retailer.account_number?.toLowerCase().includes(query) ||
          retailer.business_address?.toLowerCase().includes(query)
        );
      })
      .slice(0, 25);
  }, [portalRetailers, availableRetailers, retailerQuery]);

  const selectedRetailer = useMemo(
    () => portalRetailers.find((retailer) => retailer.id === selectedRetailerId) || availableRetailers.find((retailer) => retailer.id === selectedRetailerId) || null,
    [portalRetailers, availableRetailers, selectedRetailerId]
  );

  const filteredRecords = useMemo(() => {
    const next = [...records].filter((record) => {
      if (stageFilter !== 'all' && record.pipedrive_stage_name !== stageFilter) return false;
      if (followUpFilter !== 'all' && record.follow_up_status !== followUpFilter) return false;
      if (ownerFilter !== 'all' && (record.owner_name || 'Unassigned') !== ownerFilter) return false;
      if (viewFilter === 'active' && record.pipedrive_stage_name === 'Third Order Received') return false;
      if (viewFilter === 'completed' && record.pipedrive_stage_name !== 'Third Order Received') return false;
      return true;
    });

    return next.sort((a, b) => {
      const aScore = a.follow_up_status === 'overdue' ? 0 : a.follow_up_status === 'due' ? 1 : a.follow_up_status === 'complete' ? 3 : 2;
      const bScore = b.follow_up_status === 'overdue' ? 0 : b.follow_up_status === 'due' ? 1 : b.follow_up_status === 'complete' ? 3 : 2;
      if (aScore !== bScore) return aScore - bScore;
      return new Date(b.first_order_received_at || 0).getTime() - new Date(a.first_order_received_at || 0).getTime();
    });
  }, [records, stageFilter, followUpFilter, ownerFilter, viewFilter]);

  const selectedRecord = useMemo(
    () => filteredRecords.find((record) => record.id === selectedId) || records.find((record) => record.id === selectedId) || null,
    [filteredRecords, records, selectedId]
  );

  const stats = useMemo(() => {
    const active = records.filter((record) => record.pipedrive_stage_name !== 'Third Order Received').length;
    const dueToday = records.filter((record) => record.follow_up_status === 'due').length;
    const overdue = records.filter((record) => record.follow_up_status === 'overdue').length;
    const completed = records.filter((record) => record.pipedrive_stage_name === 'Third Order Received').length;
    return { active, dueToday, overdue, completed };
  }, [records]);

  async function runDealSearch() {
    if (!dealQuery.trim()) return;
    setSearchingDeals(true);
    try {
      const response = await fetch(`/api/admin/pipedrive/deals/search?term=${encodeURIComponent(dealQuery.trim())}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Unable to search deals.');
      setDealResults(payload.deals || []);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to search deals.');
      setDealResults([]);
    } finally {
      setSearchingDeals(false);
    }
  }

  async function linkRetailer(dealId: number) {
    if (!selectedRetailerId) {
      setNotice('Choose a retailer from the portal first.');
      return;
    }

    setLinking(true);
    try {
      const response = await fetch('/api/admin/onboarding-health/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retailerId: selectedRetailerId, dealId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Unable to link retailer.');

      setDealQuery('');
      setDealResults([]);
      setSelectedRetailerId('');
      setRetailerQuery('');
      setRetailerPickerOpen(false);
      setNotice('Retailer linked to Pipedrive and added to onboarding.');
      await fetchData();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to link retailer.');
    } finally {
      setLinking(false);
    }
  }

  function updateRecordState(recordId: string, updater: (record: OnboardingRecord) => OnboardingRecord) {
    setRecords((current) => current.map((record) => (record.id === recordId ? updater(record) : record)));
  }

  async function saveMetaUpdates() {
    if (!selectedRecord) return;
    setSavingMeta(true);
    try {
      const response = await fetch(`/api/admin/onboarding-health/${selectedRecord.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_order_received_at: selectedRecord.first_order_received_at ? new Date(selectedRecord.first_order_received_at).toISOString() : null,
          next_follow_up_at: selectedRecord.next_follow_up_at ? new Date(selectedRecord.next_follow_up_at).toISOString() : null,
          owner_name: selectedRecord.owner_name || null,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Unable to save onboarding details.');
      setNotice('Onboarding dates saved.');
      await fetchData();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to save onboarding details.');
    } finally {
      setSavingMeta(false);
    }
  }

  async function saveChecklistItem(itemId: string, completed: boolean, agreedValue: string) {
    if (!selectedRecord) return;
    setSavingChecklistId(itemId);
    try {
      const response = await fetch(`/api/admin/onboarding-health/${selectedRecord.id}/checklist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, completed, agreedValue }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Unable to update checklist item.');
      await fetchData();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to update checklist item.');
    } finally {
      setSavingChecklistId(null);
    }
  }

  async function addNote() {
    if (!selectedRecord || !newNote.trim()) return;
    setSavingNote(true);
    try {
      const response = await fetch(`/api/admin/onboarding-health/${selectedRecord.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: newNote.trim() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Unable to save note.');
      setNewNote('');
      setNotice('Note saved and synced to Pipedrive.');
      await fetchData();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to save note.');
    } finally {
      setSavingNote(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-bark-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {notice && (
        <div className="fixed top-20 right-6 z-50 bg-white border border-gray-200 rounded-xl p-4 shadow-lg flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span className="text-gray-900 font-medium">{notice}</span>
        </div>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="page-title">Onboarding Health</h1>
          <p className="text-bark-500/60 text-sm mt-1">
            Track launch readiness from first order to third order with checklist progress, agreements, and follow-up timing.
          </p>
        </div>
        <button onClick={() => fetchData()} className="btn-secondary text-sm gap-2" disabled={refreshing}>
          <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Active onboarding', value: stats.active, tone: 'bg-blue-100 text-blue-700' },
          { label: 'Due today', value: stats.dueToday, tone: 'bg-amber-100 text-amber-700' },
          { label: 'Overdue', value: stats.overdue, tone: 'bg-red-100 text-red-700' },
          { label: 'Completed to third order', value: stats.completed, tone: 'bg-emerald-100 text-emerald-700' },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-4', card.tone)}>
              <ClipboardList className="w-5 h-5" />
            </div>
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-bark-500" />
          <h2 className="text-base font-semibold text-gray-900">Link a portal retailer to a Pipedrive deal</h2>
        </div>
        <p className="text-sm text-gray-500">
          Use this once per retailer. Only link deals already in First, Second, or Third Order Received.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)] gap-3">
          <div className="relative">
            <button
              onClick={() => setRetailerPickerOpen((open) => !open)}
              className="input text-sm py-2 flex items-center justify-between text-left"
              type="button"
            >
              <span className={selectedRetailer ? 'text-bark-500' : 'text-bone-400'}>
                {selectedRetailer ? `${selectedRetailer.company_name} (${selectedRetailer.account_number})` : 'Choose a portal retailer…'}
              </span>
              <ChevronsUpDown className="w-4 h-4 text-gray-400" />
            </button>
            {retailerPickerOpen && (
              <div className="absolute z-20 mt-2 w-full rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden">
                <div className="p-3 border-b border-gray-100">
                  <input
                    value={retailerQuery}
                    onChange={(event) => setRetailerQuery(event.target.value)}
                    placeholder="Search portal retailers…"
                    className="input text-sm py-2"
                    autoFocus
                  />
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {retailerOptions.length === 0 ? (
                    <div className="px-4 py-4 text-sm text-gray-500">
                      {portalRetailers.length === 0 && availableRetailers.length === 0
                        ? 'No portal retailers were returned by the API.'
                        : 'No retailers match that search.'}
                    </div>
                  ) : (
                    retailerOptions.map((retailer) => (
                      <button
                        key={retailer.id}
                        type="button"
                        onClick={() => {
                          setSelectedRetailerId(retailer.id);
                          setRetailerPickerOpen(false);
                          setRetailerQuery('');
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                      >
                        <p className="text-sm font-medium text-gray-900">{retailer.company_name}</p>
                        <p className="text-xs text-gray-500">{retailer.account_number} • {retailer.business_address}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={dealQuery}
                onChange={(event) => setDealQuery(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && runDealSearch()}
                placeholder="Search Pipedrive deal by retailer name…"
                className="input text-sm py-2 pl-10"
              />
            </div>
            <button onClick={runDealSearch} className="btn-primary text-sm px-4 py-2" disabled={searchingDeals}>
              {searchingDeals ? 'Searching…' : 'Search'}
            </button>
          </div>
        </div>
        {dealResults.length > 0 && (
          <div className="space-y-2">
            {dealResults.map((deal) => (
              <div key={deal.id} className="flex flex-col gap-2 rounded-xl border border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{deal.title}</p>
                  <p className="text-xs text-gray-500">Pipedrive deal #{deal.id}</p>
                </div>
                <button onClick={() => linkRetailer(deal.id)} className="btn-secondary text-sm px-4 py-2" disabled={linking}>
                  {linking ? 'Linking…' : 'Link to retailer'}
                </button>
              </div>
            ))}
          </div>
        )}
        {portalRetailers.length > 0 && availableRetailers.length === 0 && (
          <p className="text-xs text-gray-500">
            All current portal retailers are already linked in onboarding. You can still pick any retailer above to relink or correct a mapping.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] gap-6">
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value as (typeof STAGE_FILTERS)[number])} className="input text-sm py-2">
                {STAGE_FILTERS.map((option) => (
                  <option key={option} value={option}>
                    {option === 'all' ? 'All stages' : option}
                  </option>
                ))}
              </select>
              <select value={followUpFilter} onChange={(event) => setFollowUpFilter(event.target.value as (typeof FOLLOW_UP_FILTERS)[number])} className="input text-sm py-2">
                {FOLLOW_UP_FILTERS.map((option) => (
                  <option key={option} value={option}>
                    {option === 'all' ? 'All follow-up states' : option}
                  </option>
                ))}
              </select>
              <select value={viewFilter} onChange={(event) => setViewFilter(event.target.value as (typeof VIEW_FILTERS)[number])} className="input text-sm py-2">
                {VIEW_FILTERS.map((option) => (
                  <option key={option} value={option}>
                    {option === 'active' ? 'Active only' : option === 'completed' ? 'Completed only' : 'All onboarding'}
                  </option>
                ))}
              </select>
              <select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)} className="input text-sm py-2">
                <option value="all">All owners</option>
                {owners.map((owner) => (
                  <option key={owner} value={owner}>
                    {owner}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Tracked stores</h2>
                <p className="text-sm text-gray-500">{filteredRecords.length} store{filteredRecords.length === 1 ? '' : 's'} in view</p>
              </div>
            </div>

            <div className="divide-y divide-gray-100">
              {filteredRecords.length === 0 ? (
                <div className="px-6 py-14 text-center text-gray-500">
                  <AlertCircle className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p>No stores match these filters yet.</p>
                </div>
              ) : (
                filteredRecords.map((record) => (
                  <button
                    key={record.id}
                    onClick={() => setSelectedId(record.id)}
                    className={cn(
                      'w-full text-left px-5 py-4 transition-colors hover:bg-gray-50',
                      selectedId === record.id && 'bg-cream-100'
                    )}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900">{record.retailer?.company_name || 'Unknown retailer'}</p>
                          <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold', statusBadge(record.follow_up_status))}>
                            {record.follow_up_status || 'upcoming'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">{record.pipedrive_stage_name || 'Not linked'}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                          <span>First order: {record.first_order_received_at ? daysSince(record.first_order_received_at) : 'Not set'}</span>
                          <span>Next follow-up: {formatDate(record.next_follow_up_at)}</span>
                          <span>Owner: {record.owner_name || 'Unassigned'}</span>
                        </div>
                      </div>
                      <div className="lg:text-right">
                        <p className="text-sm font-semibold text-bark-500">{record.checklist_progress.percent}% complete</p>
                        <p className="text-xs text-gray-500">
                          {record.checklist_progress.completed} / {record.checklist_progress.total} checklist items
                        </p>
                        {record.agreement_snapshot.length > 0 && (
                          <p className="text-xs text-gray-500 mt-2 max-w-sm lg:ml-auto">
                            {record.agreement_snapshot.join(' • ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm min-h-[520px]">
          {!selectedRecord ? (
            <div className="h-full flex items-center justify-center text-center px-6 py-16 text-gray-500">
              <div>
                <StickyNote className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                <p>Select a store to review its onboarding detail.</p>
              </div>
            </div>
          ) : (
            <div className="p-5 space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{selectedRecord.retailer?.company_name}</h2>
                  <p className="text-sm text-gray-500 mt-1">{selectedRecord.linked_deal?.title || 'Linked deal unavailable'}</p>
                </div>
                <span className={cn('inline-flex items-center px-3 py-1 rounded-full border text-xs font-semibold', statusBadge(selectedRecord.follow_up_status))}>
                  {selectedRecord.follow_up_status}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">First order received</label>
                  <input
                    type="date"
                    value={toDateInput(selectedRecord.first_order_received_at)}
                    onChange={(event) =>
                      updateRecordState(selectedRecord.id, (record) => ({
                        ...record,
                        first_order_received_at: event.target.value ? new Date(`${event.target.value}T12:00:00`).toISOString() : null,
                      }))
                    }
                    className="input text-sm py-2"
                  />
                </div>
                <div>
                  <label className="label">Next follow-up</label>
                  <input
                    type="date"
                    value={toDateInput(selectedRecord.next_follow_up_at)}
                    onChange={(event) =>
                      updateRecordState(selectedRecord.id, (record) => ({
                        ...record,
                        next_follow_up_at: event.target.value ? new Date(`${event.target.value}T12:00:00`).toISOString() : null,
                      }))
                    }
                    className="input text-sm py-2"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Owner / rep</label>
                  <input
                    value={selectedRecord.owner_name || ''}
                    onChange={(event) =>
                      updateRecordState(selectedRecord.id, (record) => ({
                        ...record,
                        owner_name: event.target.value,
                      }))
                    }
                    className="input text-sm py-2"
                    placeholder="Account owner"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-cream-100 border border-cream-200 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-bark-500">Checklist progress</p>
                  <p className="text-xs text-bark-500/60">
                    {selectedRecord.checklist_progress.completed} of {selectedRecord.checklist_progress.total} complete
                  </p>
                </div>
                <button onClick={saveMetaUpdates} className="btn-primary text-sm px-4 py-2" disabled={savingMeta}>
                  {savingMeta ? 'Saving…' : 'Save dates'}
                </button>
              </div>

              <div className="rounded-xl border border-gray-200 p-4 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Linked Pipedrive deal</p>
                    <p className="text-xs text-gray-500">{selectedRecord.pipedrive_stage_name || 'No stage snapshot yet'}</p>
                  </div>
                  {selectedRecord.linked_deal && (
                    <a
                      href={`https://app.pipedrive.com/deal/${selectedRecord.linked_deal.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-ghost text-sm gap-1"
                    >
                      Open
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
                  <p>Stage: <span className="font-medium text-gray-900">{selectedRecord.linked_deal?.stageName || selectedRecord.pipedrive_stage_name || 'Unknown'}</span></p>
                  <p>Owner: <span className="font-medium text-gray-900">{selectedRecord.linked_deal?.ownerName || selectedRecord.owner_name || 'Unassigned'}</span></p>
                  <p>Days since first order: <span className="font-medium text-gray-900">{daysSince(selectedRecord.first_order_received_at)}</span></p>
                  <p>Next follow-up: <span className="font-medium text-gray-900">{formatDate(selectedRecord.next_follow_up_at)}</span></p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Checklist</h3>
                  <p className="text-sm text-gray-500">Capture what was agreed so anyone on the team can pick up the account cleanly.</p>
                </div>
                {selectedRecord.checklist_sections.map((section) => (
                  <div key={section.title} className="rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                      <p className="text-sm font-semibold text-gray-900">{section.title}</p>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {section.items.map((item) => (
                        <div key={item.id} className="p-4 space-y-3">
                          <div className="flex items-start gap-3">
                            <button
                              onClick={() => {
                                updateRecordState(selectedRecord.id, (record) => ({
                                  ...record,
                                  checklist_sections: record.checklist_sections.map((recordSection) =>
                                    recordSection.title !== section.title
                                      ? recordSection
                                      : {
                                          ...recordSection,
                                          items: recordSection.items.map((recordItem) =>
                                            recordItem.id === item.id
                                              ? { ...recordItem, checked: !recordItem.checked }
                                              : recordItem
                                          ),
                                        }
                                  ),
                                }));
                                saveChecklistItem(item.id, !item.checked, item.agreement);
                              }}
                              className={cn(
                                'mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center',
                                item.checked ? 'bg-bark-500 border-bark-500' : 'bg-white border-gray-300'
                              )}
                              disabled={savingChecklistId === item.id}
                            >
                              {item.checked && <Check className="w-3 h-3 text-white" />}
                            </button>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">{item.label}</p>
                              <p className="text-xs text-gray-500 mt-1">{item.note}</p>
                            </div>
                          </div>
                          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Suggested talking point</p>
                            <p className="text-sm text-gray-700 italic">{item.talkingPoint}</p>
                          </div>
                          <div>
                            <label className="label">What did we agree to?</label>
                            <textarea
                              value={item.agreement}
                              onChange={(event) =>
                                updateRecordState(selectedRecord.id, (record) => ({
                                  ...record,
                                  checklist_sections: record.checklist_sections.map((recordSection) =>
                                    recordSection.title !== section.title
                                      ? recordSection
                                      : {
                                          ...recordSection,
                                          items: recordSection.items.map((recordItem) =>
                                            recordItem.id === item.id
                                              ? { ...recordItem, agreement: event.target.value }
                                              : recordItem
                                          ),
                                        }
                                  ),
                                }))
                              }
                              onBlur={(event) => saveChecklistItem(item.id, item.checked, event.target.value)}
                              rows={2}
                              className="input text-sm"
                              placeholder={item.agreementPlaceholder}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Notes</h3>
                  <p className="text-sm text-gray-500">Portal notes sync to the linked Pipedrive deal so the CRM stays current too.</p>
                </div>
                <textarea
                  value={newNote}
                  onChange={(event) => setNewNote(event.target.value)}
                  rows={3}
                  className="input text-sm"
                  placeholder="Add launch notes, risks, wins, or follow-up context…"
                />
                <button onClick={addNote} className="btn-primary text-sm px-4 py-2" disabled={savingNote || !newNote.trim()}>
                  {savingNote ? 'Saving…' : 'Save note + sync to Pipedrive'}
                </button>
                <div className="space-y-3">
                  {selectedRecord.notes.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500">
                      No onboarding notes yet.
                    </div>
                  ) : (
                    selectedRecord.notes
                      .slice()
                      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                      .map((note) => (
                        <div key={note.id} className="rounded-xl border border-gray-200 p-4">
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                              {note.source === 'portal' ? 'Portal note' : note.source}
                            </p>
                            <p className="text-xs text-gray-500">{formatDate(note.created_at)}</p>
                          </div>
                          <p className="text-sm text-gray-800 whitespace-pre-wrap">{note.body}</p>
                          <p className="text-xs text-gray-500 mt-2">
                            {note.created_by || 'Admin'}
                            {note.pipedrive_note_id ? ` • synced to Pipedrive #${note.pipedrive_note_id}` : ''}
                          </p>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
