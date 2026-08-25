import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';
import { getPrivatePromoStatusForDates } from '@/lib/privateLaunchPromo';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { adminClient } = await requireAdminAccess();
    const { data, error } = await adminClient
      .from('launch_promo_requests')
      .select('*, retailer:retailers(id, company_name, account_number, business_address, phone, status, created_at)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const now = new Date();
    const promos = (data || []).map((promo) => ({
      ...promo,
      computed_status: getPrivatePromoStatusForDates({
        startDate: promo.start_date,
        endDate: promo.end_date,
        salesSummaryReceivedAt: promo.sales_summary_received_at,
        fallbackStatus: promo.status,
        now,
      }),
    }));

    return NextResponse.json({ promos });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Private launch promo admin load error:', error);
    return NextResponse.json({ error: 'Unable to load private launch promos.' }, { status: 500 });
  }
}
