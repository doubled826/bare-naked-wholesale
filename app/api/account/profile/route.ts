import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { formatBusinessAddress } from '@/lib/address';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { isValidEmail } from '@/lib/utils';

export async function PATCH(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const businessName = typeof body.businessName === 'string' ? body.businessName.trim() : '';
    const businessStreet = typeof body.businessStreet === 'string' ? body.businessStreet.trim() : '';
    const businessCity = typeof body.businessCity === 'string' ? body.businessCity.trim() : '';
    const businessState = typeof body.businessState === 'string' ? body.businessState.trim() : '';
    const businessZip = typeof body.businessZip === 'string' ? body.businessZip.trim() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const taxId = typeof body.taxId === 'string' ? body.taxId.trim() : '';

    if (!businessName) {
      return NextResponse.json({ error: 'Business name is required.' }, { status: 400 });
    }

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    const businessAddress = formatBusinessAddress({
      street: businessStreet,
      city: businessCity,
      state: businessState,
      zip: businessZip,
    });
    const adminClient = createSupabaseAdminClient();
    const existingMetadata = user.user_metadata || {};
    const metadata = {
      ...existingMetadata,
      display_name: name,
      full_name: name,
      phone,
      company_name: businessName,
      business_address: businessAddress,
      business_street: businessStreet,
      business_city: businessCity,
      business_state: businessState,
      business_zip: businessZip,
      tax_id: taxId,
      email,
    };
    const emailChanged = (user.email || '').toLowerCase() !== email;

    const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(user.id, {
      email,
      email_confirm: emailChanged ? true : undefined,
      user_metadata: metadata,
    });

    if (authUpdateError) {
      return NextResponse.json({ error: authUpdateError.message || 'Failed to update email.' }, { status: 400 });
    }

    const { error: retailerError } = await adminClient
      .from('retailers')
      .update({
        company_name: businessName,
        business_address: businessAddress,
        phone,
        tax_id: taxId,
      })
      .eq('id', user.id);

    if (retailerError) {
      return NextResponse.json({ error: retailerError.message || 'Failed to update profile.' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      profile: {
        email,
        metadata,
      },
    });
  } catch (error) {
    console.error('Account profile update error:', error);
    return NextResponse.json({ error: 'An error occurred while updating your profile.' }, { status: 500 });
  }
}
