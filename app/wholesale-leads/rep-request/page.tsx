'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, Loader2, Mail, MessageSquare, Phone } from 'lucide-react';

const contactMethods = [
  { value: 'call', label: 'Call', icon: Phone },
  { value: 'text', label: 'Text', icon: MessageSquare },
  { value: 'email', label: 'Email', icon: Mail },
];

const bestTimes = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
  { value: 'anytime', label: 'Anytime' },
];

export default function WholesaleLeadRepRequestPage() {
  const searchParams = useSearchParams();
  const leadId = useMemo(() => searchParams.get('lead') || '', [searchParams]);
  const [contactMethod, setContactMethod] = useState('call');
  const [bestTimeOfDay, setBestTimeOfDay] = useState('morning');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('submitting');
    setMessage('');

    try {
      const response = await fetch('/api/wholesale-leads/rep-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          contactMethod,
          bestTimeOfDay,
          notes,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || 'Unable to request rep outreach.');
      }

      setStatus('success');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Unable to request rep outreach.');
    }
  };

  return (
    <main className="min-h-screen bg-[#f8f4ec] px-4 py-10 text-gray-900">
      <section className="mx-auto max-w-2xl rounded-2xl border border-[#eadfce] bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#7a4f2a]">Bare Naked Pet Co.</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#3b2a1e]">Want to talk with a rep?</h1>
        <p className="mt-3 text-base leading-7 text-[#6b5f55]">
          Tell us how and when you would like us to reach out. We will send this directly to our team so someone can follow up with you.
        </p>

        {status === 'success' ? (
          <div className="mt-8 rounded-xl border border-green-200 bg-green-50 p-5">
            <CheckCircle className="h-8 w-8 text-green-700" />
            <h2 className="mt-3 text-xl font-bold text-green-950">Request sent</h2>
            <p className="mt-2 text-sm leading-6 text-green-900">
              Thanks. We received your request and someone from Bare Naked Pet Co. will reach out soon.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            {!leadId ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                This request link is missing a lead ID. Please reply to the email and we can help directly.
              </div>
            ) : null}

            <div>
              <label className="text-sm font-bold text-[#3b2a1e]">How should we contact you?</label>
              <div className="mt-3 grid grid-cols-3 gap-3">
                {contactMethods.map((method) => {
                  const Icon = method.icon;
                  const isSelected = contactMethod === method.value;
                  return (
                    <button
                      key={method.value}
                      type="button"
                      onClick={() => setContactMethod(method.value)}
                      className={`flex min-h-[88px] flex-col items-center justify-center rounded-lg border px-3 text-sm font-semibold transition ${
                        isSelected
                          ? 'border-[#3b2a1e] bg-[#3b2a1e] text-white'
                          : 'border-[#eadfce] bg-[#fbf7ed] text-[#3b2a1e] hover:border-[#7a4f2a]'
                      }`}
                    >
                      <Icon className="mb-2 h-5 w-5" />
                      {method.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label htmlFor="best-time" className="text-sm font-bold text-[#3b2a1e]">Best time of day</label>
              <select
                id="best-time"
                value={bestTimeOfDay}
                onChange={(event) => setBestTimeOfDay(event.target.value)}
                className="mt-2 w-full rounded-lg border border-[#d9c7ac] bg-white px-4 py-3 text-sm text-[#3b2a1e] shadow-sm focus:border-[#3b2a1e] focus:outline-none focus:ring-2 focus:ring-[#3b2a1e]/20"
              >
                {bestTimes.map((time) => (
                  <option key={time.value} value={time.value}>{time.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="notes" className="text-sm font-bold text-[#3b2a1e]">Anything specific you want to discuss? <span className="font-normal text-[#9a8e82]">(optional)</span></label>
              <textarea
                id="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={4}
                className="mt-2 w-full rounded-lg border border-[#d9c7ac] bg-white px-4 py-3 text-sm text-[#3b2a1e] shadow-sm focus:border-[#3b2a1e] focus:outline-none focus:ring-2 focus:ring-[#3b2a1e]/20"
                placeholder="Pricing, first order help, sample feedback, promo planning..."
              />
            </div>

            {status === 'error' ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{message}</div>
            ) : null}

            <button
              type="submit"
              disabled={!leadId || status === 'submitting'}
              className="inline-flex w-full items-center justify-center rounded-lg bg-[#3b2a1e] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#2a1d14] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === 'submitting' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Request rep outreach
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
