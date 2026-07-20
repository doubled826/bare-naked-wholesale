'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle, Edit2, ExternalLink, Gift, Loader2, Megaphone, Package, Plus, Ruler, Save, Sparkles, Trash2, X } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  DEFAULT_ASTRO_URL,
  defaultCurrentAstroPromo,
  type CurrentAstroPromo,
} from '@/lib/retailerSuccess';
import { cn } from '@/lib/utils';

type PromoForm = {
  promo_visible: boolean;
  promo_name: string;
  promo_description: string;
  promo_start_date: string;
  promo_end_date: string;
  astro_promo_url: string;
};

type AnnouncementTab = 'dashboard-announcements' | 'dashboard-promos' | 'popup-previews';
type PreviewPopup = 'shelf-talkers' | 'welcome-offer' | null;

type DashboardAnnouncement = {
  id: string;
  title: string;
  message: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string | null;
};

const emptyAnnouncementForm = {
  title: '',
  message: '',
  is_active: true,
};

const shelfTalkerAnnouncementDraft = {
  title: 'New shelf talkers for trail mix toppers',
  message:
    'Stores carrying both 6 oz and 12 oz of Chicken, Salmon, or Beef will automatically receive the matching shelf talker with their next order.',
  is_active: true,
};

function DashboardAnnouncementsManager() {
  const supabase = createClientComponentClient();
  const [announcements, setAnnouncements] = useState<DashboardAnnouncement[]>([]);
  const [form, setForm] = useState(emptyAnnouncementForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadAnnouncements = async () => {
    setIsLoading(true);
    setNotice('');
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('id, title, message, is_active, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAnnouncements((data || []) as DashboardAnnouncement[]);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to load announcements.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const resetForm = () => {
    setForm(emptyAnnouncementForm);
    setEditingId(null);
  };

  const saveAnnouncement = async () => {
    const title = form.title.trim();
    const message = form.message.trim();

    if (!title || !message) {
      setNotice('Title and message are required.');
      return;
    }

    setIsSaving(true);
    setNotice('');
    try {
      const payload = {
        title,
        message,
        is_active: form.is_active,
        updated_at: new Date().toISOString(),
      };

      const { error } = editingId
        ? await supabase.from('announcements').update(payload).eq('id', editingId)
        : await supabase.from('announcements').insert(payload);

      if (error) throw error;

      setNotice(editingId ? 'Announcement updated.' : 'Announcement created.');
      resetForm();
      await loadAnnouncements();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to save announcement.');
    } finally {
      setIsSaving(false);
    }
  };

  const editAnnouncement = (announcement: DashboardAnnouncement) => {
    setEditingId(announcement.id);
    setForm({
      title: announcement.title,
      message: announcement.message,
      is_active: announcement.is_active,
    });
    setNotice('');
  };

  const toggleAnnouncement = async (announcement: DashboardAnnouncement) => {
    setNotice('');
    try {
      const { error } = await supabase
        .from('announcements')
        .update({
          is_active: !announcement.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', announcement.id);

      if (error) throw error;
      await loadAnnouncements();
      setNotice(!announcement.is_active ? 'Announcement published.' : 'Announcement hidden.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to update announcement.');
    }
  };

  const deleteAnnouncement = async (announcement: DashboardAnnouncement) => {
    const confirmed = window.confirm(`Delete "${announcement.title}"?`);
    if (!confirmed) return;

    setDeletingId(announcement.id);
    setNotice('');
    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', announcement.id);

      if (error) throw error;
      if (editingId === announcement.id) resetForm();
      await loadAnnouncements();
      setNotice('Announcement deleted.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to delete announcement.');
    } finally {
      setDeletingId(null);
    }
  };

  const activeCount = announcements.filter((announcement) => announcement.is_active).length;

  return (
    <section className="bg-cream-100 rounded-2xl border border-cream-200 p-5 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-bark-100 text-bark-700 flex items-center justify-center flex-shrink-0">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="section-title">Dashboard Announcements</h2>
              <span className="badge bg-emerald-100 text-emerald-700">{activeCount} active</span>
            </div>
            <p className="text-sm text-bark-500/60 mt-1">
              Create friendly notes that appear on retailer dashboards.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setForm(shelfTalkerAnnouncementDraft);
            setEditingId(null);
            setNotice('');
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm font-semibold text-bark-500 hover:bg-cream-50"
        >
          <Sparkles className="w-4 h-4" />
          Use shelf talker draft
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-5">
        <div className="space-y-4">
          <div className="rounded-xl border border-cream-200 bg-white p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-bark-500">{editingId ? 'Edit Announcement' : 'New Announcement'}</h3>
              {editingId && (
                <button type="button" onClick={resetForm} className="text-sm font-semibold text-bark-500/60 hover:text-bark-500">
                  Cancel edit
                </button>
              )}
            </div>
            <div>
              <label className="label" htmlFor="announcement-title">Title</label>
              <input
                id="announcement-title"
                type="text"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="New shelf talkers are here"
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="announcement-message">Message</label>
              <textarea
                id="announcement-message"
                value={form.message}
                onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
                placeholder="Keep it short, useful, and retailer-facing."
                className="input min-h-[120px]"
                rows={5}
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-bark-500">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
                className="rounded border-cream-300 text-bark-500 focus:ring-bark-500"
              />
              Publish on retailer dashboards
            </label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={saveAnnouncement}
                disabled={isSaving}
                className="btn-primary text-sm px-4 py-2 flex items-center gap-2"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {isSaving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Announcement'}
              </button>
              {notice && <p className="text-sm text-bark-500/60">{notice}</p>}
            </div>
          </div>

          <div className="rounded-xl border border-cream-200 bg-white p-4">
            <h3 className="font-semibold text-bark-500">Existing Announcements</h3>
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-bark-500" />
              </div>
            ) : announcements.length === 0 ? (
              <p className="py-8 text-center text-sm text-bark-500/60">No announcements yet.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {announcements.map((announcement) => (
                  <div key={announcement.id} className="rounded-xl border border-cream-200 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-bark-500">{announcement.title}</p>
                          <span className={cn('badge', announcement.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-bone-100 text-bone-600')}>
                            {announcement.is_active ? 'Active' : 'Hidden'}
                          </span>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-bark-500/65">{announcement.message}</p>
                        <p className="mt-2 text-xs text-bark-500/45">
                          Created {new Date(announcement.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => toggleAnnouncement(announcement)}
                          className="rounded-lg border border-cream-300 px-3 py-1.5 text-sm font-semibold text-bark-500 hover:bg-cream-100"
                        >
                          {announcement.is_active ? 'Hide' : 'Publish'}
                        </button>
                        <button
                          type="button"
                          onClick={() => editAnnouncement(announcement)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 px-3 py-1.5 text-sm font-semibold text-bark-500 hover:bg-cream-100"
                        >
                          <Edit2 className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteAnnouncement(announcement)}
                          disabled={deletingId === announcement.id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-100 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          {deletingId === announcement.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-cream-200 p-4 self-start">
          <p className="text-xs font-semibold uppercase tracking-wide text-bark-500/50">Retailer dashboard preview</p>
          <div className="mt-3 rounded-xl bg-cream-200 p-4">
            <p className="font-semibold text-bark-500">{form.title || 'Announcement title'}</p>
            <p className="text-sm text-bark-500/70 mt-1">
              {form.message || 'Your announcement message will appear here.'}
            </p>
            <p className="text-xs text-bark-500/50 mt-2">{new Date().toLocaleDateString()}</p>
          </div>
          <p className="mt-3 text-xs leading-5 text-bark-500/55">
            This matches the simple card retailers see in the dashboard Announcements section.
          </p>
        </div>
      </div>
    </section>
  );
}

function AstroPromoManager() {
  const [currentPromo, setCurrentPromo] = useState<CurrentAstroPromo>(defaultCurrentAstroPromo);
  const [promoForm, setPromoForm] = useState<PromoForm>({
    promo_visible: false,
    promo_name: '',
    promo_description: '',
    promo_start_date: '',
    promo_end_date: '',
    astro_promo_url: DEFAULT_ASTRO_URL,
  });
  const [notice, setNotice] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadPromo() {
      setIsLoading(true);
      setNotice('');
      try {
        const response = await fetch('/api/admin/retailer-success/promo');
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || 'Failed to load current promo.');
        }
        if (!isMounted) return;
        const promo = data.currentPromo || defaultCurrentAstroPromo;
        setCurrentPromo(promo);
        setPromoForm({
          promo_visible: promo.promoVisible,
          promo_name: promo.promoName,
          promo_description: promo.promoDescription,
          promo_start_date: promo.promoStartDate || '',
          promo_end_date: promo.promoEndDate || '',
          astro_promo_url: promo.astroPromoUrl || DEFAULT_ASTRO_URL,
        });
      } catch (error) {
        if (isMounted) {
          setNotice(error instanceof Error ? error.message : 'Failed to load current promo.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadPromo();

    return () => {
      isMounted = false;
    };
  }, []);

  const savePromo = async () => {
    setIsSaving(true);
    setNotice('');
    try {
      const response = await fetch('/api/admin/retailer-success/promo', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...promoForm,
          astro_promo_url: promoForm.astro_promo_url || DEFAULT_ASTRO_URL,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to save current promo.');
      }
      const promo = data.currentPromo || defaultCurrentAstroPromo;
      setCurrentPromo(promo);
      setPromoForm({
        promo_visible: promo.promoVisible,
        promo_name: promo.promoName,
        promo_description: promo.promoDescription,
        promo_start_date: promo.promoStartDate || '',
        promo_end_date: promo.promoEndDate || '',
        astro_promo_url: promo.astroPromoUrl || DEFAULT_ASTRO_URL,
      });
      setNotice('Current Astro promo saved.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Failed to save current promo.');
    } finally {
      setIsSaving(false);
    }
  };

  const statusLabel = promoForm.promo_visible ? 'Active on retailer dashboards' : 'Inactive';

  return (
    <section className="bg-cream-100 rounded-2xl border border-cream-200 p-5 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="section-title">Astro Seasonal Promo</h2>
              <span className={cn('badge', promoForm.promo_visible ? 'bg-emerald-100 text-emerald-700' : 'bg-bone-100 text-bone-600')}>
                {statusLabel}
              </span>
            </div>
            <p className="text-sm text-bark-500/60 mt-1">
              Manage the current Astro promo shown to retailers on their dashboard.
            </p>
          </div>
        </div>
        <label className="inline-flex items-center gap-2 rounded-xl bg-white border border-cream-200 px-3 py-2 text-sm font-semibold text-bark-500">
          <input
            type="checkbox"
            checked={promoForm.promo_visible}
            onChange={(event) => setPromoForm((current) => ({ ...current, promo_visible: event.target.checked }))}
            className="rounded border-cream-300 text-bark-500 focus:ring-bark-500"
          />
          Show promo on retailer dashboards
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-5">
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="astro-promo-name">Promo name</label>
            <input
              id="astro-promo-name"
              type="text"
              value={promoForm.promo_name}
              onChange={(event) => setPromoForm((current) => ({ ...current, promo_name: event.target.value }))}
              placeholder="June Astro double-punch promo"
              className="input"
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="label" htmlFor="astro-promo-description">Promo description</label>
            <textarea
              id="astro-promo-description"
              value={promoForm.promo_description}
              onChange={(event) => setPromoForm((current) => ({ ...current, promo_description: event.target.value }))}
              placeholder="Short retailer-facing description of the current promo."
              className="input min-h-[104px]"
              rows={4}
              disabled={isLoading}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="astro-promo-start">Promo start date</label>
              <input
                id="astro-promo-start"
                type="date"
                value={promoForm.promo_start_date}
                onChange={(event) => setPromoForm((current) => ({ ...current, promo_start_date: event.target.value }))}
                className="input"
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="label" htmlFor="astro-promo-end">Promo end date</label>
              <input
                id="astro-promo-end"
                type="date"
                value={promoForm.promo_end_date}
                onChange={(event) => setPromoForm((current) => ({ ...current, promo_end_date: event.target.value }))}
                className="input"
                disabled={isLoading}
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="astro-promo-url">Astro promo URL</label>
            <input
              id="astro-promo-url"
              type="url"
              value={promoForm.astro_promo_url}
              onChange={(event) => setPromoForm((current) => ({ ...current, astro_promo_url: event.target.value }))}
              placeholder={DEFAULT_ASTRO_URL}
              className="input"
              disabled={isLoading}
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={savePromo}
              disabled={isLoading || isSaving}
              className="btn-primary text-sm px-4 py-2 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save promo'}
            </button>
            {notice && <p className="text-sm text-bark-500/60">{notice}</p>}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-cream-200 p-4 self-start">
          <p className="text-xs font-semibold uppercase tracking-wide text-bark-500/50">Retailer preview</p>
          <div className="mt-3 rounded-xl border border-amber-200 bg-cream-100 p-4">
            <p className="text-xs uppercase tracking-wide text-bark-500/60 font-semibold">Astro Seasonal Promo Available</p>
            <h3 className="text-lg font-bold text-bark-500 mt-1">
              Opt into {promoForm.promo_name || currentPromo.promoName || 'the current promo'}
            </h3>
            <p className="text-sm text-bark-500/70 mt-2">
              {promoForm.promo_description ||
                currentPromo.promoDescription ||
                'This promotion is managed through Astro. Visit Astro to opt in, then mark it complete here so our team knows your store is participating.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-bark-500 px-3 py-2 text-xs font-semibold text-white">
                Opt In Through Astro
                <ExternalLink className="w-3.5 h-3.5" />
              </span>
              <span className="rounded-xl border border-bark-500/20 px-3 py-2 text-xs font-semibold text-bark-500">Mark as Opted In</span>
              <span className="rounded-xl px-3 py-2 text-xs font-semibold text-bark-500/70">Not This Time</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function AdminAnnouncementsPage() {
  const [activeTab, setActiveTab] = useState<AnnouncementTab>('dashboard-announcements');
  const [previewPopup, setPreviewPopup] = useState<PreviewPopup>(null);

  useEffect(() => {
    if (!previewPopup) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreviewPopup(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [previewPopup]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="page-title">Announcements</h1>
        <p className="text-bark-500/60 text-sm mt-1">
          Manage retailer-facing promos, notices, and dashboard announcements.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-2 shadow-sm">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard-announcements')}
            className={cn(
              'rounded-xl px-4 py-3 text-sm font-semibold transition-colors',
              activeTab === 'dashboard-announcements'
                ? 'bg-bark-500 text-white'
                : 'text-bark-500 hover:bg-cream-100'
            )}
          >
            Dashboard Announcements
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('dashboard-promos')}
            className={cn(
              'rounded-xl px-4 py-3 text-sm font-semibold transition-colors',
              activeTab === 'dashboard-promos'
                ? 'bg-bark-500 text-white'
                : 'text-bark-500 hover:bg-cream-100'
            )}
          >
            Astro Promo
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('popup-previews')}
            className={cn(
              'rounded-xl px-4 py-3 text-sm font-semibold transition-colors',
              activeTab === 'popup-previews'
                ? 'bg-bark-500 text-white'
                : 'text-bark-500 hover:bg-cream-100'
            )}
          >
            Popup Previews
          </button>
        </div>
      </div>

      {activeTab === 'dashboard-announcements' ? (
        <DashboardAnnouncementsManager />
      ) : activeTab === 'dashboard-promos' ? (
        <AstroPromoManager />
      ) : (
        <PopupPreviewManager onPreview={setPreviewPopup} />
      )}

      {previewPopup === 'shelf-talkers' && (
        <ShelfTalkerPreviewModal onClose={() => setPreviewPopup(null)} />
      )}

      {previewPopup === 'welcome-offer' && (
        <WelcomeOfferPreviewModal onClose={() => setPreviewPopup(null)} />
      )}
    </div>
  );
}

function PopupPreviewManager({ onPreview }: { onPreview: (popup: PreviewPopup) => void }) {
  return (
    <section className="bg-cream-100 rounded-2xl border border-cream-200 p-5 space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h2 className="section-title">Popup Previews</h2>
          <p className="text-sm text-bark-500/60 mt-1">
            Open retailer-facing popups exactly as admin previews. Previewing does not mark any customer popup as seen.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-cream-200 bg-white p-4">
          <div className="aspect-[16/10] overflow-hidden rounded-xl bg-bark-500">
            <img
              src="/images/shelf-talker-popup.png"
              alt="Bare Naked shelf talker preview"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">One-time customer popup</p>
            <h3 className="mt-1 text-lg font-bold text-bark-500">Shelf Talker Announcement</h3>
            <p className="mt-2 text-sm text-bark-500/65">
              Shown once to retailers after they are no longer eligible for the Welcome Offer.
            </p>
            <button
              type="button"
              onClick={() => onPreview('shelf-talkers')}
              className="btn-primary mt-4 text-sm px-4 py-2"
            >
              Preview Popup
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-cream-200 bg-white p-4">
          <div className="flex aspect-[16/10] flex-col justify-center rounded-xl bg-bark-500 p-6 text-white">
            <p className="text-xs font-semibold uppercase tracking-wide text-cream-200/80">Welcome Offer</p>
            <div className="mt-4 flex items-end gap-2">
              <span className="text-6xl font-bold leading-none" style={{ fontFamily: 'var(--font-poppins)' }}>10</span>
              <span className="pb-2 text-3xl font-bold">% off</span>
            </div>
            <p className="mt-1 text-sm font-semibold text-cream-200">first order + samples + launch promo support</p>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">First 14 days</p>
            <h3 className="mt-1 text-lg font-bold text-bark-500">Welcome Offer Popup</h3>
            <p className="mt-2 text-sm text-bark-500/65">
              Shown first while a new retailer is inside the Welcome Offer window.
            </p>
            <button
              type="button"
              onClick={() => onPreview('welcome-offer')}
              className="btn-primary mt-4 text-sm px-4 py-2"
            >
              Preview Popup
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function ShelfTalkerPreviewModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-bark-500/45 p-3 py-4 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="relative my-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-cream-300 bg-white shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-lg bg-white/90 p-2 text-bark-500/70 shadow-sm hover:bg-cream-100 hover:text-bark-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-bark-500 focus-visible:ring-offset-2"
          aria-label="Close shelf talker preview"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="grid max-h-[calc(100vh-2rem)] overflow-y-auto lg:grid-cols-[1.08fr_0.92fr]">
          <div className="relative flex min-h-[280px] items-center justify-center bg-bark-500 p-2 sm:min-h-[360px] lg:min-h-[560px]">
            <img
              src="/images/shelf-talker-popup.png"
              alt="Bare Naked trail mix topper bags displayed with a salmon shelf talker"
              className="h-full max-h-[640px] w-full object-contain"
            />
            <div className="absolute bottom-4 left-4 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-bark-500 shadow-sm">
              Sized to fit a 6 oz + 12 oz pair
            </div>
          </div>

          <div className="flex flex-col justify-center p-5 sm:p-7 lg:p-8">
            <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-orange-800">
              <Sparkles className="h-4 w-4" />
              NEW RETAIL TOOL
            </div>
            <h2 className="pr-8 text-2xl font-bold leading-tight text-bark-500 sm:pr-0 sm:text-3xl" style={{ fontFamily: 'var(--font-poppins)' }}>
              Help your Bare Naked products stand out on the shelf.
            </h2>
            <p className="mt-3 text-sm leading-6 text-bark-500/75 sm:text-base">
              Our new shelf talkers help your display grab attention and make it easier for shoppers to understand each recipe at a glance.
            </p>

            <div className="mt-5 space-y-2.5 sm:mt-6">
              <div className="flex gap-3 rounded-xl bg-cream-100 p-3.5">
                <Ruler className="mt-0.5 h-5 w-5 shrink-0 text-bark-500" />
                <div>
                  <p className="font-semibold text-bark-500">Designed to fit your display</p>
                  <p className="mt-1 text-sm leading-5 text-bark-500/70">
                    Each shelf talker is the same width as one 6 oz and one 12 oz bag placed side by side, giving your products a clean, intentional shelf presence.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 rounded-xl bg-cream-100 p-3.5">
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <p className="font-semibold text-bark-500">Easy to qualify</p>
                  <p className="mt-1 text-sm leading-5 text-bark-500/70">
                    Carry both the <strong>6 oz and 12 oz</strong> size of any flavor to qualify for that flavor&apos;s matching shelf talker.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 rounded-xl bg-cream-100 p-3.5">
                <Package className="mt-0.5 h-5 w-5 shrink-0 text-orange-700" />
                <div>
                  <p className="font-semibold text-bark-500">Automatically included</p>
                  <p className="mt-1 text-sm leading-5 text-bark-500/70">
                    No forms or requests needed. Once your store qualifies, we&apos;ll add the matching shelf talker to your next order.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <span className="btn-primary">
                Complete My Display
                <ArrowRight className="ml-2 h-4 w-4" />
              </span>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-bark-500/20 px-5 py-3 font-semibold text-bark-500 hover:bg-cream-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-bark-500 focus-visible:ring-offset-2"
              >
                Got It
              </button>
            </div>
            <p className="mt-3 text-xs text-bark-500/60">
              Available for Chicken, Salmon, and Beef. Shelf talkers are matched by flavor.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function WelcomeOfferPreviewModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-bark-500/45 p-3 py-4 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="relative my-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-amber-200 bg-cream-100 shadow-2xl">
        <div className="absolute right-6 top-6 hidden h-24 w-24 rounded-full border border-amber-200/70 bg-amber-100/60 sm:block" />
        <div className="absolute -left-8 -top-8 h-32 w-32 rounded-full border border-cream-300 bg-white/50" />
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-lg p-2 text-bark-500/60 hover:bg-cream-200 hover:text-bark-500"
          aria-label="Close Welcome Offer preview"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="relative grid max-h-[calc(100vh-2rem)] gap-0 overflow-y-auto lg:grid-cols-[1fr_0.82fr]">
          <div className="p-5 sm:p-8">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-800 sm:mb-5">
              <Sparkles className="h-4 w-4" />
              14 days left
            </div>
            <p className="text-sm font-semibold text-bark-500/70">Welcome, Preview Store.</p>
            <h2 className="mt-2 pr-8 text-[2rem] font-bold leading-tight text-bark-500 sm:pr-0 sm:text-4xl" style={{ fontFamily: 'var(--font-poppins)' }}>
              Welcome to the Bare family.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-bark-500/75 sm:mt-4 sm:text-base">
              To help you launch successfully, your new retailer offer is available for 14 more days.
            </p>

            <div className="mt-5 grid gap-3 sm:mt-6 sm:grid-cols-3">
              <PreviewOfferPill icon={Gift} label={'10% off\nyour first order'} description="Automatically applied at checkout" />
              <PreviewOfferPill icon={Package} label="Free customer samples" description="Included to help more shoppers try Bare" />
              <PreviewOfferPill icon={Megaphone} label="Supported launch promo" description={"We'll help you drive early sell-through"} />
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:mt-7 sm:flex-row sm:items-center">
              <span className="btn-primary">
                Build My First Order
                <ArrowRight className="ml-2 h-4 w-4" />
              </span>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-bark-500/20 px-5 py-3 font-semibold text-bark-500 hover:bg-cream-200"
              >
                Remind Me Later
              </button>
            </div>
            <p className="mt-3 text-xs text-bark-500/60">
              No code needed. Your 10% welcome discount is automatically applied at checkout. Net-30 terms are included.
            </p>
          </div>

          <div className="flex min-h-[260px] flex-col justify-between bg-bark-500 p-5 text-white sm:p-8">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-cream-200/80">WELCOME OFFER</p>
              <div className="mt-4 flex items-end gap-2 sm:mt-5">
                <span className="text-6xl font-bold leading-none sm:text-7xl" style={{ fontFamily: 'var(--font-poppins)' }}>10</span>
                <span className="pb-1.5 text-3xl font-bold sm:pb-2">% off</span>
              </div>
              <p className="mt-1 text-base font-semibold text-cream-200">your first order</p>
              <p className="mt-4 text-sm leading-6 text-cream-100/85 sm:mt-5">
                More than a discount, it&apos;s a simple launch plan for your store.
              </p>
            </div>
            <div className="mt-5 space-y-3 rounded-xl bg-white/10 p-4 sm:mt-8">
              <PreviewCheck label="First-order savings" />
              <PreviewCheck label="Free customer sampling" />
              <PreviewCheck label="Fully supported launch promo" />
            </div>
            <div className="mt-5 rounded-xl bg-white/10 p-4 sm:mt-8">
              <p className="text-xs uppercase tracking-wide text-cream-200/80">ALWAYS INCLUDED</p>
              <p className="mt-1 text-sm font-semibold">Free shipping, no minimums, Astro Loyalty support, and retailer marketing resources.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewOfferPill({
  icon: Icon,
  label,
  description,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-cream-300 bg-white/70 p-4">
      <Icon className="h-5 w-5 text-amber-700" />
      <p className="mt-3 whitespace-pre-line text-sm font-bold leading-5 text-bark-500">{label}</p>
      <p className="mt-1 text-xs leading-5 text-bark-500/60">{description}</p>
    </div>
  );
}

function PreviewCheck({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <CheckCircle className="h-4 w-4 shrink-0 text-amber-200" />
      <span className="text-sm font-semibold">{label}</span>
    </div>
  );
}
