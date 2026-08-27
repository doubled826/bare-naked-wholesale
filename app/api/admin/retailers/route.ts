import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';

export const dynamic = 'force-dynamic';

type RetailerLocationRow = {
  id: string;
  retailer_id: string;
  location_name: string | null;
  business_address: string | null;
  phone: string | null;
  public_display_name?: string | null;
};

type RetailerUserSummary = {
  email: string;
  contact_name: string;
  tax_id: string;
};

async function getRetailerUsersById(adminClient: any) {
  const usersById = new Map<string, RetailerUserSummary>();
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });

    if (error) throw error;

    for (const user of data?.users || []) {
      const metadata = user.user_metadata || {};
      usersById.set(user.id, {
        email: user.email || metadata.email || '',
        contact_name: metadata.display_name || metadata.name || '',
        tax_id: metadata.tax_id || '',
      });
    }

    if (!data?.users || data.users.length < perPage) break;
    page += 1;
  }

  return usersById;
}

export async function GET() {
  try {
    const { adminClient } = await requireAdminAccess();

    const [retailersResult, ordersResult, locationsResult, usersById] = await Promise.all([
      adminClient.from('retailers').select('*').order('created_at', { ascending: false }),
      adminClient.from('orders').select('retailer_id, total, created_at, status'),
      adminClient
        .from('retailer_locations')
        .select('id, retailer_id, location_name, business_address, phone, public_display_name')
        .order('created_at', { ascending: true }),
      getRetailerUsersById(adminClient),
    ]);

    if (retailersResult.error) throw retailersResult.error;
    if (ordersResult.error) throw ordersResult.error;

    if (locationsResult.error) {
      console.warn('Retailer list locations failed to load:', locationsResult.error);
    }

    const locationsByRetailer = new Map<string, RetailerLocationRow[]>();
    for (const location of locationsResult.data || []) {
      const existing = locationsByRetailer.get(location.retailer_id) || [];
      existing.push(location);
      locationsByRetailer.set(location.retailer_id, existing);
    }

    const retailers = (retailersResult.data || []).map((retailer: any) => {
      const retailerOrders = (ordersResult.data || []).filter((order: any) => (
        order.retailer_id === retailer.id && order.status !== 'canceled'
      ));
      const totalSpent = retailerOrders.reduce((sum: number, order: any) => sum + (order.total || 0), 0);
      const lastOrder = [...retailerOrders].sort((a: any, b: any) => (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ))[0];
      const userSummary = usersById.get(retailer.id);

      return {
        ...retailer,
        email: retailer.email || userSummary?.email || '',
        contact_name: retailer.contact_name || userSummary?.contact_name || '',
        tax_id: retailer.tax_id || userSummary?.tax_id || '',
        locations: locationsByRetailer.get(retailer.id) || [],
        total_orders: retailerOrders.length,
        total_spent: totalSpent,
        last_order_date: lastOrder?.created_at || null,
      };
    });

    return NextResponse.json({ retailers });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Get retailers error:', error);
    return NextResponse.json({ error: 'An error occurred while fetching retailers' }, { status: 500 });
  }
}
