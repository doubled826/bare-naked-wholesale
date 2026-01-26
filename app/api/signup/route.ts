import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    const { email, password, businessName, businessAddress, phone } = await request.json();

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }

    // Generate account number
    const accountNumber = `WHL-${Math.floor(1000 + Math.random() * 9000)}`;

    // Create retailer profile
    const { error: retailerError } = await supabase
      .from('retailers')
      .insert({
        id: authData.user.id,
        business_name: businessName,
        business_address: businessAddress,
        phone: phone,
        account_number: accountNumber
      });

    if (retailerError) {
      console.error('Retailer profile creation error:', retailerError);
      return NextResponse.json({ error: 'Failed to create retailer profile' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'Account created successfully! Please check your email to verify your account.'
    });

  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
