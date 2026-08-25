'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Package,
  FolderOpen,
  Image,
  BarChart2,
  MessageSquare,
  Mail,
  FileText,
  BadgePercent,
  Megaphone,
  User,
  LogOut,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  Workflow,
  Send,
  Zap,
  ClipboardList,
  Target
} from 'lucide-react';
import { cn } from '@/lib/utils';

type NavigationItem = {
  name: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: Array<{
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
  }>;
};

const navigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { name: 'Insights', href: '/admin/insights', icon: BarChart2 },
  { name: 'Sales Hub', href: '/admin/sales-hub', icon: Zap },
  { name: 'Wholesale Pipeline', href: '/admin/wholesale-pipeline', icon: ClipboardList },
  { name: 'Orders', href: '/admin/orders', icon: ShoppingCart },
  { name: 'Retailers', href: '/admin/retailers', icon: Users },
  {
    name: 'Community',
    icon: MessageSquare,
    children: [
      { name: 'Feed', href: '/admin/feed', icon: MessageSquare },
      { name: 'Messages', href: '/admin/messages', icon: Mail },
    ],
  },
  {
    name: 'Marketing',
    icon: Megaphone,
    children: [
      { name: 'Campaigns', href: '/admin/email-campaigns', icon: Send },
      { name: 'Audiences', href: '/admin/audiences', icon: Target },
      { name: 'Discounts', href: '/admin/discounts', icon: BadgePercent },
      { name: 'Automations', href: '/admin/automations', icon: Workflow },
      { name: 'Announcements', href: '/admin/announcements', icon: Megaphone },
      { name: 'Templates', href: '/admin/email-templates', icon: FileText },
    ],
  },
  {
    name: 'Library',
    icon: FolderOpen,
    children: [
      { name: 'Images', href: '/admin/library/images', icon: Image },
      { name: 'Products', href: '/admin/products', icon: Package },
      { name: 'Resources', href: '/admin/resources', icon: FolderOpen },
    ],
  },
  { name: 'Account', href: '/admin/account', icon: User },
];

const findNavigationTitle = (pathname: string) => {
  for (const item of navigation) {
    if (item.href === pathname) return item.name;

    const child = item.children?.find((childItem) => pathname === childItem.href || pathname.startsWith(`${childItem.href}/`));
    if (child) return child.name;
  }

  return 'Admin';
};

const getInitialOpenGroups = (pathname: string) =>
  navigation.reduce<Record<string, boolean>>((groups, item) => {
    if (item.children?.some((child) => pathname === child.href || pathname.startsWith(`${child.href}/`))) {
      groups[item.name] = true;
    }
    return groups;
  }, {});

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClientComponentClient();
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminName, setAdminName] = useState('Admin');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => getInitialOpenGroups(pathname));

  useEffect(() => {
    checkAdminAccess();
  }, []);

  useEffect(() => {
    setOpenGroups((current) => ({ ...current, ...getInitialOpenGroups(pathname) }));
  }, [pathname]);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      // Check if user is an admin
      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!adminUser) {
        // Not an admin, redirect to regular dashboard
        router.push('/dashboard');
        return;
      }

      setAdminName(adminUser.name || user.email || 'Admin');
      setIsAdmin(true);
    } catch (error) {
      console.error('Admin check error:', error);
      router.push('/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-bark-500"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-50 h-dvh w-64 bg-bark-500 transform transition-transform duration-200 ease-in-out lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-full min-h-0 flex-col">
          {/* Logo */}
          <div className="p-6 border-b border-bark-400">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-white" style={{ fontFamily: 'var(--font-poppins)' }}>
                  Bare Naked Pet Co.
                </h1>
                <p className="text-cream-300 text-sm mt-1">Admin Portal</p>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-4">
            {navigation.map((item) => {
              const isGroup = Boolean(item.children?.length);
              const isActive = item.href ? pathname === item.href || pathname.startsWith(`${item.href}/`) : false;
              const isChildActive = item.children?.some((child) => pathname === child.href || pathname.startsWith(`${child.href}/`)) || false;
              const isOpen = openGroups[item.name] || isChildActive;

              if (isGroup) {
                return (
                  <div key={item.name} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setOpenGroups((current) => ({ ...current, [item.name]: !isOpen }))}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                        isChildActive
                          ? "bg-cream-100 text-bark-500"
                          : "text-cream-200 hover:bg-bark-400 hover:text-white"
                      )}
                    >
                      <item.icon className="w-5 h-5" />
                      {item.name}
                      {isOpen ? <ChevronDown className="w-4 h-4 ml-auto" /> : <ChevronRight className="w-4 h-4 ml-auto" />}
                    </button>
                    {isOpen && (
                      <div className="ml-8 space-y-1 border-l border-bark-400 pl-3">
                        {item.children?.map((child) => {
                          const childActive = pathname === child.href || pathname.startsWith(`${child.href}/`);
                          return (
                            <Link
                              key={child.name}
                              href={child.href}
                              onClick={() => setSidebarOpen(false)}
                              className={cn(
                                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                                childActive
                                  ? "bg-cream-100 text-bark-500"
                                  : "text-cream-200 hover:bg-bark-400 hover:text-white"
                              )}
                            >
                              <child.icon className="w-4 h-4" />
                              {child.name}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={item.name}
                  href={item.href || '#'}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                    isActive
                      ? "bg-cream-100 text-bark-500"
                      : "text-cream-200 hover:bg-bark-400 hover:text-white"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                  {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="shrink-0 border-t border-bark-400 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-10 h-10 rounded-full bg-cream-100 flex items-center justify-center">
                <span className="text-bark-500 font-bold">
                  {adminName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{adminName}</p>
                <p className="text-cream-300 text-xs">Administrator</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-cream-200 hover:bg-bark-400 hover:text-white transition-colors text-sm font-medium mt-2"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-4 lg:px-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            >
              <Menu className="w-6 h-6 text-gray-600" />
            </button>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900" style={{ fontFamily: 'var(--font-poppins)' }}>
                {findNavigationTitle(pathname)}
              </h2>
            </div>

          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
