import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export async function GET(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const adminClient = createSupabaseAdminClient();

    let userId = '';
    if (token) {
      const { data: userData } = await adminClient.auth.getUser(token);
      userId = userData?.user?.id || '';
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id || '';
    }

    if (!userId) {
      return NextResponse.json({ isAdmin: false }, { status: 200 });
    }

    const { data: adminUser } = await adminClient
      .from('admin_users')
      .select('id')
      .eq('id', userId)
      .single();

    return NextResponse.json({ isAdmin: !!adminUser });
  } catch (error) {
    console.error('Admin check error:', error);
    return NextResponse.json({ isAdmin: false }, { status: 200 });
  }
}
