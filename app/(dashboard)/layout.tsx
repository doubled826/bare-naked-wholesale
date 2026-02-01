'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar, MobileHeader } from '@/components/layout/Sidebar';
import { useAppStore } from '@/lib/store';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

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
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }

      // Load retailer data
      const { data: retailer } = await supabase
        .from('retailers')
        .select('*')
        .eq('id', user.id)
        .single();

      if (retailer) {
        setRetailer({ ...retailer, email: user.email });
      }

      // Load products
      const { data: products } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true });

      if (products) {
        setProducts(products);
      }

      // Load orders
      const { data: orders } = await supabase
        .from('orders')
        .select(`*, order_items(*, product_id)`)
        .eq('retailer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (orders) {
        setOrders(orders);
      }

      setLoading(false);
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
    <div className="flex min-h-screen bg-cream-200">
      <Sidebar />
      <MobileHeader />
      
      <main className="flex-1 lg:ml-0 pt-16 lg:pt-0">
        {children}
      </main>
    </div>
  );
}
