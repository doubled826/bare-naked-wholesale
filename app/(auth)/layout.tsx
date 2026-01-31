import Link from 'next/link';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-cream-200 pattern-dots">
      {/* Decorative gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-cream-100/50 via-transparent to-bark-500/5 pointer-events-none" />
      
      <div className="relative min-h-screen flex flex-col">
        {/* Header */}
        <header className="p-6">
          <Link 
            href="https://barenakedpet.com" 
            className="inline-flex items-center gap-2 text-2xl font-bold text-bark-500 hover:text-bark-600 transition-colors"
            style={{ fontFamily: 'var(--font-poppins)' }}
          >
            <span>Bare Naked</span>
            <span className="text-bark-500/60">Pet Co.</span>
          </Link>
        </header>

        {/* Main content */}
        <main className="flex-1 flex items-center justify-center p-6">
          {children}
        </main>

        {/* Footer */}
        <footer className="p-6 text-center">
          <p className="text-sm text-bark-500/70">
            © 2026 Bare Naked Pet Co. All rights reserved.
          </p>
          <p className="text-xs text-bark-500/50 mt-1">
            Need help?{' '}
            <a 
              href="mailto:info@barenakedpet.com" 
              className="text-bark-500 hover:text-bark-600 underline"
            >
              Contact us
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}
