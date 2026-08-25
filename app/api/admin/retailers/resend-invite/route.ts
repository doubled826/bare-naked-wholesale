import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({ error: 'Missing Supabase recovery credentials' }, { status: 500 });
    }

    const recoveryClient = createClient(supabaseUrl, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL;
    const redirectBase = origin?.replace(/\/$/, '');
    const redirectTo = redirectBase ? `${redirectBase}/reset-password` : undefined;
    const { error } = await recoveryClient.auth.resetPasswordForEmail(retailerUser.user.email, {
      redirectTo,
    });

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to send setup email' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Resend invite error:', error);
    return NextResponse.json({ error: 'An error occurred while sending the setup email' }, { status: 500 });
  }
}
