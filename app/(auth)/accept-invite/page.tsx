'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, Loader2, Users } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function AcceptInvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClientComponentClient();
  const [state, setState] = useState<'loading' | 'ready' | 'saving' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Confirming your invitation...');
  const [invitationId, setInvitationId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const nextInvitationId = searchParams.get('invitation');
        if (!nextInvitationId) throw new Error('This invitation link is incomplete.');
        setInvitationId(nextInvitationId);

        const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (error) throw error;
          window.history.replaceState(null, '', `/accept-invite?invitation=${encodeURIComponent(nextInvitationId)}`);
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('This invitation has expired. Ask the account owner to resend it.');

        setState('ready');
        setMessage('Create a password to finish setting up your staff login.');
      } catch (error) {
        setState('error');
        setMessage(error instanceof Error ? error.message : 'Unable to accept this invitation.');
      }
    };
    bootstrap();
  }, [searchParams, supabase.auth]);

  const handleAccept = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) {
      setMessage('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }

    setState('saving');
    setMessage('Creating your login...');
    try {
      const { error: passwordError } = await supabase.auth.updateUser({ password });
      if (passwordError) throw passwordError;
      const response = await fetch('/api/team/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to accept this invitation.');
      setState('success');
      setMessage('Your staff access is ready.');
      setTimeout(() => router.replace('/dashboard'), 1200);
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Unable to accept this invitation.');
    }
  };

  return (
    <div className="w-full max-w-md animate-fade-in">
      <div className="card-elevated p-8 md:p-10 text-center">
        <div className="w-16 h-16 bg-cream-200 rounded-full flex items-center justify-center mx-auto mb-6">
          {(state === 'loading' || state === 'saving') && <Loader2 className="w-8 h-8 animate-spin text-bark-500" />}
          {state === 'success' && <CheckCircle className="w-8 h-8 text-emerald-600" />}
          {(state === 'ready' || state === 'error') && <Users className="w-8 h-8 text-bark-500" />}
        </div>
        <h1 className="text-2xl font-bold text-bark-500 mb-3" style={{ fontFamily: 'var(--font-poppins)' }}>
          {state === 'loading' || state === 'saving' ? 'Joining your store' : state === 'ready' ? 'Create your staff login' : state === 'success' ? 'Invitation accepted' : 'Invitation unavailable'}
        </h1>
        <p className="text-bark-500/70 mb-6">{message}</p>
        {state === 'ready' && (
          <form onSubmit={handleAccept} className="space-y-4 text-left">
            <div>
              <label className="label">Password</label>
              <input type="password" className="input" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required />
            </div>
            <div>
              <label className="label">Confirm password</label>
              <input type="password" className="input" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" required />
            </div>
            <button type="submit" className="btn-primary w-full">Accept invitation</button>
          </form>
        )}
        {state === 'error' && <Link href="/login" className="btn-primary w-full">Go to sign in</Link>}
      </div>
    </div>
  );
}
