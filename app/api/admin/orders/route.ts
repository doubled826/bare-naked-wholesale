import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';

const ORDERS_SELECT = `
  *,
  retailer:retailers(id, company_name, business_address, phone),
  location:retailer_locations(id, location_name, business_address, phone),
  order_items(id, quantity, unit_price, total_price, product:products(name, size))
`;

const ORDERS_SELECT_WITH_SHELF_TALKERS = `
  ${ORDERS_SELECT},
  shelf_talker_fulfillments(id, retailer_id, location_id, flavor, status, fulfilled_order_id, qualified_at, fulfilled_at)
`;

export async function GET() {
  try {
    const { adminClient } = await requireAdminAccess();

    const ordersQuery = adminClient
      .from('orders')
      .select(ORDERS_SELECT_WITH_SHELF_TALKERS)
      .order('created_at', { ascending: false });

    const { data, error } = await ordersQuery;

    if (!error) {
      return NextResponse.json({ success: true, orders: data || [] });
    }

    console.error('Admin orders load with shelf talkers failed, retrying without optional relation:', error);

    const fallback = await adminClient
      .from('orders')
      .select(ORDERS_SELECT)
      .order('created_at', { ascending: false });

    if (fallback.error) {
      throw fallback.error;
    }

    const orders = (fallback.data || []).map((order) => ({
      ...order,
      shelf_talker_fulfillments: [],
    }));

    return NextResponse.json({ success: true, orders });
  } catch (error) {
    console.error('Admin orders load error:', error);

    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: 'Failed to load orders' }, { status: 500 });
  }
}
