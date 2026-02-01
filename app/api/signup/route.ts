import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // 1. Use the Service Role Key to ensure we have permission
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { email, password, businessName, businessAddress, phone } = await request.json();

    // 2. Create auth user and pass data as METADATA
    // The SQL Trigger will grab 'company_name', etc., from this object automatically
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

    // 3. We removed the manual .from('retailers').insert() block!
    // The database has already done it by the time we get here.

    return NextResponse.json({ 
      success: true,
      message: 'Account created successfully! Please check your email to verify your account.'
    });

  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}