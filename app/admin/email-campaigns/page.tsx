'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bold,
  CheckCircle,
  Eye,
  FileText,
  Image as ImageIcon,
  Italic,
  Loader2,
  Mail,
  Plus,
  Save,
  Search,
  Send,
  Type,
  Underline,
  Users,
  X,
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
  recipientError?: string | null;
  recipientCount: number;
  sampleRecipients: Array<{ email: string; company_name?: string | null; contact_name?: string | null; first_name?: string | null }>;
};

type CampaignListPayload = {
  campaigns?: Campaign[];
  defaultCampaign?: Campaign;
  setupRequired?: boolean;
  setupMessage?: string;
  error?: string;
};

type SendResultPayload = {
  recipientCount?: number;
  sentCount?: number;
  failedCount?: number;
  resendMessageId?: string | null;
  sent?: Array<{ email: string; resendMessageId?: string | null }>;
  error?: string;
};

type DeliveryFilter = 'all' | 'accepted' | 'failed';

type DeliveryDetails = {
  campaign: {
    id: string;
    name: string;
    subject: string;
    status: string;
    sentAt?: string | null;
  };
  summary: {
    total: number;
    accepted: number;
    failed: number;
  };
  recipients: Array<{
    id: string;
    email: string;
    companyName?: string | null;
    contactName?: string | null;
    resendMessageId?: string | null;
    status: 'sent' | 'failed';
    error?: string | null;
    sentAt?: string | null;
  }>;
  error?: string;
};

type RetailerRecipientOption = {
  id: string;
  company_name?: string | null;
  contact_name?: string | null;
  email: string;
};

