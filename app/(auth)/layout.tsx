'use client';

import Link from 'next/link';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-cream-200 flex flex-col">
      {/* Header */}
      <header className="p-6">
        <Link href="/" className="inline-block">
          <span className="text-xl font-bold" style={{ fontFamily: 'var(--font-poppins)' }}>
            <span className="text-bark-500">Bare Naked</span>
            <span className="text-bark-500/60"> Pet Co.</span>
          </span>
        </Link>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="p-6 text-center text-sm text-bark-500/60">
        <p>© 2026 Bare Naked Pet Co. All rights reserved.</p>
        <p className="mt-1">
          Need help?{' '}
          <a href="mailto:info@barenakedpet.com" className="text-bark-500 hover:underline">
            Contact us
          </a>
        </p>
      </footer>
    </div>
  );
}
