'use client';

import { useMemo, useState } from 'react';
import { Mail, MessageSquare, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/lib/store';

const SUPPORT_EMAIL = 'info@barenakedpet.com';

export default function MessagesPage() {
  const { retailer } = useAppStore();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const businessName = retailer?.company_name || retailer?.business_name || 'Retailer';
  const accountNumber = retailer?.account_number || 'New Account';
  const replyTo = retailer?.email || '';

  const emailBody = useMemo(() => {
    const lines = [message.trim() || '(No message entered)', '', '--', `Retailer: ${businessName}`];
    lines.push(`Account: ${accountNumber}`);
    if (replyTo) {
      lines.push(`Email: ${replyTo}`);
    }
    return lines.join('\n');
  }, [message, businessName, accountNumber, replyTo]);

  const mailtoHref = useMemo(() => {
    const subjectValue = subject.trim() || 'Retailer Message';
    return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subjectValue)}&body=${encodeURIComponent(emailBody)}`;
  }, [subject, emailBody]);

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
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="card relative overflow-hidden p-6 lg:p-8">
        <div className="absolute inset-0 pattern-dots opacity-40" />
        <div className="relative z-10 space-y-3">
          <p className="text-sm font-semibold text-bark-500/70 tracking-wide uppercase">Retailer Message</p>
          <h1 className="page-title">Message the Bare Naked Team</h1>
          <p className="text-bark-500/70 max-w-2xl">
            Send a quick note to our team and we will route it to the right person. This sends directly to
            {` ${SUPPORT_EMAIL}`} and we will reply to your inbox.
          </p>
          <div className="flex flex-wrap items-center gap-3 text-sm text-bark-500/70">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cream-200">
              <ShieldCheck className="w-4 h-4" />
              Routed to the full team
            </span>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cream-200">
              <MessageSquare className="w-4 h-4" />
              Replies land in your inbox
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 lg:p-8 space-y-6">
        <div>
          <label className="label" htmlFor="subject">Subject</label>
          <input
            id="subject"
            type="text"
            className="input"
            placeholder="Pricing question, delivery timing, merchandising..."
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="message">Message</label>
          <textarea
            id="message"
            className="input min-h-[160px]"
            placeholder="Tell us how we can help."
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <button type="submit" className="btn-primary" disabled={isSendDisabled}>
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
            className="btn-secondary"
            aria-disabled={isSendDisabled}
          >
            Open in Email App
          </a>
        </div>
        {isSendDisabled && !isSubmitting && (
          <p className="text-sm text-bark-500/60">Add a message to enable sending.</p>
        )}
        {status === 'success' && (
          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
            <CheckCircle2 className="w-4 h-4" />
            Message sent! We will reply to your email soon.
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
