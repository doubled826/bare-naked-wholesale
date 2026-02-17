import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!adminUser) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { retailerId } = await request.json();

    if (!retailerId) {
      return NextResponse.json({ error: 'Missing retailerId' }, { status: 400 });
    }

    const adminClient = createSupabaseAdminClient();
    const { data: retailerUser, error: retailerError } = await adminClient.auth.admin.getUserById(retailerId);

    if (retailerError || !retailerUser?.user?.email) {
      return NextResponse.json({ error: 'Retailer email not found' }, { status: 400 });
    }

    const { error } = await adminClient.auth.admin.inviteUserByEmail(retailerUser.user.email);

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to resend invite' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Resend invite error:', error);
    return NextResponse.json({ error: 'An error occurred while resending the invite' }, { status: 500 });
  }
}
