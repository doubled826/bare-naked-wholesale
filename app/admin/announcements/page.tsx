'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Megaphone, Save } from 'lucide-react';
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
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="page-title">Announcements</h1>
        <p className="text-bark-500/60 text-sm mt-1">
          Manage retailer-facing promos, notices, and dashboard announcements.
        </p>
      </div>

      <AstroPromoManager />
    </div>
  );
}
