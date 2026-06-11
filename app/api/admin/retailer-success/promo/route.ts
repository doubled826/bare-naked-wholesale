import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';
import { DEFAULT_ASTRO_URL, normalizeCurrentAstroPromo } from '@/lib/retailerSuccess';

export async function GET() {
  try {
    const { adminClient } = await requireAdminAccess();
    const { data, error } = await adminClient
      .from('retailer_success_promo_settings')
      .select('*')
      .eq('id', 'current')
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to load current promo.' }, { status: 400 });
    }

    return NextResponse.json({ currentPromo: normalizeCurrentAstroPromo(data) });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Current promo load error:', error);
    return NextResponse.json({ error: 'Failed to load current promo.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { adminClient } = await requireAdminAccess();
    const body = await request.json();

    const { data, error } = await adminClient
      .from('retailer_success_promo_settings')
      .upsert({
        id: 'current',
        promo_visible: Boolean(body.promo_visible),
        promo_name: typeof body.promo_name === 'string' ? body.promo_name.trim() : '',
        promo_description: typeof body.promo_description === 'string' ? body.promo_description.trim() : '',
        promo_start_date: body.promo_start_date || null,
        promo_end_date: body.promo_end_date || null,
        astro_promo_url: typeof body.astro_promo_url === 'string' && body.astro_promo_url.trim()
          ? body.astro_promo_url.trim()
          : DEFAULT_ASTRO_URL,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to save current promo.' }, { status: 400 });
    }

    return NextResponse.json({ success: true, currentPromo: normalizeCurrentAstroPromo(data) });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Current promo save error:', error);
    return NextResponse.json({ error: 'Failed to save current promo.' }, { status: 500 });
  }
}
