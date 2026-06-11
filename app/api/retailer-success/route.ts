import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { DEFAULT_ASTRO_URL, normalizeCurrentAstroPromo } from '@/lib/retailerSuccess';

const allowedProfileFields = [
  'samples_acknowledged',
  'astro_enrolled',
  'marketing_materials_status',
  'shelf_placement_status',
  'shelf_placement_note',
  'current_promo_status',
] as const;

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [{ data: profile }, { data: promo }] = await Promise.all([
      supabase
        .from('retailer_success_profiles')
        .select('*')
        .eq('retailer_id', user.id)
        .maybeSingle(),
      supabase
        .from('retailer_success_promo_settings')
        .select('*')
        .eq('id', 'current')
        .maybeSingle(),
    ]);

    return NextResponse.json({
      profile,
      currentPromo: normalizeCurrentAstroPromo(promo),
    });
  } catch (error) {
    console.error('Retailer success load error:', error);
    return NextResponse.json({ error: 'Failed to load retailer success profile.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    allowedProfileFields.forEach((field) => {
      if (field in body) updates[field] = body[field];
    });

    const { data, error } = await supabase
      .from('retailer_success_profiles')
      .upsert({
        retailer_id: user.id,
        ...updates,
        success_plan_last_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'retailer_id' })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to save retailer success profile.' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      profile: data,
      currentPromo: {
        promoVisible: false,
        promoName: '',
        promoDescription: '',
        promoStartDate: null,
        promoEndDate: null,
        astroPromoUrl: DEFAULT_ASTRO_URL,
      },
    });
  } catch (error) {
    console.error('Retailer success save error:', error);
    return NextResponse.json({ error: 'Failed to save retailer success profile.' }, { status: 500 });
  }
}
