'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, ExternalLink, Loader2, Store } from 'lucide-react';

export default function WholesaleLeadVerifyPage() {
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const [storeUrl, setStoreUrl] = useState('');
  const [socialUrl, setSocialUrl] = useState('');
  const [googleProfileUrl, setGoogleProfileUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('submitting');
    setMessage('');

    try {
      const response = await fetch('/api/wholesale-leads/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          storeUrl,
          socialUrl,
          googleProfileUrl,
          notes,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.success) {
        throw new Error(payload.error || 'Unable to submit store verification.');
      }

      setStatus('success');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Unable to submit store verification.');
    }
  };

  return (
    <main className="min-h-screen bg-[#f8f4ec] px-4 py-10 text-gray-900">
      <section className="mx-auto max-w-2xl rounded-2xl border border-[#eadfce] bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#7a4f2a]">Bare Naked Pet Co.</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#3b2a1e]">Verify your store</h1>
        <p className="mt-3 text-base leading-7 text-[#6b5f55]">
          Before we send wholesale samples, we verify that each request is connected to an active retail store. Share whichever details best help confirm your store.
        </p>

        {status === 'success' ? (
          <div className="mt-8 rounded-xl border border-green-200 bg-green-50 p-5">
            <CheckCircle className="h-8 w-8 text-green-700" />
            <h2 className="mt-3 text-xl font-bold text-green-950">Verification sent</h2>
            <p className="mt-2 text-sm leading-6 text-green-900">
              Thanks. Our team received your store details and will review the sample request.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            {!token ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                This verification link is missing a token. Please reply to the email and we can help directly.
              </div>
            ) : null}

            <label className="block">
              <span className="flex items-center gap-2 text-sm font-bold text-[#3b2a1e]">
                <Store className="h-4 w-4" />
                Store website
              </span>
              <input
                value={storeUrl}
                onChange={(event) => setStoreUrl(event.target.value)}
                className="mt-2 w-full rounded-lg border border-[#d9c7ac] bg-white px-4 py-3 text-sm text-[#3b2a1e] shadow-sm focus:border-[#3b2a1e] focus:outline-none focus:ring-2 focus:ring-[#3b2a1e]/20"
                placeholder="https://yourstore.com"
              />
            </label>

            <label className="block">
              <span className="flex items-center gap-2 text-sm font-bold text-[#3b2a1e]">
                <ExternalLink className="h-4 w-4" />
                Instagram, Facebook, or other social profile
              </span>
              <input
                value={socialUrl}
                onChange={(event) => setSocialUrl(event.target.value)}
                className="mt-2 w-full rounded-lg border border-[#d9c7ac] bg-white px-4 py-3 text-sm text-[#3b2a1e] shadow-sm focus:border-[#3b2a1e] focus:outline-none focus:ring-2 focus:ring-[#3b2a1e]/20"
                placeholder="https://instagram.com/yourstore"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-[#3b2a1e]">Google Business Profile</span>
              <input
                value={googleProfileUrl}
                onChange={(event) => setGoogleProfileUrl(event.target.value)}
                className="mt-2 w-full rounded-lg border border-[#d9c7ac] bg-white px-4 py-3 text-sm text-[#3b2a1e] shadow-sm focus:border-[#3b2a1e] focus:outline-none focus:ring-2 focus:ring-[#3b2a1e]/20"
                placeholder="Google profile link, if available"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-[#3b2a1e]">Anything else that helps us verify your store</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={5}
                className="mt-2 w-full rounded-lg border border-[#d9c7ac] bg-white px-4 py-3 text-sm text-[#3b2a1e] shadow-sm focus:border-[#3b2a1e] focus:outline-none focus:ring-2 focus:ring-[#3b2a1e]/20"
                placeholder="Storefront details, business address notes, distributor info, resale certificate availability, or context about your request."
              />
            </label>

            {status === 'error' ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{message}</div>
            ) : null}

            <button
              type="submit"
              disabled={!token || status === 'submitting'}
              className="inline-flex w-full items-center justify-center rounded-lg bg-[#3b2a1e] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#2a1d14] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === 'submitting' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Submit verification
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
