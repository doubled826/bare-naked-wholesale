import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { businessName, businessAddress, name, email, password, phone, taxId } = await request.json();

    // 1. Create the auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: name,
          business_name: businessName,
          business_address: businessAddress,
          phone: phone,
          tax_id: taxId,
        },
      },
    });

    if (authError) {
      console.error('Auth error:', authError);
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 400 });
    }

    // 2. The retailer record should be created by the database trigger
    // But we can also create it here as a fallback
    const { error: retailerError } = await supabase
      .from('retailers')
      .upsert({
        id: authData.user.id,
        company_name: businessName,
        business_address: businessAddress,
        phone: phone,
        tax_id: taxId,
        account_number: `BNP-${1000 + Math.floor(Math.random() * 9000)}`,
      }, { 
        onConflict: 'id' 
      });

    if (retailerError) {
      console.error('Retailer error:', retailerError);
      // Don't fail the signup if retailer creation fails - the trigger might handle it
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Account created successfully' 
    });

  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'An error occurred during signup' }, { status: 500 });
  }
}
