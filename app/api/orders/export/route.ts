import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { formatMarketingMaterialsLabel } from '@/lib/marketingMaterials';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { getRetailerAccess } from '@/lib/retailerAccess';

export async function GET(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const adminClient = createSupabaseAdminClient();
    const access = await getRetailerAccess(adminClient, user);
    if (!access) return NextResponse.json({ error: 'Retailer access not found.' }, { status: 403 });

    let query = adminClient
      .from('orders')
      .select(`
        order_number,
        status,
        total,
        subtotal,
        promotion_discount_applied,
        credit_applied,
        delivery_date,
        tracking_number,
        tracking_carrier,
        invoice_url,
        include_samples,
        include_marketing_materials,
        marketing_materials_type,
        promotion_code,
        placed_by_name,
        location:retailer_locations(location_name),
        created_at
      `)
      .eq('retailer_id', access.retailerId)
      .order('created_at', { ascending: false });

    if (access.role === 'staff') {
      if (!access.locationIds.length) {
        query = query.in('location_id', ['00000000-0000-0000-0000-000000000000']);
      } else {
        query = query.in('location_id', access.locationIds);
      }
    }

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data: orders, error } = await query;

    if (error) throw error;

    const headers = [
      'Order Number',
      'Status',
      'Subtotal',
      'Promotion Discount Applied',
      'Account Credit Applied',
      'Total',
      'Tracking Number',
      'Tracking Carrier',
      'Invoice URL',
      'Includes Samples',
      'Includes Marketing Materials',
      'Marketing Materials Type',
      'Promotion Code',
      'Ship-To Location',
      'Placed By',
      'Delivery Date',
      'Order Date'
    ];

    const rows = orders?.map((order: any) => [
      order.order_number,
      order.status,
      order.subtotal?.toFixed(2) || '0.00',
      order.promotion_discount_applied?.toFixed(2) || '0.00',
      order.credit_applied?.toFixed(2) || '0.00',
      order.total?.toFixed(2) || '0.00',
      order.tracking_number || '',
      order.tracking_carrier || '',
      order.invoice_url || '',
      order.include_samples ? 'Yes' : 'No',
      order.include_marketing_materials ? 'Yes' : 'No',
      order.include_marketing_materials ? formatMarketingMaterialsLabel(order.marketing_materials_type) : '',
      order.promotion_code || '',
      order.location?.location_name || '',
      order.placed_by_name || '',
      order.delivery_date || '',
      new Date(order.created_at).toLocaleDateString()
    ]) || [];

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map((cell: string) => `"${cell}"`).join(','))
    ].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="orders-${new Date().toISOString().split('T')[0]}.csv"`
      }
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Failed to export orders' }, { status: 500 });
  }
}