type LibraryImage = {
  name: string;
  path: string;
  url: string;
  size?: number | null;
  mimeType?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

const audienceOptions: Array<{ value: AudienceFilter; label: string; description: string }> = [
  { value: 'all_retailers', label: 'All retailers', description: 'Every retailer with a valid email.' },
  { value: 'never_ordered', label: 'Never ordered', description: 'Retailers with no non-canceled orders.' },
  { value: 'ordered_once', label: 'Ordered once', description: 'Retailers with exactly one order.' },
  { value: 'repeat_buyers', label: 'Repeat buyers', description: 'Retailers with two or more orders.' },
  { value: 'manual', label: 'Manual list', description: 'Search and select specific retailers.' },
];

const mergeTags = ['{{first_name}}', '{{contact_name}}', '{{company_name}}'] as const;

const bodyFormatControls = [
  { label: 'Bold', icon: Bold, prefix: '**', suffix: '**', placeholder: 'bold text' },
  { label: 'Italic', icon: Italic, prefix: '_', suffix: '_', placeholder: 'italic text' },
  { label: 'Underline', icon: Underline, prefix: '[u]', suffix: '[/u]', placeholder: 'underlined text' },
] as const;

const imageTokenPlaceholder = '{{image:https://example.com/photo.jpg|Image description}}';

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
};

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
  const [loadError, setLoadError] = useState('');
  const [setupMessage, setSetupMessage] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sending, setSending] = useState(false);
  const [manualSearch, setManualSearch] = useState('');
  const [manualSuggestions, setManualSuggestions] = useState<RetailerRecipientOption[]>([]);
  const [manualSearchLoading, setManualSearchLoading] = useState(false);
  const [manualSearchError, setManualSearchError] = useState('');
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [libraryImages, setLibraryImages] = useState<LibraryImage[]>([]);
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [deliveryDetails, setDeliveryDetails] = useState<DeliveryDetails | null>(null);
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>('all');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const previewRequestId = useRef(0);
  const bodyTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedId) || null,
    [campaigns, selectedId],
  );

  const isSent = form?.status === 'sent';
  const canSend = Boolean(form?.id && !isSent && preview && !preview.validationError && preview.recipientCount > 0);
  const selectedManualRecipients = useMemo(
    () => parseSelectedManualRecipients(form?.manual_recipients),
    [form?.manual_recipients],
  );
  const selectedManualRecipientEmails = useMemo(
    () => new Set(selectedManualRecipients.map((recipient) => recipient.email.toLowerCase())),
    [selectedManualRecipients],
  );
  const visibleManualSuggestions = useMemo(
    () => manualSuggestions.filter((recipient) => !selectedManualRecipientEmails.has(recipient.email.toLowerCase())),
    [manualSuggestions, selectedManualRecipientEmails],
  );
  const filteredLibraryImages = useMemo(() => {
    const query = librarySearch.trim().toLowerCase();
    if (!query) return libraryImages;
    return libraryImages.filter((image) =>
      image.name.toLowerCase().includes(query) ||
      image.path.toLowerCase().includes(query) ||
      (image.mimeType || '').toLowerCase().includes(query),
    );
  }, [libraryImages, librarySearch]);
  const filteredDeliveryRecipients = useMemo(() => {
    const recipients = deliveryDetails?.recipients || [];
    if (deliveryFilter === 'accepted') return recipients.filter((recipient) => recipient.status === 'sent');
    if (deliveryFilter === 'failed') return recipients.filter((recipient) => recipient.status === 'failed');
    return recipients;
  }, [deliveryDetails?.recipients, deliveryFilter]);

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

  useEffect(() => {
    if (form?.audience_filter !== 'manual') {
      setManualSuggestions([]);
      return;
    }

    const timeout = window.setTimeout(() => {
      searchManualRecipients(manualSearch);
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [form?.audience_filter, manualSearch]);

  async function loadCampaigns(nextSelectedId?: string) {
    setLoading(true);
    setNotice(null);
    setLoadError('');

    try {
      const response = await fetch('/api/admin/email-campaigns');
      const payload = await response.json().catch(() => ({})) as CampaignListPayload;
      if (!response.ok) throw new Error(payload?.error || 'Unable to load email campaigns.');

      const nextCampaigns = (payload.campaigns || []) as Campaign[];
      const nextDefault = payload.defaultCampaign as Campaign;
      setCampaigns(nextCampaigns);
      setDefaultCampaign(nextDefault);
      setSetupMessage(payload.setupRequired ? payload.setupMessage || 'Run the email campaigns Supabase migration before saving or sending campaigns.' : '');

      const targetId = nextSelectedId || selectedId;
      const target = nextCampaigns.find((campaign) => campaign.id === targetId) || nextCampaigns[0] || nextDefault;
      setSelectedId(target?.id || 'new');
      setForm(target);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load email campaigns.';
      setLoadError(message);
      setNotice({ type: 'error', message });
    } finally {
      setLoading(false);
    }
  }

  async function renderPreview(nextForm: Campaign) {
    const requestId = previewRequestId.current + 1;
    previewRequestId.current = requestId;
    setPreviewLoading(true);
    try {
      const response = await fetch('/api/admin/email-campaigns/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextForm),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Unable to render preview.');
      if (requestId !== previewRequestId.current) return;
      setPreview(payload as Preview);
    } catch (error) {
      if (requestId !== previewRequestId.current) return;
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to render preview.' });
    } finally {
      if (requestId === previewRequestId.current) {
        setPreviewLoading(false);
      }
    }
  }

  function updateForm(updates: Partial<Campaign>) {
    setForm((current) => current ? { ...current, ...updates } : current);
  }

  function appendMergeTag(field: 'subject' | 'preheader' | 'headline' | 'body', tag: typeof mergeTags[number]) {
    setForm((current) => {
      if (!current) return current;
      const value = current[field] || '';
      const separator = value && !value.endsWith(' ') && !value.endsWith('\n') ? ' ' : '';
      return { ...current, [field]: `${value}${separator}${tag}` };
    });
  }

  function applyBodyFormat(format: typeof bodyFormatControls[number]) {
    if (!form || isSent) return;

    const textarea = bodyTextareaRef.current;
    const value = form.body || '';
    const selectionStart = textarea?.selectionStart ?? value.length;
    const selectionEnd = textarea?.selectionEnd ?? value.length;
    const selectedText = value.slice(selectionStart, selectionEnd) || format.placeholder;
    const formattedText = `${format.prefix}${selectedText}${format.suffix}`;
    const nextBody = `${value.slice(0, selectionStart)}${formattedText}${value.slice(selectionEnd)}`;

    updateForm({ body: nextBody });

    window.requestAnimationFrame(() => {
      bodyTextareaRef.current?.focus();
      const nextSelectionStart = selectionStart + format.prefix.length;
      const nextSelectionEnd = nextSelectionStart + selectedText.length;
      bodyTextareaRef.current?.setSelectionRange(nextSelectionStart, nextSelectionEnd);
    });
  }

  function insertBodyImageToken(image: LibraryImage) {
    if (!form || isSent) return;

    const token = `{{image:${image.url}|${image.name}}}`;
    const textarea = bodyTextareaRef.current;
    const value = form.body || '';
    const selectionStart = textarea?.selectionStart ?? value.length;
    const selectionEnd = textarea?.selectionEnd ?? value.length;
    const before = value.slice(0, selectionStart);
    const after = value.slice(selectionEnd);
    const prefix = before && !before.endsWith('\n\n') ? before.endsWith('\n') ? '\n' : '\n\n' : '';
    const suffix = after && !after.startsWith('\n\n') ? after.startsWith('\n') ? '\n' : '\n\n' : '';
    const nextBody = `${before}${prefix}${token}${suffix}${after}`;
    const nextCursorPosition = `${before}${prefix}${token}`.length;

    updateForm({ body: nextBody });

    window.requestAnimationFrame(() => {
      bodyTextareaRef.current?.focus();
      bodyTextareaRef.current?.setSelectionRange(nextCursorPosition, nextCursorPosition);
    });

    setImagePickerOpen(false);
  }

  async function openImagePicker() {
    setImagePickerOpen(true);
    setLibrarySearch('');
    if (libraryLoaded || libraryLoading) return;

    setLibraryLoading(true);
    try {
      const response = await fetch('/api/admin/library/images');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Unable to load images.');
      setLibraryImages((payload.images || []) as LibraryImage[]);
      setLibraryLoaded(true);
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to load images.' });
    } finally {
      setLibraryLoading(false);
    }
  }

  async function openDeliveryDetails(campaign: Campaign) {
    if (!campaign.id) return;

    setDeliveryOpen(true);
    setDeliveryLoading(true);
    setDeliveryDetails(null);
    setDeliveryFilter('all');

    try {
      const response = await fetch(`/api/admin/email-campaigns/${campaign.id}/delivery`);
      const payload = await response.json().catch(() => ({})) as DeliveryDetails;
      if (!response.ok) throw new Error(payload?.error || 'Unable to load delivery details.');
      setDeliveryDetails(payload);
    } catch (error) {
      setDeliveryDetails({
        campaign: {
          id: campaign.id,
          name: campaign.name,
          subject: campaign.subject,
          status: campaign.status || 'sent',
          sentAt: campaign.sent_at || null,
        },
        summary: { total: 0, accepted: 0, failed: 0 },
        recipients: [],
        error: error instanceof Error ? error.message : 'Unable to load delivery details.',
      });
    } finally {
      setDeliveryLoading(false);
    }
  }

  function parseSelectedManualRecipients(value?: string | null): RetailerRecipientOption[] {
    const unique = new Map<string, RetailerRecipientOption>();
    const tokens = (value || '')
      .split(/[\n,;]/)
      .map((token) => token.trim())
      .filter(Boolean);

    for (const token of tokens) {
      const match = token.match(/^(?:(.*?)\s*)?<([^>]+)>$/);
      const email = (match?.[2] || token).trim().toLowerCase();
      const label = (match?.[1] || '').trim();
      if (!email || unique.has(email)) continue;
      unique.set(email, {
        id: email,
        email,
        company_name: label || email,
        contact_name: label || null,
      });
    }

    return Array.from(unique.values());
  }

  function formatManualRecipient(recipient: RetailerRecipientOption) {
    const label = (recipient.contact_name || recipient.company_name || '').trim();
    return label ? `${label} <${recipient.email}>` : recipient.email;
  }

  function setSelectedManualRecipients(recipients: RetailerRecipientOption[]) {
    updateForm({
      audience_filter: 'manual',
      manual_recipients: recipients.map(formatManualRecipient).join('\n'),
    });
  }

  function addManualRecipient(recipient: RetailerRecipientOption) {
    const selected = parseSelectedManualRecipients(form?.manual_recipients);
    if (selected.some((item) => item.email.toLowerCase() === recipient.email.toLowerCase())) return;
    setSelectedManualRecipients([...selected, recipient]);
    setManualSearch('');
  }

  function removeManualRecipient(email: string) {
    const selected = parseSelectedManualRecipients(form?.manual_recipients);
    setSelectedManualRecipients(selected.filter((recipient) => recipient.email.toLowerCase() !== email.toLowerCase()));
  }

  async function searchManualRecipients(query: string) {
    setManualSearchLoading(true);
    setManualSearchError('');

    try {
      const response = await fetch(`/api/admin/email-campaigns/retailers?q=${encodeURIComponent(query)}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Unable to search retailers.');
      setManualSuggestions((payload.retailers || []) as RetailerRecipientOption[]);
    } catch (error) {
      setManualSuggestions([]);
      setManualSearchError(error instanceof Error ? error.message : 'Unable to search retailers.');
    } finally {
      setManualSearchLoading(false);
    }
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
    if (!form) {
      return;
    }

    setTesting(true);
    setNotice(null);

    try {
      const response = await fetch('/api/admin/email-campaigns/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign: form, testEmail }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Unable to send test email.');
      const resendMessageId = typeof payload?.resendMessageId === 'string' ? payload.resendMessageId : '';
      setNotice({
        type: 'success',
        message: resendMessageId
          ? `Test email accepted by Resend for ${testEmail}. Message ID: ${resendMessageId}.`
          : `Test email accepted by Resend for ${testEmail}.`,
      });
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
      const payload = await response.json().catch(() => ({})) as SendResultPayload;
      if (!response.ok) throw new Error(payload?.error || 'Unable to send email campaign.');

      const firstSent = payload.sent?.find((recipient) => recipient.resendMessageId);
      const receiptText = firstSent?.resendMessageId
        ? ` First receipt: ${firstSent.email} (${firstSent.resendMessageId}).`
        : '';

      setNotice({
        type: Number(payload.failedCount || 0) > 0 ? 'error' : 'success',
        message: Number(payload.failedCount || 0) > 0
          ? `Resend accepted ${payload.sentCount || 0} emails. ${payload.failedCount || 0} failed.${receiptText}`
          : `Resend accepted ${payload.sentCount || 0} campaign emails.${receiptText}`,
      });
      setConfirmText('');
      await loadCampaigns(form.id);
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to send email campaign.' });
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[420px] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-bark-500" />
      </div>
    );
  }

  if (!form) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-cream-200 p-5">
          <h1 className="text-2xl font-bold text-bark-500" style={{ fontFamily: 'var(--font-poppins)' }}>
            Email Campaigns
          </h1>
          <p className="mt-1 text-sm text-bark-500/60">
            Build editable retailer emails, preview them, send tests, and deliver through Resend.
          </p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <h2 className="font-semibold">Unable to load campaigns</h2>
              <p className="mt-1 text-sm leading-6">{loadError || 'The campaign builder could not initialize.'}</p>
              <button onClick={() => loadCampaigns()} className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-red-700">
                Try again
              </button>
            </div>
          </div>
        </div>
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

      {setupMessage && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{setupMessage}</span>
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
                onClick={() => {
                  setSelectedId(campaign.id || '');
                  if (campaign.status === 'sent') {
                    openDeliveryDetails(campaign);
                  }
                }}
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
                {campaign.status === 'sent' && (
                  <p className="mt-2 text-xs font-semibold text-bark-500/70">View delivery details</p>
                )}
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
                  <div className="mb-2 flex flex-wrap gap-2">
                    {bodyFormatControls.map((format) => (
                      <button
                        key={format.label}
                        type="button"
                        onClick={() => applyBodyFormat(format)}
                        disabled={isSent}
                        title={format.label}
                        aria-label={format.label}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-cream-300 bg-white text-bark-500 transition-colors hover:bg-cream-100 disabled:opacity-60"
                      >
                        <format.icon className="h-4 w-4" />
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={openImagePicker}
                      disabled={isSent}
                      title="Insert image"
                      aria-label="Insert image"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-cream-300 bg-white text-bark-500 transition-colors hover:bg-cream-100 disabled:opacity-60"
                    >
                      <ImageIcon className="h-4 w-4" />
                    </button>
                  </div>
                  <textarea
                    ref={bodyTextareaRef}
                    value={form.body}
                    onChange={(event) => updateForm({ body: event.target.value })}
                    disabled={isSent}
                    rows={8}
                    className="input min-h-[210px] resize-y"
                  />
                </Field>
                <div className="rounded-xl border border-cream-200 bg-cream-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-bark-500/50">Personalization</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {mergeTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => appendMergeTag('body', tag)}
                        disabled={isSent}
                        className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-xs font-semibold text-bark-500 hover:bg-cream-100 disabled:opacity-60"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-bark-500/60">
                    Preview uses Jamie as the sample. Images can be inserted with {imageTokenPlaceholder}.
                  </p>
                </div>
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
                  <div className="space-y-3">
                    <Field label="Search retailers">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-bark-500/40" />
                        <input
                          value={manualSearch}
                          onChange={(event) => setManualSearch(event.target.value)}
                          onFocus={() => searchManualRecipients(manualSearch)}
                          disabled={isSent}
                          className="input pl-11"
                          placeholder="Search by store, contact, or email"
                        />
                      </div>
                    </Field>

                    {(manualSearch || visibleManualSuggestions.length > 0 || manualSearchLoading || manualSearchError) && (
                      <div className="max-h-72 overflow-auto rounded-xl border border-cream-200 bg-white shadow-sm">
                        {manualSearchLoading ? (
                          <div className="flex items-center gap-2 px-4 py-3 text-sm text-bark-500/60">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Searching...
                          </div>
                        ) : manualSearchError ? (
                          <div className="px-4 py-3 text-sm text-red-700">{manualSearchError}</div>
                        ) : visibleManualSuggestions.length > 0 ? (
                          visibleManualSuggestions.map((recipient) => (
                            <button
                              key={`${recipient.id}-${recipient.email}`}
                              type="button"
                              onClick={() => addManualRecipient(recipient)}
                              disabled={isSent}
                              className="flex w-full items-center justify-between gap-3 border-b border-cream-100 px-4 py-3 text-left last:border-b-0 hover:bg-cream-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <span>
                                <span className="block text-sm font-semibold text-bark-500">{recipient.company_name || recipient.email}</span>
                                <span className="block text-xs text-bark-500/60">
                                  {recipient.contact_name ? `${recipient.contact_name} · ` : ''}{recipient.email}
                                </span>
                              </span>
                              <Plus className="h-4 w-4 shrink-0 text-bark-500/50" />
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-3 text-sm text-bark-500/60">No matching retailers found.</div>
                        )}
                      </div>
                    )}

                    <div className="rounded-xl border border-cream-200 bg-cream-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-bark-500/50">Selected recipients</p>
                      {selectedManualRecipients.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {selectedManualRecipients.map((recipient) => (
                            <span
                              key={recipient.email}
                              className="inline-flex max-w-full items-center gap-2 rounded-full border border-cream-300 bg-white px-3 py-2 text-sm text-bark-500"
                            >
                              <span className="truncate">
                                {recipient.company_name || recipient.email}
                                {recipient.company_name && <span className="text-bark-500/50"> · {recipient.email}</span>}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeManualRecipient(recipient.email)}
                                disabled={isSent}
                                aria-label={`Remove ${recipient.email}`}
                                className="shrink-0 rounded-full p-0.5 text-bark-500/50 hover:bg-cream-100 hover:text-bark-500 disabled:opacity-60"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-bark-500/60">No manual recipients selected.</p>
                      )}
                    </div>
                  </div>
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
                        ? preview.sampleRecipients.map((recipient) => {
                            const contact = recipient.contact_name ? `${recipient.contact_name} · ` : '';
                            return `${contact}${recipient.company_name || 'Retailer'} <${recipient.email}>`;
                          }).join(' · ')
                        : 'No recipients loaded.'}
                    </p>
                  </div>
                </div>
                {preview?.recipientError && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    Recipients could not be counted yet: {preview.recipientError}
                  </div>
                )}
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
                  <button onClick={sendTestEmail} disabled={testing || !testEmail} className="btn-primary gap-2">
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

      {deliveryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bark-900/40 p-4">
          <div className="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-xl border border-cream-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-cream-200 px-5 py-4">
              <div>
                <h2 className="font-semibold text-bark-500">Delivery Details</h2>
                <p className="mt-1 text-xs text-bark-500/60">
                  {deliveryDetails?.campaign.name || 'Loading campaign delivery...'}
                  {deliveryDetails?.campaign.sentAt ? ` · ${formatDateTime(deliveryDetails.campaign.sentAt)}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeliveryOpen(false)}
                className="rounded-lg p-2 text-bark-500/60 hover:bg-cream-100 hover:text-bark-500"
                aria-label="Close delivery details"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {deliveryLoading ? (
              <div className="flex h-72 items-center justify-center bg-cream-50">
                <Loader2 className="h-8 w-8 animate-spin text-bark-500" />
              </div>
            ) : deliveryDetails?.error ? (
              <div className="p-5">
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {deliveryDetails.error}
                </div>
              </div>
            ) : deliveryDetails ? (
              <div className="space-y-5 p-5">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <DeliveryStat label="Recipients" value={deliveryDetails.summary.total} />
                  <DeliveryStat label="Accepted by Resend" value={deliveryDetails.summary.accepted} tone="green" />
                  <DeliveryStat label="Failed" value={deliveryDetails.summary.failed} tone={deliveryDetails.summary.failed > 0 ? 'red' : 'neutral'} />
                </div>

                <div className="flex flex-wrap gap-2">
                  <DeliveryFilterButton active={deliveryFilter === 'all'} onClick={() => setDeliveryFilter('all')} label="All" count={deliveryDetails.summary.total} />
                  <DeliveryFilterButton active={deliveryFilter === 'accepted'} onClick={() => setDeliveryFilter('accepted')} label="Accepted" count={deliveryDetails.summary.accepted} />
                  <DeliveryFilterButton active={deliveryFilter === 'failed'} onClick={() => setDeliveryFilter('failed')} label="Failed" count={deliveryDetails.summary.failed} />
                </div>

                <div className="max-h-[46vh] overflow-auto rounded-xl border border-cream-200">
                  {filteredDeliveryRecipients.length > 0 ? (
                    <div className="divide-y divide-cream-100">
                      {filteredDeliveryRecipients.map((recipient) => (
                        <div key={recipient.id} className="grid grid-cols-1 gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_120px_minmax(0,220px)] md:items-center">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-bark-500">
                              {recipient.companyName || recipient.contactName || recipient.email}
                            </p>
                            <p className="mt-1 truncate text-xs text-bark-500/60">
                              {recipient.contactName && recipient.companyName ? `${recipient.contactName} · ` : ''}{recipient.email}
                            </p>
                            {recipient.error && <p className="mt-1 text-xs text-red-700">{recipient.error}</p>}
                          </div>
                          <span className={cn(
                            'w-fit rounded-full px-2 py-1 text-[11px] font-semibold uppercase',
                            recipient.status === 'sent' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700',
                          )}>
                            {recipient.status === 'sent' ? 'Accepted' : 'Failed'}
                          </span>
                          <div className="min-w-0 text-xs text-bark-500/60">
                            <p>{formatDateTime(recipient.sentAt)}</p>
                            {recipient.resendMessageId && (
                              <p className="mt-1 truncate font-mono" title={recipient.resendMessageId}>
                                {recipient.resendMessageId}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-10 text-center text-sm text-bark-500/60">
                      No recipients match this filter.
                    </div>
                  )}
                </div>

                <p className="text-xs leading-5 text-bark-500/60">
                  Accepted means Resend returned a message ID. Delivered, bounced, and opened statuses need Resend webhook events connected to these message IDs.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {imagePickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bark-900/40 p-4">
          <div className="max-h-[86vh] w-full max-w-4xl overflow-hidden rounded-xl border border-cream-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-cream-200 px-5 py-4">
              <div>
                <h2 className="font-semibold text-bark-500">Select Image</h2>
                <p className="mt-1 text-xs text-bark-500/60">Choose an uploaded image to insert into the email body.</p>
              </div>
              <button
                type="button"
                onClick={() => setImagePickerOpen(false)}
                className="rounded-lg p-2 text-bark-500/60 hover:bg-cream-100 hover:text-bark-500"
                aria-label="Close image picker"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-bark-500/40" />
                <input
                  value={librarySearch}
                  onChange={(event) => setLibrarySearch(event.target.value)}
                  className="input pl-11"
                  placeholder="Search image names"
                  autoFocus
                />
              </div>

              {libraryLoading ? (
                <div className="flex h-64 items-center justify-center rounded-xl border border-cream-200 bg-cream-50">
                  <Loader2 className="h-8 w-8 animate-spin text-bark-500" />
                </div>
              ) : filteredLibraryImages.length > 0 ? (
                <div className="grid max-h-[54vh] grid-cols-1 gap-3 overflow-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredLibraryImages.map((image) => (
                    <button
                      key={image.path}
                      type="button"
                      onClick={() => insertBodyImageToken(image)}
                      className="overflow-hidden rounded-xl border border-cream-200 bg-white text-left transition-colors hover:border-bark-500 hover:bg-cream-50"
                    >
                      <div className="aspect-video bg-cream-50">
                        <img src={image.url} alt={image.name} className="h-full w-full object-contain" />
                      </div>
                      <div className="p-3">
                        <p className="truncate text-sm font-semibold text-bark-500" title={image.name}>{image.name}</p>
                        <p className="mt-1 truncate text-xs text-bark-500/50">{image.mimeType || 'image'}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-cream-300 bg-cream-50 px-5 py-12 text-center">
                  <ImageIcon className="mx-auto h-10 w-10 text-bark-500/30" />
                  <p className="mt-3 font-semibold text-bark-500">No images found</p>
                  <p className="mt-1 text-sm text-bark-500/60">Upload images in Library, then select them here.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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

function DeliveryStat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  tone?: 'neutral' | 'green' | 'red';
}) {
  return (
    <div className={cn(
      'rounded-xl p-4',
      tone === 'green' ? 'bg-green-50 text-green-800' : tone === 'red' ? 'bg-red-50 text-red-800' : 'bg-cream-100 text-bark-500',
    )}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function DeliveryFilterButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg border px-3 py-2 text-sm font-semibold transition-colors',
        active ? 'border-bark-500 bg-cream-100 text-bark-500' : 'border-cream-200 bg-white text-bark-500/70 hover:bg-cream-50',
      )}
    >
      {label} <span className="text-bark-500/50">{count}</span>
    </button>
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
