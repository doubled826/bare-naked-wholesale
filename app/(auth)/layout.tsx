'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const isAdminView = searchParams.get('admin') === '1';

  return (
    <div
      className={cn(
        'min-h-screen flex flex-col',
        isAdminView ? 'bg-bark-500' : 'bg-cream-200'
      )}
    >
      {/* Header */}
      <header className="p-6">
        <Link href="/" className="inline-block">
          <span className="text-xl font-bold" style={{ fontFamily: 'var(--font-poppins)' }}>
            <span className={isAdminView ? 'text-cream-100' : 'text-bark-500'}>Bare Naked</span>
            <span className={isAdminView ? 'text-cream-200/80' : 'text-bark-500/60'}> Pet Co.</span>
          </span>
        </Link>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-6">
        {children}
      </main>

      {/* Footer */}
      <footer
        className={cn(
          'p-6 text-center text-sm',
          isAdminView ? 'text-cream-200/70' : 'text-bark-500/60'
        )}
      >
        <p>© 2026 Bare Naked Pet Co. All rights reserved.</p>
        <p className="mt-1">
          Need help?{' '}
          <a
            href="mailto:info@barenakedpet.com"
            className={cn(isAdminView ? 'text-cream-100 hover:underline' : 'text-bark-500 hover:underline')}
          >
            Contact us
          </a>
        </p>
      </footer>
    </div>
  );
}
