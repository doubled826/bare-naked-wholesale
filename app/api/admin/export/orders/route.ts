import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { searchParams } = new URL(request.url);
    
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build query
    let query = supabase
      .from('orders')
      .select(`
        order_number,
        status,
        total,
        subtotal,
        delivery_date,
        tracking_number,
        promotion_code,
        created_at,
        retailer:retailers(company_name, business_address, phone)
      `)
      .order('created_at', { ascending: false });

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

    // Convert to CSV
    const headers = [
      'Order Number',
      'Status',
      'Retailer',
      'Address',
      'Phone',
      'Subtotal',
      'Total',
      'Tracking Number',
      'Promotion Code',
      'Delivery Date',
      'Order Date'
    ];

    const rows = orders?.map(order => [
      order.order_number,
      order.status,
      order.retailer?.company_name || '',
      order.retailer?.business_address || '',
      order.retailer?.phone || '',
      order.subtotal?.toFixed(2) || '0.00',
      order.total?.toFixed(2) || '0.00',
      order.tracking_number || '',
      order.promotion_code || '',
      order.delivery_date || '',
      new Date(order.created_at).toLocaleDateString()
    ]) || [];

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
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
