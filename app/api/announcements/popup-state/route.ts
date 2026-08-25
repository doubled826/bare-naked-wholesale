import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const announcementId = typeof body.announcementId === 'string' ? body.announcementId : '';
    const version = Math.max(1, Number(body.version || 1));

    if (!announcementId) {
      return NextResponse.json({ error: 'Missing announcement id.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const adminClient = createSupabaseAdminClient();
    const { error } = await adminClient
      .from('announcement_popup_views')
      .upsert({
        announcement_id: announcementId,
        retailer_id: user.id,
        version,
        viewed_at: now,
        dismissed_at: now,
        updated_at: now,
      }, { onConflict: 'announcement_id,retailer_id,version' });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Announcement popup state save error:', error);
    return NextResponse.json({ error: 'Unable to save popup state.' }, { status: 500 });
  }
}
