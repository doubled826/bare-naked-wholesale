import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { getRetailerAccess } from '@/lib/retailerAccess';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const adminClient = createSupabaseAdminClient();
    const access = await getRetailerAccess(adminClient, user);
    if (!access) return NextResponse.json({ error: 'Retailer access not found.' }, { status: 403 });

    const [retailerResult, locationsResult] = await Promise.all([
      adminClient.from('retailers').select('*').eq('id', access.retailerId).single(),
      adminClient
        .from('retailer_locations')
        .select('*')
        .eq('retailer_id', access.retailerId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true }),
    ]);

    if (retailerResult.error) throw retailerResult.error;
    if (locationsResult.error) throw locationsResult.error;

    const locations = access.role === 'owner'
      ? locationsResult.data || []
      : (locationsResult.data || []).filter((location: { id: string }) => access.locationIds.includes(location.id));

    let orderQuery = adminClient
      .from('orders')
      .select('*, location:retailer_locations(id, location_name, business_address, phone), order_items(*, product_id)')
      .eq('retailer_id', access.retailerId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (access.role === 'staff') {
      if (access.locationIds.length === 0) {
        return NextResponse.json({
          retailer: { ...retailerResult.data, email: access.email },
          membership: { ...access, id: access.membershipId, retailer_id: access.retailerId, user_id: access.userId, display_name: access.displayName, location_ids: access.locationIds, status: 'active' },
          locations,
          orders: [],
        });
      }
      orderQuery = orderQuery.in('location_id', access.locationIds);
    }

    const { data: orders, error: ordersError } = await orderQuery;
    if (ordersError) throw ordersError;

    return NextResponse.json({
      retailer: { ...retailerResult.data, email: access.role === 'owner' ? user.email : retailerResult.data.email },
      membership: {
        id: access.membershipId,
        retailer_id: access.retailerId,
        user_id: access.userId,
        role: access.role,
        status: 'active',
        display_name: access.displayName,
        email: access.email,
        location_ids: access.locationIds,
      },
      locations,
      orders: orders || [],
    });
  } catch (error) {
    console.error('Retailer context load error:', error);
    return NextResponse.json({ error: 'Unable to load retailer account.' }, { status: 500 });
  }
}
