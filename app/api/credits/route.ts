import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: credits, error } = await supabase
      .from('retailer_credits')
      .select(`
        id,
        reason,
        notes,
        status,
        total_amount,
        remaining_amount,
        created_at,
        items:retailer_credit_items(
          id,
          product_id,
          product_name,
          product_size,
          quantity,
          unit_price,
          total_amount
        ),
        applications:retailer_credit_applications(
          id,
          applied_amount,
          created_at,
          order:orders(
            id,
            order_number,
            created_at
          )
        )
      `)
      .eq('retailer_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Retailer credits load error:', error);
      return NextResponse.json({ error: 'Failed to load credits.' }, { status: 500 });
    }

    const safeCredits = credits || [];
    const availableBalance = safeCredits.reduce(
      (sum, credit) => credit.status === 'voided' ? sum : sum + Number(credit.remaining_amount || 0),
      0,
    );
    const totalIssued = safeCredits.reduce(
      (sum, credit) => credit.status === 'voided' ? sum : sum + Number(credit.total_amount || 0),
      0,
    );
    const totalUsed = safeCredits.reduce(
      (sum, credit) =>
        credit.status === 'voided'
          ? sum
          : sum + Math.max(0, Number(credit.total_amount || 0) - Number(credit.remaining_amount || 0)),
      0,
    );

    return NextResponse.json({
      success: true,
      availableBalance,
      totalIssued,
      totalUsed,
      activeCreditCount: safeCredits.filter(
        (credit) => credit.status !== 'voided' && Number(credit.remaining_amount || 0) > 0,
      ).length,
      credits: safeCredits,
    });
  } catch (error) {
    console.error('Retailer credits load error:', error);
    return NextResponse.json({ error: 'Failed to load credits.' }, { status: 500 });
  }
}
