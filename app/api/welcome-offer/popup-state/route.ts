import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

type PopupStateAction = 'viewed';
type PopupVariant = 'initial' | 'returning';

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
      .select('welcome_offer_initial_popup_seen, remind_me_later_requested')
      .eq('retailer_id', user.id)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      initialPopupSeen: Boolean(preference?.welcome_offer_initial_popup_seen),
      reminderRequested: Boolean(preference?.remind_me_later_requested),
    });
  } catch (error) {
    console.error('Welcome Offer popup state load error:', error);
    return NextResponse.json({ error: 'Unable to load Welcome Offer popup state.' }, { status: 500 });
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
    const action = body?.action as PopupStateAction | undefined;
    const variant = body?.variant as PopupVariant | undefined;

    if (action !== 'viewed' || !['initial', 'returning'].includes(String(variant))) {
      return NextResponse.json({ error: 'Invalid popup state action.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const adminClient = createSupabaseAdminClient();

    const updates = variant === 'initial'
      ? {
          retailer_id: user.id,
          welcome_offer_initial_popup_seen: true,
          welcome_offer_initial_popup_seen_at: now,
          welcome_offer_last_popup_viewed_at: now,
          updated_at: now,
        }
      : {
          retailer_id: user.id,
          welcome_offer_last_popup_viewed_at: now,
          updated_at: now,
        };

    const { data: preference, error } = await adminClient
      .from('welcome_offer_reminder_preferences')
      .upsert(updates, { onConflict: 'retailer_id' })
      .select('welcome_offer_initial_popup_seen, remind_me_later_requested')
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      initialPopupSeen: Boolean(preference?.welcome_offer_initial_popup_seen),
      reminderRequested: Boolean(preference?.remind_me_later_requested),
    });
  } catch (error) {
    console.error('Welcome Offer popup state save error:', error);
    return NextResponse.json({ error: 'Unable to save Welcome Offer popup state.' }, { status: 500 });
  }
}
