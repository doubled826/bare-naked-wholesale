import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { applyRetailerCredits } from '@/lib/retailerCredits';

export async function POST(_: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!adminUser) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const orderId = params.id;
    const adminClient = createSupabaseAdminClient();

    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .select('id, retailer_id, status, subtotal, total, credit_applied, promotion_discount_applied, order_number')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (!['pending', 'processing'].includes(order.status)) {
      return NextResponse.json({ error: 'Credits can only be applied to pending or processing orders.' }, { status: 400 });
    }

    const remainingEligibleAmount = Math.max(0, Number(order.total || 0));
    if (remainingEligibleAmount <= 0) {
      return NextResponse.json({ error: 'This order does not have any remaining balance to credit.' }, { status: 400 });
    }

    const result = await applyRetailerCredits({
      adminClient,
      retailerId: order.retailer_id,
      orderId: order.id,
      subtotal: Number(order.subtotal || 0),
      currentCreditApplied: Number(order.credit_applied || 0),
      promotionDiscountApplied: Number(order.promotion_discount_applied || 0),
      maxApplyAmount: remainingEligibleAmount,
    });

    if (result.creditApplied <= 0) {
      return NextResponse.json({ error: 'No available credit was found for this retailer.' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.order_number,
      creditApplied: result.creditApplied,
      total: result.totalAfterCredit,
      remainingAvailableCredit: result.remainingAvailableCredit,
    });
  } catch (error) {
    console.error('Apply credit to existing order error:', error);
    return NextResponse.json({ error: 'Failed to apply credit to order.' }, { status: 500 });
  }
}
