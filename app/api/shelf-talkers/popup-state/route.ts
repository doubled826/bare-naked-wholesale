import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createSupabaseAdminClient();
    const { data: preference, error } = await adminClient
      .from('welcome_offer_reminder_preferences')
      .select('shelf_talker_popup_seen')
      .eq('retailer_id', user.id)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      seen: Boolean(preference?.shelf_talker_popup_seen),
    });
  } catch (error) {
    console.error('Shelf talker popup state load error:', error);
    return NextResponse.json({ error: 'Unable to load shelf talker popup state.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    if (body?.action !== 'viewed') {
      return NextResponse.json({ error: 'Invalid popup state action.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const adminClient = createSupabaseAdminClient();
    const { data: preference, error } = await adminClient
      .from('welcome_offer_reminder_preferences')
      .upsert({
        retailer_id: user.id,
        shelf_talker_popup_seen: true,
        shelf_talker_popup_seen_at: now,
        updated_at: now,
      }, { onConflict: 'retailer_id' })
      .select('shelf_talker_popup_seen')
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      seen: Boolean(preference?.shelf_talker_popup_seen),
    });
  } catch (error) {
    console.error('Shelf talker popup state save error:', error);
    return NextResponse.json({ error: 'Unable to save shelf talker popup state.' }, { status: 500 });
  }
}
