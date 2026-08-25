import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { user, adminClient } = await requireAdminAccess();
    const body = await request.json().catch(() => ({}));
    const now = new Date().toISOString();

    if (!['mark_summary_received', 'issue_credit'].includes(String(body.action))) {
      return NextResponse.json({ error: 'Unsupported private promo action.' }, { status: 400 });
    }

    const { data: existingPromo, error: loadError } = await adminClient
      .from('launch_promo_requests')
      .select('*, retailer:retailers(company_name, account_number)')
      .eq('id', params.id)
      .single();

    if (loadError || !existingPromo) {
      return NextResponse.json({ error: 'Private promo not found.' }, { status: 404 });
    }

    let creditId: string | null = existingPromo.credit_id || null;
    let posSalesAmount = existingPromo.pos_sales_amount == null ? null : Number(existingPromo.pos_sales_amount);
    let creditAmount = existingPromo.credit_amount == null ? null : Number(existingPromo.credit_amount);

    if (body.action === 'issue_credit') {
      posSalesAmount = Number(body.posSalesAmount || 0);
      creditAmount = Number(body.creditAmount || 0);

      if (posSalesAmount <= 0) {
        return NextResponse.json({ error: 'Enter the POS sales amount from the retailer summary.' }, { status: 400 });
      }
      if (creditAmount <= 0) {
        return NextResponse.json({ error: 'Credit amount must be greater than zero.' }, { status: 400 });
      }
      if (creditId) {
        return NextResponse.json({ error: 'A credit has already been issued for this promo.' }, { status: 400 });
      }

      const dateRange = existingPromo.start_date && existingPromo.end_date
        ? `${existingPromo.start_date} to ${existingPromo.end_date}`
        : 'selected promo date range';
      const notes = [
        `Private launch promo credit for ${dateRange}.`,
        `POS sales summary: $${posSalesAmount.toFixed(2)}.`,
        `Promo discount: ${Number(existingPromo.promo_discount_percent || 10)}%.`,
        typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null,
      ].filter(Boolean).join('\n');

      const { data: credit, error: creditError } = await adminClient
        .from('retailer_credits')
        .insert({
          retailer_id: existingPromo.retailer_id,
          reason: 'Private launch promo credit',
          notes,
          total_amount: creditAmount,
          remaining_amount: creditAmount,
          created_by: user.id,
        })
        .select('id')
        .single();

      if (creditError || !credit) throw creditError || new Error('Failed to create promo credit.');

      const { error: itemError } = await adminClient
        .from('retailer_credit_items')
        .insert({
          credit_id: credit.id,
          product_id: null,
          product_name: 'Private Launch Promo',
          product_size: null,
          quantity: 1,
          unit_price: creditAmount,
          total_amount: creditAmount,
        });

      if (itemError) {
        await adminClient.from('retailer_credits').delete().eq('id', credit.id);
        throw itemError;
      }

      creditId = credit.id;
    }

    const updatePayload = {
      status: 'completed',
      sales_summary_received_at: now,
      pos_sales_amount: posSalesAmount,
      credit_amount: creditAmount,
      credit_id: creditId,
      credit_issued_at: body.action === 'issue_credit' ? now : existingPromo.credit_issued_at,
      updated_at: now,
    };

    const { data: promo, error: promoError } = await adminClient
      .from('launch_promo_requests')
      .update(updatePayload)
      .eq('id', params.id)
      .select('*')
      .single();

    if (promoError) throw promoError;

    const { error: profileError } = await adminClient
      .from('retailer_success_profiles')
      .upsert({
        retailer_id: promo.retailer_id,
        launch_promo_status: 'completed',
        private_promo_status: 'completed',
        private_promo_start_date: promo.start_date,
        private_promo_end_date: promo.end_date,
        private_promo_duration_weeks: promo.duration_weeks,
        private_promo_discount_percent: promo.promo_discount_percent,
        private_promo_sales_summary_requested_at: promo.sales_summary_requested_at,
        private_promo_sales_summary_received_at: now,
        private_promo_pos_sales_amount: posSalesAmount,
        private_promo_credit_amount: creditAmount,
        private_promo_credit_id: creditId,
        private_promo_credit_issued_at: body.action === 'issue_credit' ? now : existingPromo.credit_issued_at,
        success_plan_last_updated_at: now,
        updated_at: now,
      }, { onConflict: 'retailer_id' });

    if (profileError) throw profileError;

    return NextResponse.json({ success: true, promo, creditId });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Private launch promo admin update error:', error);
    return NextResponse.json({ error: 'Unable to update private launch promo.' }, { status: 500 });
  }
}
