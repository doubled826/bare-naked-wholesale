'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Mail, CheckCircle } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function ForgotPasswordPage() {
  const supabase = createClientComponentClient();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        setError(error.message);
      } else {
        setSuccess(true);
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="w-full max-w-md animate-fade-in">
        <div className="card-elevated p-8 md:p-10 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-bark-500 mb-2" style={{ fontFamily: 'var(--font-poppins)' }}>
            Check your email
          </h1>
          <p className="text-bark-500/70 mb-6">
            We have sent password reset instructions to <strong>{email}</strong>.
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
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm text-bark-500/70 hover:text-bark-500 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to sign in
        </Link>

        <div className="mb-8">
          <div className="w-12 h-12 bg-cream-200 rounded-xl flex items-center justify-center mb-4">
            <Mail className="w-6 h-6 text-bark-500" />
          </div>
          <h1 className="text-2xl font-bold text-bark-500 mb-2" style={{ fontFamily: 'var(--font-poppins)' }}>
            Forgot password?
          </h1>
          <p className="text-bark-500/70">
            No worries, we will send you reset instructions.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="label">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="retailer@store.com"
              className="input"
              required
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Reset password'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
