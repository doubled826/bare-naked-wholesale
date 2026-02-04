import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ isAdmin: false }, { status: 200 });
    }

    const adminClient = createSupabaseAdminClient();
    const { data: adminUser } = await adminClient
      .from('admin_users')
      .select('id')
      .eq('id', user.id)
      .single();

    return NextResponse.json({ isAdmin: !!adminUser });
  } catch (error) {
    console.error('Admin check error:', error);
    return NextResponse.json({ isAdmin: false }, { status: 200 });
  }
}
