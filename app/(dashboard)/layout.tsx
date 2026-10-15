'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar, MobileHeader } from '@/components/layout/Sidebar';
import { useAppStore } from '@/lib/store';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

const withTimeout = async <T,>(promise: PromiseLike<T>, label: string, timeoutMs = 12000): Promise<T | null> => {
  let timeoutId: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => {
          console.error(`${label} timed out`);
          resolve(null);
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeoutId!);
  }
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClientComponentClient();
  const { setRetailer, setMembership, setLocations, setProducts, setOrders } = useAppStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userResponse = await withTimeout(supabase.auth.getUser(), 'Retailer auth check');
        const user = userResponse?.data?.user;

        if (!user) {
          router.push('/login');
          return;
        }

        // If admin, route to admin dashboard instead of retailer dashboard
        const adminResponse = await withTimeout(
          supabase
            .from('admin_users')
            .select('id')
            .eq('id', user.id)
            .maybeSingle(),
          'Admin dashboard check',
        );
        const adminUser = adminResponse?.data;

        if (adminUser) {
          router.push('/admin/dashboard');
          return;
        }

        const contextResponse = await withTimeout(fetch('/api/account/context'), 'Retailer context load');
        const context = contextResponse?.ok ? await contextResponse.json() : null;
        if (!context?.retailer || !context?.membership) {
          if (contextResponse?.status === 403) {
            await supabase.auth.signOut();
            router.push('/login?access=removed');
          } else {
            router.push('/login');
          }
          return;
        }
        setRetailer(context.retailer);
        setMembership(context.membership);
        setLocations(context.locations || []);
        if (context.membership.role === 'staff') {
          const staffRoutes = ['/catalog', '/orders', '/resources', '/account'];
          if (!staffRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
            router.replace('/catalog');
            return;
          }
        }

        // Load products
        const productsResponse = await withTimeout(
          supabase
            .from('products')
            .select('*')
            .order('name', { ascending: true }),
          'Products load',
        );
        const products = productsResponse?.data;

        if (products) {
          setProducts(products);
        }

        setOrders(context.orders || []);
      } catch (error) {
        console.error('Dashboard load error:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [supabase, router, pathname, setRetailer, setMembership, setLocations, setProducts, setOrders]);

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-200 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-bark-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-bark-500/70">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full min-w-0 overflow-x-hidden bg-cream-200">
      <Sidebar />
      <MobileHeader />
      
      <main className="min-w-0 flex-1 overflow-x-hidden pt-16 lg:ml-0 lg:pt-0">
        {children}
      </main>
    </div>
  );
}
