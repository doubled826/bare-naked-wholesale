'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
      } else {
        const session = data?.session;
        const adminCheck = await fetch('/api/admin/check', {
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
        });
        const adminData = await adminCheck.json();
        if (adminData?.isAdmin) {
          router.push('/admin/dashboard');
        } else {
          router.push('/dashboard');
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md animate-fade-in">
      <div className="card-elevated p-8 md:p-10">
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold mb-2 text-bark-500" style={{ fontFamily: 'var(--font-poppins)' }}>
            Welcome back
          </h1>
          <p className="text-bark-500/70">
            Sign in to access your wholesale portal
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 animate-slide-up">
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
              autoComplete="email"
              autoFocus
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="password" className="label mb-0">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-bark-500 hover:text-bark-600"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input pr-12"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-bone-400 hover:text-bark-500 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full group"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Sign in
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-cream-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-cream-100 text-bark-500/60">New retailer?</span>
          </div>
        </div>

        <Link href="/signup" className="btn-secondary w-full">
          Create an account
        </Link>

      </div>

      <div className="mt-6 flex items-center justify-center gap-4 text-sm">
        <div className="flex items-center gap-2 rounded-full px-3 py-2 font-medium bg-cream-200 text-bark-500">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/90 text-white text-xs">✓</span>
          No Minimums
        </div>
        <div className="flex items-center gap-2 rounded-full px-3 py-2 font-medium bg-cream-200 text-bark-500">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/90 text-white text-xs">✓</span>
          Free Shipping
        </div>
      </div>

    </div>
  );
}
