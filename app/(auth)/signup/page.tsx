'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { Eye, EyeOff, ArrowRight, Loader2, CheckCircle } from 'lucide-react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

export default function SignupPage() {
  const [formData, setFormData] = useState({
    businessName: '',
    businessStreet: '',
    businessCity: '',
    businessState: '',
    businessZip: '',
    name: '',
    email: '',
    password: '',
    phone: '',
    taxId: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileReady, setTurnstileReady] = useState(false);
  const turnstileRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!turnstileReady || !turnstileSiteKey || !turnstileRef.current || !window.turnstile || widgetIdRef.current) {
      return;
    }

    widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
      sitekey: turnstileSiteKey,
      callback: (token) => {
        setTurnstileToken(token);
        setError('');
      },
      'expired-callback': () => {
        setTurnstileToken('');
      },
      'error-callback': () => {
        setTurnstileToken('');
        setError('Verification failed to load. Please refresh and try again.');
      },
    });

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [turnstileReady]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!turnstileSiteKey) {
      setError('Signup verification is not configured yet.');
      return;
    }

    if (!turnstileToken) {
      setError('Please complete the verification before creating your account.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, turnstileToken }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
      } else {
        setError(data.error || 'Signup failed. Please try again.');
        setTurnstileToken('');
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.reset(widgetIdRef.current);
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      setTurnstileToken('');
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Success state - show congratulations message
  if (success) {
    return (
      <div className="w-full max-w-md animate-fade-in">
        <div className="card-elevated p-8 md:p-10 text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-bark-500 mb-2" style={{ fontFamily: 'var(--font-poppins)' }}>
            Congratulations! 🎉
          </h1>
          <p className="text-bark-500/70 mb-2">
            Your wholesale account has been created successfully.
          </p>
          <p className="text-bark-500/70 mb-8">
            You can now sign in with your email <strong>{formData.email}</strong> and start shopping at wholesale prices!
          </p>
          <Link href="/login" className="btn-primary w-full">
            Sign In to Your Account
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md animate-fade-in">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setTurnstileReady(true)}
      />

      {/* Card */}
      <div className="card-elevated p-8 md:p-10">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-bark-500 mb-2" style={{ fontFamily: 'var(--font-poppins)' }}>
            Create Wholesale Account
          </h1>
          <p className="text-bark-500/70">
            Join our network of premium pet retailers
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 animate-slide-up">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Business Name */}
          <div>
            <label htmlFor="businessName" className="label">
              Business Name
            </label>
            <input
              id="businessName"
              name="businessName"
              type="text"
              value={formData.businessName}
              onChange={handleChange}
              placeholder="Pet Paradise Boutique"
              className="input"
              autoComplete="organization"
              required
            />
          </div>

          {/* Business Address */}
          <div>
            <label htmlFor="businessStreet" className="label">
              Business Address
            </label>
            <div className="space-y-3">
              <input
                id="businessStreet"
                name="businessStreet"
                type="text"
                value={formData.businessStreet}
                onChange={handleChange}
                placeholder="123 Main St"
                className="input"
                autoComplete="address-line1"
                required
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  id="businessCity"
                  name="businessCity"
                  type="text"
                  value={formData.businessCity}
                  onChange={handleChange}
                  placeholder="City"
                  className="input"
                  autoComplete="address-level2"
                  required
                />
                <input
                  id="businessState"
                  name="businessState"
                  type="text"
                  value={formData.businessState}
                  onChange={handleChange}
                  placeholder="State"
                  className="input"
                  autoComplete="address-level1"
                  required
                />
                <input
                  id="businessZip"
                  name="businessZip"
                  type="text"
                  value={formData.businessZip}
                  onChange={handleChange}
                  placeholder="ZIP"
                  className="input"
                  autoComplete="postal-code"
                  inputMode="numeric"
                  required
                />
              </div>
            </div>
          </div>

          {/* Contact Name */}
          <div>
            <label htmlFor="name" className="label">
              Your Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              placeholder="John Smith"
              className="input"
              autoComplete="name"
              required
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="label">
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="orders@petparadise.com"
              className="input"
              autoComplete="email"
              required
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="label">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                className="input pr-12"
                required
                minLength={6}
                autoComplete="new-password"
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

          {/* Phone */}
          <div>
            <label htmlFor="phone" className="label">
              Phone Number
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
              placeholder="(555) 123-4567"
              className="input"
              autoComplete="tel"
              required
            />
          </div>

          {/* Tax ID / EIN */}
          <div>
            <label htmlFor="taxId" className="label">
              Tax ID / EIN
            </label>
            <input
              id="taxId"
              name="taxId"
              type="text"
              value={formData.taxId}
              onChange={handleChange}
              placeholder="XX-XXXXXXX"
              className="input"
              required
            />
          </div>

          <div>
            <label className="label">Verification</label>
            {turnstileSiteKey ? (
              <div ref={turnstileRef} />
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Signup verification is not configured yet.
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading || !turnstileSiteKey}
            className="btn-primary w-full group mt-6"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Create Account
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        {/* Sign in link */}
        <p className="mt-6 text-center text-sm text-bark-500/70">
          Already have an account?{' '}
          <Link href="/login" className="text-bark-500 hover:text-bark-600 font-medium">
            Sign in
          </Link>
        </p>
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
