'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  const supabase = createClientComponentClient();
  const { setRetailer, setProducts, setOrders } = useAppStore();
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

        // Load retailer data
        const retailerResponse = await withTimeout(
          supabase
            .from('retailers')
            .select('*')
            .eq('id', user.id)
            .single(),
          'Retailer profile load',
        );
        const retailer = retailerResponse?.data;

        if (retailer) {
          setRetailer({ ...retailer, email: user.email });
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

        // Load orders
        const ordersResponse = await withTimeout(
          supabase
            .from('orders')
            .select(`*, location:retailer_locations(id, location_name, business_address, phone), order_items(*, product_id)`)
            .eq('retailer_id', user.id)
            .order('created_at', { ascending: false })
            .limit(50),
          'Orders load',
        );
        const orders = ordersResponse?.data;

        if (orders) {
          setOrders(orders);
        }
      } catch (error) {
        console.error('Dashboard load error:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [supabase, router, setRetailer, setProducts, setOrders]);

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
