'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Package, 
  User, 
  FolderOpen,
  MessageSquare,
  LogOut,
  Menu,
  X,
  HelpCircle,
  ExternalLink
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { createClient } from '@/lib/supabase';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Product Catalog', href: '/catalog', icon: ShoppingBag },
  { name: 'Order History', href: '/orders', icon: Package },
  { name: 'Resources', href: '/resources', icon: FolderOpen },
  { name: 'Message', href: '/messages', icon: MessageSquare },
  { name: 'Account', href: '/account', icon: User },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen, retailer, setRetailer, clearCart } = useAppStore();
  const supabase = createClient();
  const supabaseClient = createClientComponentClient();
  const [unreadCount, setUnreadCount] = useState(0);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setRetailer(null);
    clearCart();
    window.location.href = '/login';
  };

  // Get the business name - check both possible field names
  const businessName = retailer?.company_name || retailer?.business_name || 'Retailer';

  useEffect(() => {
    const fetchUnreadCount = async () => {
      if (!retailer?.id) return;

      const { data: conversation } = await supabaseClient
        .from('conversations')
        .select('id, last_read_by_retailer_at')
        .eq('retailer_id', retailer.id)
        .single();

      if (!conversation?.id) {
        setUnreadCount(0);
        return;
      }

      let query = supabaseClient
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', conversation.id)
        .eq('sender_role', 'admin');

      if (conversation.last_read_by_retailer_at) {
        query = query.gt('created_at', conversation.last_read_by_retailer_at);
      }

      const { count } = await query;
      setUnreadCount(count || 0);
    };

    fetchUnreadCount();
  }, [supabaseClient, retailer?.id]);

  useEffect(() => {
    if (pathname.startsWith('/messages')) {
      setUnreadCount(0);
    }
  }, [pathname]);

  useEffect(() => {
    if (!retailer?.id) return;

    const conversationChannel = supabaseClient
      .channel(`conversation-${retailer.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `retailer_id=eq.${retailer.id}` },
        () => {
          supabaseClient
            .from('conversations')
            .select('id, last_read_by_retailer_at')
            .eq('retailer_id', retailer.id)
            .single()
            .then(({ data }) => {
              if (!data?.id) {
                setUnreadCount(0);
                return;
              }

              let query = supabaseClient
                .from('messages')
                .select('id', { count: 'exact', head: true })
                .eq('conversation_id', data.id)
                .eq('sender_role', 'admin');

              if (data.last_read_by_retailer_at) {
                query = query.gt('created_at', data.last_read_by_retailer_at);
              }

              query.then(({ count }) => setUnreadCount(count || 0));
            });
        }
      )
      .subscribe();

    const messagesChannel = supabaseClient
      .channel(`message-notify-${retailer.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_role=eq.admin` },
        (payload) => {
          const message = payload.new as { conversation_id: string };
          supabaseClient
            .from('conversations')
            .select('id, last_read_by_retailer_at')
            .eq('retailer_id', retailer.id)
            .single()
            .then(({ data }) => {
              if (!data?.id || data.id !== message.conversation_id) return;
              setUnreadCount((current) => current + 1);
            });
        }
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(conversationChannel);
      supabaseClient.removeChannel(messagesChannel);
    };
  }, [supabaseClient, retailer?.id]);

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-bark-500/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-72 bg-cream-100 border-r border-cream-200',
          'transform transition-transform duration-300 ease-in-out',
          'lg:translate-x-0 lg:sticky lg:top-0 lg:z-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-cream-200">
            <Link href="/dashboard" className="flex items-center gap-2">
              <span className="text-xl font-bold" style={{ fontFamily: 'var(--font-poppins)' }}>
                <span className="text-bark-500">Bare Naked</span>
                <span className="text-bark-500/60"> Pet Co.</span>
              </span>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 text-bark-500/60 hover:text-bark-500 rounded-lg hover:bg-cream-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn('sidebar-link', isActive && 'active')}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="flex-1">{item.name}</span>
                  {item.name === 'Message' && unreadCount > 0 && (
                    <span className="ml-auto w-2.5 h-2.5 rounded-full bg-red-500" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Bottom section */}
          <div className="p-4 border-t border-cream-200 space-y-1">
            <a
              href="https://barenakedpet.com"
              target="_blank"
              rel="noopener noreferrer"
              className="sidebar-link"
            >
              <ExternalLink className="w-5 h-5" />
              Visit Website
            </a>
            <a
              href="mailto:info@barenakedpet.com"
              className="sidebar-link"
            >
              <HelpCircle className="w-5 h-5" />
              Get Help
            </a>
            <button
              onClick={handleLogout}
              className="sidebar-link hover:text-red-600 hover:bg-red-50 w-full"
            >
              <LogOut className="w-5 h-5" />
              Sign out
            </button>
          </div>

          {/* User info */}
          {retailer && (
            <div className="p-4 bg-cream-200 border-t border-cream-300">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-bark-500 flex items-center justify-center">
                  <span className="text-sm font-semibold text-white">
                    {getInitials(businessName)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-bark-500 truncate">
                    {businessName}
                  </p>
                  <p className="text-xs text-bark-500/60 truncate">
                    {retailer.account_number || 'New Account'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

export function MobileHeader() {
  const { setSidebarOpen, cart } = useAppStore();
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-cream-100 border-b border-cream-200 px-4 h-16 flex items-center justify-between">
      <button
        onClick={() => setSidebarOpen(true)}
        className="p-2 text-bark-500 hover:text-bark-600 rounded-lg hover:bg-cream-200 transition-colors"
      >
        <Menu className="w-6 h-6" />
      </button>
      <Link href="/dashboard" className="font-bold text-lg" style={{ fontFamily: 'var(--font-poppins)' }}>
        <span className="text-bark-500">Bare Naked</span>
        <span className="text-bark-500/60"> Pet Co.</span>
      </Link>
      <Link href="/catalog" className="relative p-2">
        <ShoppingBag className="w-6 h-6 text-bark-500" />
        {cartCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-bark-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {cartCount}
          </span>
        )}
      </Link>
    </header>
  );
}
