'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const searchParams = useSearchParams();
  const isAdminView = searchParams.get('admin') === '1';
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
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('id')
          .eq('id', user?.id || '')
          .single();
        if (adminUser) {
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
      <div className={cn('card-elevated p-8 md:p-10', isAdminView && 'bg-bark-500 text-cream-100 border-bark-500')}>
        <div className="text-center mb-8">
          <h1 className={cn('text-2xl md:text-3xl font-bold mb-2', isAdminView ? 'text-cream-100' : 'text-bark-500')} style={{ fontFamily: 'var(--font-poppins)' }}>
            Welcome back
          </h1>
          {isAdminView && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full bg-cream-100 text-bark-500">
              Admin mode
            </span>
          )}
          <p className={cn(isAdminView ? 'text-cream-200/80' : 'text-bark-500/70')}>
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
            <label htmlFor="email" className={cn('label', isAdminView && 'text-cream-100')}>
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="retailer@store.com"
              className={cn('input', isAdminView && 'bg-bark-400/60 border-bark-400 text-cream-100 placeholder:text-cream-200/60')}
              required
              autoComplete="email"
              autoFocus
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="password" className={cn('label mb-0', isAdminView && 'text-cream-100')}>
                Password
              </label>
              <Link
                href="/forgot-password"
                className={cn('text-sm font-medium', isAdminView ? 'text-cream-200 hover:text-cream-100' : 'text-bark-500 hover:text-bark-600')}
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
                className={cn('input pr-12', isAdminView && 'bg-bark-400/60 border-bark-400 text-cream-100 placeholder:text-cream-200/60')}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={cn('absolute right-4 top-1/2 -translate-y-1/2 transition-colors', isAdminView ? 'text-cream-200/60 hover:text-cream-100' : 'text-bone-400 hover:text-bark-500')}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={cn('btn-primary w-full group', isAdminView && 'bg-cream-100 text-bark-500 hover:bg-cream-200')}
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
            <div className={cn('w-full', isAdminView ? 'border-t border-bark-400' : 'border-t border-cream-200')} />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className={cn('px-4', isAdminView ? 'bg-bark-500 text-cream-200/80' : 'bg-cream-100 text-bark-500/60')}>New retailer?</span>
          </div>
        </div>

        <Link href="/signup" className={cn('btn-secondary w-full', isAdminView && 'border-cream-200 text-cream-100 hover:bg-bark-400/60')}>
          Create an account
        </Link>

        <button
          type="button"
          onClick={() => {
            const params = new URLSearchParams(searchParams.toString());
            if (isAdminView) {
              params.delete('admin');
            } else {
              params.set('admin', '1');
            }
            const qs = params.toString();
            router.replace(`/login${qs ? `?${qs}` : ''}`);
          }}
          className={cn('mt-6 text-xs font-medium', isAdminView ? 'text-cream-200 hover:text-cream-100' : 'text-bark-500/70 hover:text-bark-500')}
        >
          {isAdminView ? 'Switch to Retailer Login' : 'Admin Login'}
        </button>
      </div>

    </div>
  );
}
