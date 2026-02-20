'use client';

import { useMemo, useState } from 'react';
import { Mail, MessageSquare, CheckCircle2, AlertCircle } from 'lucide-react';

const SUPPORT_EMAIL = 'info@barenakedpet.com';

export default function AdminMessagesPage() {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const mailtoHref = useMemo(() => {
    const subjectValue = subject.trim() || 'Team Message';
    const bodyValue = message.trim() || '(No message entered)';
    return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subjectValue)}&body=${encodeURIComponent(bodyValue)}`;
  }, [subject, message]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!message.trim() || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setStatus('idle');
    setErrorMessage('');

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          message,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Failed to send message');
      }

      setStatus('success');
      setSubject('');
      setMessage('');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to send message');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSendDisabled = !message.trim() || isSubmitting;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-bark-100 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-bark-500" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900" style={{ fontFamily: 'var(--font-poppins)' }}>
              Message the Team
            </h1>
            <p className="text-sm text-gray-600">Quick note that sends directly to {SUPPORT_EMAIL}.</p>
          </div>
        </div>
        <p className="text-sm text-gray-600">
          This is a lightweight stopgap for the retailer messaging experience. It sends straight to the shared inbox.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="admin-subject">Subject</label>
          <input
            id="admin-subject"
            type="text"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-bark-500/30 focus:border-bark-500"
            placeholder="Retailer request, announcement, inventory note..."
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="admin-message">Message</label>
          <textarea
            id="admin-message"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 min-h-[160px] focus:outline-none focus:ring-2 focus:ring-bark-500/30 focus:border-bark-500"
            placeholder="Share the details with the team."
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            type="submit"
            className="inline-flex items-center justify-center px-6 py-3 bg-bark-500 text-white rounded-xl font-semibold shadow-lg shadow-bark-500/20 hover:bg-bark-600 transition-colors disabled:opacity-50"
            disabled={isSendDisabled}
          >
            <Mail className="w-5 h-5 mr-2" />
            {isSubmitting ? 'Sending...' : `Send to ${SUPPORT_EMAIL}`}
          </button>
          <a
            href={isSendDisabled ? '#' : mailtoHref}
            onClick={(event) => {
              if (isSendDisabled) {
                event.preventDefault();
              }
            }}
            className="inline-flex items-center justify-center px-6 py-3 border border-bark-500 text-bark-600 rounded-xl font-semibold hover:bg-bark-50 transition-colors"
            aria-disabled={isSendDisabled}
          >
            Open in Email App
          </a>
        </div>
        {isSendDisabled && !isSubmitting && (
          <p className="text-sm text-gray-500">Add a message to enable sending.</p>
        )}
        {status === 'success' && (
          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
            <CheckCircle2 className="w-4 h-4" />
            Message sent! We will follow up shortly.
          </div>
        )}
        {status === 'error' && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            <AlertCircle className="w-4 h-4" />
            {errorMessage}
          </div>
        )}
      </form>
    </div>
  );
}
