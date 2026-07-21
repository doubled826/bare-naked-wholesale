'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Eye,
  FileText,
  Loader2,
  Mail,
  Plus,
  Save,
  Send,
  Type,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type AudienceFilter = 'all_retailers' | 'never_ordered' | 'ordered_once' | 'repeat_buyers' | 'manual';
type PreviewMode = 'html' | 'text';

type Campaign = {
  id?: string;
  template_key?: string;
  name: string;
  subject: string;
  preheader?: string | null;
  headline: string;
  body: string;
  cta_label?: string | null;
  cta_url?: string | null;
  hero_image_url?: string | null;
  audience_filter: AudienceFilter;
  manual_recipients?: string | null;
  status?: 'draft' | 'sent';
  sent_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

type Preview = {
  subject: string;
  preheader: string;
  text: string;
  html: string;
  validationError?: string | null;
  recipientCount: number;
  sampleRecipients: Array<{ email: string; company_name?: string | null }>;
};

const audienceOptions: Array<{ value: AudienceFilter; label: string; description: string }> = [
  { value: 'all_retailers', label: 'All retailers', description: 'Every retailer with a valid email.' },
  { value: 'never_ordered', label: 'Never ordered', description: 'Retailers with no non-canceled orders.' },
  { value: 'ordered_once', label: 'Ordered once', description: 'Retailers with exactly one order.' },
  { value: 'repeat_buyers', label: 'Repeat buyers', description: 'Retailers with two or more orders.' },
  { value: 'manual', label: 'Manual list', description: 'Paste emails for a controlled send.' },
];

export default function AdminEmailCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [defaultCampaign, setDefaultCampaign] = useState<Campaign | null>(null);
  const [selectedId, setSelectedId] = useState<string>('new');
  const [form, setForm] = useState<Campaign | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('html');
  const [testEmail, setTestEmail] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedId) || null,
    [campaigns, selectedId],
  );

  const isSent = form?.status === 'sent';
  const canSend = Boolean(form?.id && !isSent && preview && !preview.validationError && preview.recipientCount > 0);

  useEffect(() => {
    loadCampaigns();
  }, []);

  useEffect(() => {
    if (!selectedCampaign) return;
    setForm(selectedCampaign);
    setPreviewMode('html');
    setConfirmText('');
  }, [selectedCampaign]);

  useEffect(() => {
    if (!form) return;
    const timeout = window.setTimeout(() => {
      renderPreview(form);
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [form]);

  async function loadCampaigns(nextSelectedId?: string) {
    setLoading(true);
    setNotice(null);

    try {
      const response = await fetch('/api/admin/email-campaigns');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Unable to load email campaigns.');

      const nextCampaigns = (payload.campaigns || []) as Campaign[];
      const nextDefault = payload.defaultCampaign as Campaign;
      setCampaigns(nextCampaigns);
      setDefaultCampaign(nextDefault);

      const targetId = nextSelectedId || selectedId;
      const target = nextCampaigns.find((campaign) => campaign.id === targetId) || nextCampaigns[0] || nextDefault;
      setSelectedId(target?.id || 'new');
      setForm(target);
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to load email campaigns.' });
    } finally {
      setLoading(false);
    }
  }

  async function renderPreview(nextForm: Campaign) {
    setPreviewLoading(true);
    try {
      const response = await fetch('/api/admin/email-campaigns/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextForm),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Unable to render preview.');
      setPreview(payload as Preview);
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to render preview.' });
    } finally {
      setPreviewLoading(false);
    }
  }

  function updateForm(updates: Partial<Campaign>) {
    setForm((current) => current ? { ...current, ...updates } : current);
  }

  function startNewCampaign() {
    if (!defaultCampaign) return;
    const nextCampaign = {
      ...defaultCampaign,
      id: undefined,
      status: 'draft' as const,
      name: `Retailer campaign ${new Date().toLocaleDateString()}`,
    };
    setSelectedId('new');
    setForm(nextCampaign);
    setNotice(null);
    setConfirmText('');
  }

  async function saveCampaign() {
    if (!form || isSent) return;
    setSaving(true);
    setNotice(null);

    try {
      const url = form.id ? `/api/admin/email-campaigns/${form.id}` : '/api/admin/email-campaigns';
      const method = form.id ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Unable to save email campaign.');

      const saved = payload.campaign as Campaign;
      setNotice({ type: 'success', message: 'Campaign draft saved.' });
      await loadCampaigns(saved.id);
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to save email campaign.' });
    } finally {
      setSaving(false);
    }
  }

  async function sendTestEmail() {
    if (!form?.id) {
      setNotice({ type: 'error', message: 'Save the campaign before sending a test.' });
      return;
    }

    setTesting(true);
    setNotice(null);

    try {
      const response = await fetch(`/api/admin/email-campaigns/${form.id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testEmail }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Unable to send test email.');
      setNotice({ type: 'success', message: `Test email sent to ${testEmail}.` });
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to send test email.' });
    } finally {
      setTesting(false);
    }
  }

  async function sendCampaign() {
    if (!form?.id) return;
    if (confirmText !== 'SEND') {
      setNotice({ type: 'error', message: 'Type SEND to confirm this campaign.' });
      return;
    }

    setSending(true);
    setNotice(null);

    try {
      const response = await fetch(`/api/admin/email-campaigns/${form.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmText }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Unable to send email campaign.');

      setNotice({
        type: Number(payload.failedCount || 0) > 0 ? 'error' : 'success',
        message: Number(payload.failedCount || 0) > 0
          ? `Sent ${payload.sentCount || 0} emails. ${payload.failedCount || 0} failed.`
          : `Campaign sent to ${payload.sentCount || 0} retailers.`,
      });
      setConfirmText('');
      await loadCampaigns(form.id);
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to send email campaign.' });
    } finally {
      setSending(false);
    }
  }

  if (loading || !form) {
    return (
      <div className="min-h-[420px] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-bark-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-cream-200 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-bark-500" style={{ fontFamily: 'var(--font-poppins)' }}>
              Email Campaigns
            </h1>
            <p className="mt-1 text-sm text-bark-500/60">
              Build editable retailer emails, preview them, send tests, and deliver through Resend.
            </p>
          </div>
          <button onClick={startNewCampaign} className="btn-primary gap-2">
            <Plus className="w-4 h-4" />
            New campaign
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={cn(
            'rounded-xl border px-4 py-3 text-sm flex items-center gap-2',
            notice.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-700',
          )}
        >
          {notice.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
          {notice.message}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-6">
        <aside className="bg-white rounded-xl border border-cream-200 p-4 space-y-3 h-fit">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-bark-500">
              <FileText className="w-5 h-5" />
              <h2 className="font-semibold">Drafts</h2>
            </div>
            <span className="rounded-full bg-cream-100 px-2 py-1 text-xs font-semibold text-bark-500">
              {campaigns.length}
            </span>
          </div>

          <button
            onClick={startNewCampaign}
            className={cn(
              'w-full rounded-lg border p-3 text-left transition-colors',
              selectedId === 'new' ? 'border-bark-500 bg-cream-100' : 'border-cream-200 hover:bg-cream-50',
            )}
          >
            <p className="font-semibold text-bark-500">Unsaved campaign</p>
            <p className="mt-1 text-xs text-bark-500/60">Start from the retailer announcement template.</p>
          </button>

          <div className="space-y-2">
            {campaigns.map((campaign) => (
              <button
                key={campaign.id}
                onClick={() => setSelectedId(campaign.id || '')}
                className={cn(
                  'w-full rounded-lg border p-3 text-left transition-colors',
                  selectedId === campaign.id ? 'border-bark-500 bg-cream-100' : 'border-cream-200 hover:bg-cream-50',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-bark-500">{campaign.name}</p>
                  <span className={cn('rounded-full px-2 py-1 text-[11px] font-semibold uppercase', campaign.status === 'sent' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700')}>
                    {campaign.status || 'draft'}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-bark-500/60">{campaign.subject}</p>
              </button>
            ))}
          </div>
        </aside>

        <section className="space-y-5">
          <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,560px)_minmax(0,1fr)] gap-5">
            <div className="space-y-5">
              <Panel title="Campaign Copy" icon={Mail}>
                <Field label="Campaign name">
                  <input value={form.name} onChange={(event) => updateForm({ name: event.target.value })} disabled={isSent} className="input" />
                </Field>
                <Field label="Subject">
                  <input value={form.subject} onChange={(event) => updateForm({ subject: event.target.value })} disabled={isSent} className="input" />
                </Field>
                <Field label="Preheader">
                  <input value={form.preheader || ''} onChange={(event) => updateForm({ preheader: event.target.value })} disabled={isSent} className="input" />
                </Field>
                <Field label="Headline">
                  <input value={form.headline} onChange={(event) => updateForm({ headline: event.target.value })} disabled={isSent} className="input" />
                </Field>
                <Field label="Body">
                  <textarea
                    value={form.body}
                    onChange={(event) => updateForm({ body: event.target.value })}
                    disabled={isSent}
                    rows={8}
                    className="input min-h-[210px] resize-y"
                  />
                </Field>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="CTA label">
                    <input value={form.cta_label || ''} onChange={(event) => updateForm({ cta_label: event.target.value })} disabled={isSent} className="input" />
                  </Field>
                  <Field label="CTA URL">
                    <input value={form.cta_url || ''} onChange={(event) => updateForm({ cta_url: event.target.value })} disabled={isSent} className="input" />
                  </Field>
                </div>
                <Field label="Hero image URL">
                  <input value={form.hero_image_url || ''} onChange={(event) => updateForm({ hero_image_url: event.target.value })} disabled={isSent} className="input" />
                </Field>
              </Panel>

              <Panel title="Recipients" icon={Users}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {audienceOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateForm({ audience_filter: option.value })}
                      disabled={isSent}
                      className={cn(
                        'rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-70',
                        form.audience_filter === option.value ? 'border-bark-500 bg-cream-100' : 'border-cream-200 hover:bg-cream-50',
                      )}
                    >
                      <p className="font-semibold text-bark-500">{option.label}</p>
                      <p className="mt-1 text-xs leading-relaxed text-bark-500/60">{option.description}</p>
                    </button>
                  ))}
                </div>

                {form.audience_filter === 'manual' && (
                  <Field label="Manual recipients">
                    <textarea
                      value={form.manual_recipients || ''}
                      onChange={(event) => updateForm({ manual_recipients: event.target.value })}
                      disabled={isSent}
                      rows={5}
                      className="input resize-y"
                      placeholder="store@example.com&#10;Happy Paws <buyer@happypaws.example>"
                    />
                  </Field>
                )}

                <div className="grid grid-cols-1 md:grid-cols-[150px_minmax(0,1fr)] gap-3">
                  <div className="rounded-xl bg-cream-100 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-bark-500/50">Recipients</p>
                    <p className="mt-1 text-2xl font-bold text-bark-500">
                      {previewLoading ? '...' : preview?.recipientCount ?? 0}
                    </p>
                  </div>
                  <div className="rounded-xl bg-cream-100 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-bark-500/50">Sample</p>
                    <p className="mt-1 text-sm leading-6 text-bark-500/70">
                      {preview?.sampleRecipients?.length
                        ? preview.sampleRecipients.map((recipient) => `${recipient.company_name || 'Retailer'} <${recipient.email}>`).join(' · ')
                        : 'No recipients loaded.'}
                    </p>
                  </div>
                </div>
              </Panel>

              <Panel title="Send Controls" icon={Send}>
                {preview?.validationError && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    {preview.validationError}
                  </div>
                )}

                <div className="flex flex-col gap-3 md:flex-row">
                  <button onClick={saveCampaign} disabled={saving || isSent} className="btn-primary gap-2">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? 'Saving...' : 'Save draft'}
                  </button>
                  {isSent && (
                    <span className="inline-flex items-center rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
                      Sent {form.sent_at ? new Date(form.sent_at).toLocaleString() : ''}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-3">
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(event) => setTestEmail(event.target.value)}
                    className="input"
                    placeholder="name@barenakedpet.com"
                  />
                  <button onClick={sendTestEmail} disabled={testing || !testEmail || !form.id} className="btn-primary gap-2">
                    {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {testing ? 'Sending...' : 'Send test'}
                  </button>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                    <p className="text-sm leading-5 text-amber-800">
                      Save the draft, send a test, then type <span className="font-bold">SEND</span> to deliver this campaign through Resend.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-3">
                  <input
                    value={confirmText}
                    onChange={(event) => setConfirmText(event.target.value)}
                    className="input"
                    placeholder="Type SEND to confirm"
                    disabled={isSent}
                  />
                  <button onClick={sendCampaign} disabled={sending || !canSend || confirmText !== 'SEND'} className="btn-primary gap-2">
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {sending ? 'Sending...' : 'Send campaign'}
                  </button>
                </div>
              </Panel>
            </div>

            <div className="bg-white rounded-xl border border-cream-200 overflow-hidden h-fit">
              <div className="border-b border-cream-200 px-5 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="font-semibold text-bark-500">Preview</h3>
                  <p className="mt-1 text-xs text-bark-500/60">{preview?.subject || form.subject}</p>
                </div>
                <div className="flex rounded-lg border border-cream-200 bg-cream-50 p-1">
                  <ModeButton active={previewMode === 'html'} onClick={() => setPreviewMode('html')} icon={Eye} label="HTML" />
                  <ModeButton active={previewMode === 'text'} onClick={() => setPreviewMode('text')} icon={Type} label="Text" />
                </div>
              </div>

              {previewMode === 'html' ? (
                <iframe
                  title="Email campaign preview"
                  srcDoc={preview?.html || ''}
                  className="w-full h-[760px] bg-white"
                />
              ) : (
                <pre className="min-h-[520px] overflow-auto whitespace-pre-wrap bg-cream-50 p-5 text-sm leading-relaxed text-bark-500">
                  {preview?.text || ''}
                </pre>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Mail;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-cream-200 p-5 space-y-4">
      <div className="flex items-center gap-2 text-bark-500">
        <Icon className="w-5 h-5" />
        <h2 className="font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

function ModeButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Eye;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors',
        active ? 'bg-white text-bark-500 shadow-sm' : 'text-bark-500/60 hover:text-bark-500',
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}
