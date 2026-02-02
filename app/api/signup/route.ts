import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { businessName, businessAddress, name, email, password, phone, taxId } = await request.json();

    // 1. Create the auth user with metadata
    // IMPORTANT: Use 'company_name' to match the database trigger!
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: name,
          company_name: businessName,      // Changed from business_name to company_name
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

    // The database trigger will create the retailer record automatically
    // using the metadata we just set (company_name, business_address, phone)

    return NextResponse.json({ 
      success: true, 
      message: 'Account created successfully' 
    });

  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'An error occurred during signup' }, { status: 500 });
  }
}