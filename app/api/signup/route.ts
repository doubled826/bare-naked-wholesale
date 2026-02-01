import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { email, password, businessName, businessAddress, phone } = await request.json();

    // 1. Create auth user and pass business info as metadata for the Trigger
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          company_name: businessName,
          business_address: businessAddress,
          phone: phone,
        },
      },
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    // 2. We skip the manual 'retailers' insert because our SQL Trigger 
    // in the database will handle it automatically upon user creation.

    return NextResponse.json({
      success: true,
      message: 'Application received! We will review your account soon.'
    });

  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}