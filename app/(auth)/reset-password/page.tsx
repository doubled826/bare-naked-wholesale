'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Lock, CheckCircle } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const bootstrapSession = async () => {
      setError('');

      try {
        const hash = window.location.hash.startsWith('#')
          ? window.location.hash.slice(1)
          : '';
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            setError('This reset link is invalid or has expired.');
            setIsSessionReady(false);
          } else {
            setIsSessionReady(true);
            window.history.replaceState(null, '', '/reset-password');
          }
        } else {
          const { data: { session } } = await supabase.auth.getSession();
          setIsSessionReady(!!session);
          if (!session) {
            setError('This reset link is invalid or has expired.');
          }
        }
      } catch (err) {
        setError('This reset link is invalid or has expired.');
        setIsSessionReady(false);
      } finally {
        setIsReady(true);
      }
    };

    bootstrapSession();
  }, [supabase.auth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (!newPassword || !confirmPassword) {
        setError('Please enter and confirm your new password.');
        return;
      }

      if (newPassword !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }

      if (newPassword.length < 8) {
        setError('Password must be at least 8 characters.');
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError(updateError.message);
      } else {
        setSuccess(true);
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isReady) {
    return (
      <div className="w-full max-w-md animate-fade-in">
        <div className="card-elevated p-8 md:p-10 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-bark-500" />
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="w-full max-w-md animate-fade-in">
        <div className="card-elevated p-8 md:p-10 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-bark-500 mb-2" style={{ fontFamily: 'var(--font-poppins)' }}>
            Password updated
          </h1>
          <p className="text-bark-500/70 mb-6">
            Your password has been reset. You can now sign in with your new password.
          </p>
          <Link href="/login" className="btn-primary w-full">
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md animate-fade-in">
      <div className="card-elevated p-8 md:p-10">
        <button
          type="button"
          onClick={() => router.push('/login')}
          className="inline-flex items-center gap-2 text-sm text-bark-500/70 hover:text-bark-500 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to sign in
        </button>

        <div className="mb-8">
          <div className="w-12 h-12 bg-cream-200 rounded-xl flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-bark-500" />
          </div>
          <h1 className="text-2xl font-bold text-bark-500 mb-2" style={{ fontFamily: 'var(--font-poppins)' }}>
            Reset your password
          </h1>
          <p className="text-bark-500/70">
            Choose a new password for your account.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            {error}
          </div>
        )}

        {!isSessionReady && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
            Please request a new reset link to continue.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="newPassword" className="label">
              New password
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="input"
              required
              autoComplete="new-password"
              disabled={!isSessionReady}
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="label">
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="input"
              required
              autoComplete="new-password"
              disabled={!isSessionReady}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !isSessionReady}
            className="btn-primary w-full"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Update password'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
