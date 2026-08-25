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

    const { businessName, businessAddress, name, email, phone, taxId } = await request.json();

    if (!businessName || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const adminClient = createSupabaseAdminClient();

    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: {
        display_name: name || '',
        company_name: businessName,
        business_address: businessAddress || '',
        phone: phone || '',
        tax_id: taxId || '',
      },
    });

    if (error) {
      return NextResponse.json({ error: error?.message || 'Failed to create retailer' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Create retailer error:', error);
    return NextResponse.json({ error: 'An error occurred while creating the retailer' }, { status: 500 });
  }
}
