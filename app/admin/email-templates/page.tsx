'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Eye, FileText, Loader2, Mail, Send, Type } from 'lucide-react';
import { cn } from '@/lib/utils';

type EmailTemplate = {
  key: string;
  name: string;
  audience: 'retailer' | 'team';
  description: string;
  subject: string;
  text: string;
  html: string;
};

type PreviewMode = 'html' | 'text';

export default function AdminEmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [previewMode, setPreviewMode] = useState<PreviewMode>('html');
  const [testEmail, setTestEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.key === selectedKey) || templates[0] || null,
    [templates, selectedKey],
  );

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    setLoading(true);
    setNotice(null);

    try {
      const response = await fetch('/api/admin/email-templates');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Unable to load email templates.');

      const nextTemplates = (payload.templates || []) as EmailTemplate[];
      setTemplates(nextTemplates);
      setSelectedKey((current) => current || nextTemplates[0]?.key || '');
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to load email templates.' });
    } finally {
      setLoading(false);
    }
  }

  async function sendTestEmail() {
    if (!selectedTemplate) return;

    setSending(true);
    setNotice(null);

    try {
      const response = await fetch('/api/admin/email-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateKey: selectedTemplate.key, testEmail }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Unable to send test email.');

      setNotice({ type: 'success', message: `Test email sent to ${testEmail}.` });
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to send test email.' });
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

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-cream-200 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-bark-500" style={{ fontFamily: 'var(--font-poppins)' }}>
              Email Templates
            </h1>
            <p className="text-sm text-bark-500/60 mt-1">
              Preview code-owned transactional emails and send internal test copies.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:min-w-[360px]">
            <Metric label="Templates" value={templates.length} />
            <Metric label="Retailer" value={templates.filter((template) => template.audience === 'retailer').length} />
            <Metric label="Team" value={templates.filter((template) => template.audience === 'team').length} />
          </div>
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

      <div className="grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-6">
        <aside className="bg-white rounded-xl border border-cream-200 p-4 space-y-3 h-fit">
          <div className="flex items-center gap-2 text-bark-500">
            <FileText className="w-5 h-5" />
            <h2 className="font-semibold">Transactional templates</h2>
          </div>
          <div className="space-y-2">
            {templates.map((template) => (
              <button
                key={template.key}
                onClick={() => {
                  setSelectedKey(template.key);
                  setPreviewMode('html');
                }}
                className={cn(
                  'w-full rounded-lg border p-3 text-left transition-colors',
                  selectedTemplate?.key === template.key
                    ? 'border-bark-500 bg-cream-100'
                    : 'border-cream-200 hover:bg-cream-50',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-bark-500">{template.name}</p>
                  <span
                    className={cn(
                      'rounded-full px-2 py-1 text-[11px] font-semibold uppercase',
                      template.audience === 'retailer'
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-amber-50 text-amber-700',
                    )}
                  >
                    {template.audience}
                  </span>
                </div>
                <p className="text-xs text-bark-500/60 mt-2 leading-relaxed">{template.description}</p>
              </button>
            ))}
          </div>
        </aside>

        {selectedTemplate && (
          <section className="space-y-5">
            <div className="bg-white rounded-xl border border-cream-200 p-5 space-y-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold text-bark-500">{selectedTemplate.name}</h2>
                    <span className="rounded-full bg-cream-100 px-2 py-1 text-xs font-semibold text-bark-500">
                      {selectedTemplate.audience === 'team' ? 'Team notification' : 'Retailer-facing'}
                    </span>
                  </div>
                  <p className="text-sm text-bark-500/60 mt-1">{selectedTemplate.description}</p>
                </div>
                <div className="flex rounded-lg border border-cream-200 bg-cream-50 p-1">
                  <ModeButton active={previewMode === 'html'} onClick={() => setPreviewMode('html')} icon={Eye} label="HTML" />
                  <ModeButton active={previewMode === 'text'} onClick={() => setPreviewMode('text')} icon={Type} label="Text" />
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-bark-500/50">Subject</p>
                <p className="mt-1 rounded-lg border border-cream-200 bg-cream-50 px-3 py-2 text-sm font-medium text-bark-500">
                  {selectedTemplate.subject}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-cream-200 p-5 space-y-3">
              <div className="flex items-center gap-2 text-bark-500">
                <Send className="w-5 h-5" />
                <h3 className="font-semibold">Send test email</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-3">
                <input
                  type="email"
                  value={testEmail}
                  onChange={(event) => setTestEmail(event.target.value)}
                  className="input"
                  placeholder="name@barenakedpet.com"
                />
                <button
                  onClick={sendTestEmail}
                  disabled={sending || !testEmail}
                  className="btn-primary justify-center gap-2"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {sending ? 'Sending...' : 'Send test'}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-cream-200 overflow-hidden">
              <div className="border-b border-cream-200 px-5 py-3">
                <h3 className="font-semibold text-bark-500">{previewMode === 'html' ? 'Rendered HTML preview' : 'Plain-text preview'}</h3>
              </div>
              {previewMode === 'html' ? (
                <iframe
                  title={`${selectedTemplate.name} preview`}
                  srcDoc={selectedTemplate.html}
                  className="w-full h-[720px] bg-white"
                />
              ) : (
                <pre className="min-h-[520px] overflow-auto whitespace-pre-wrap bg-cream-50 p-5 text-sm leading-relaxed text-bark-500">
                  {selectedTemplate.text}
                </pre>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-cream-200 bg-cream-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-bark-500/50">{label}</p>
      <p className="text-xl font-bold text-bark-500">{value}</p>
    </div>
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
