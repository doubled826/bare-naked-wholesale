import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { getOfferResolution, toPublicOfferBenefit } from '@/lib/offerResolver';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const subtotal = Number(searchParams.get('subtotal') || 0);
    const promotionCode = searchParams.get('promotionCode');
    const adminClient = createSupabaseAdminClient();

    const { data: retailer, error: retailerError } = await adminClient
      .from('retailers')
      .select('id, created_at')
      .eq('id', user.id)
      .single();

    if (retailerError || !retailer) {
      return NextResponse.json({ error: 'Retailer not found.' }, { status: 404 });
    }

    const { count: activeOrderCount, error: orderCountError } = await adminClient
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('retailer_id', user.id)
      .neq('status', 'canceled');

    if (orderCountError) throw orderCountError;

    const resolution = await getOfferResolution({
      adminClient,
      retailer,
      activeOrderCount: activeOrderCount || 0,
      subtotal,
      promotionCode,
    });

    return NextResponse.json({
      resolution: {
        appliedBenefits: resolution.appliedBenefits.map(toPublicOfferBenefit),
        blockedBenefits: resolution.blockedBenefits.map(toPublicOfferBenefit),
        primaryFirstOrderOffer: resolution.primaryFirstOrderOffer
          ? toPublicOfferBenefit(resolution.primaryFirstOrderOffer)
          : null,
        totalDiscount: resolution.totalDiscount,
        error: resolution.error,
        enteredCodeStatus: resolution.enteredCodeStatus,
        enteredCodeBlockedReason: resolution.enteredCodeBlockedReason,
        enteredCodeMessage: resolution.enteredCodeMessage,
      },
    });
  } catch (error) {
    console.error('Offer resolution load error:', error);
    return NextResponse.json({ error: 'Unable to load current offers.' }, { status: 500 });
  }
}
