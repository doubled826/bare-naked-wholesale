import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // Use the Service Role Key to ensure we have permission
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { 
      businessName, 
      businessAddress, 
      name, 
      email, 
      password, 
      phone, 
      taxId 
    } = await request.json();

    // Create auth user and pass data as METADATA
    // The SQL Trigger (handle_new_retailer) will grab this data automatically
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          // User display info
          display_name: name,
          full_name: name,
          phone: phone,
          // Retailer info (used by the database trigger)
          company_name: businessName,
          business_address: businessAddress,
          tax_id: taxId,
        },
      },
    });

    if (authError) {
      console.error('Auth signup error:', authError);
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }

    // The database trigger (handle_new_retailer) automatically creates
    // the retailer profile using the metadata we passed above

    return NextResponse.json({ 
      success: true,
      message: 'Account created successfully!'
    });

  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
