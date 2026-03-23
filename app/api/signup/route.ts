import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { sendTeamEmail } from '@/lib/email';
import { formatBusinessAddress } from '@/lib/address';

type TurnstileVerificationResult = {
  success: boolean;
  'error-codes'?: string[];
};

async function verifyTurnstileToken(token: string, remoteIp?: string | null) {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    console.error('TURNSTILE_SECRET_KEY is not configured');
    return { success: false, 'error-codes': ['missing-secret'] } satisfies TurnstileVerificationResult;
  }

  const formData = new FormData();
  formData.append('secret', secret);
  formData.append('response', token);

  if (remoteIp) {
    formData.append('remoteip', remoteIp);
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      return { success: false, 'error-codes': ['verification-request-failed'] } satisfies TurnstileVerificationResult;
    }

    return (await response.json()) as TurnstileVerificationResult;
  } catch (error) {
    console.error('Turnstile verification error:', error);
    return { success: false, 'error-codes': ['verification-request-failed'] } satisfies TurnstileVerificationResult;
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      businessName,
      businessStreet,
      businessCity,
      businessState,
      businessZip,
      name,
      email,
      password,
      phone,
      taxId,
      turnstileToken,
    } = await request.json();

    if (!turnstileToken || typeof turnstileToken !== 'string') {
      return NextResponse.json({ error: 'Please complete the verification challenge.' }, { status: 400 });
    }

    const forwardedFor = request.headers.get('x-forwarded-for');
    const remoteIp =
      request.headers.get('cf-connecting-ip') ||
      (forwardedFor ? forwardedFor.split(',')[0].trim() : null);
    const verification = await verifyTurnstileToken(turnstileToken, remoteIp);

    if (!verification.success) {
      console.warn('Turnstile rejected signup:', verification['error-codes']);
      return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 400 });
    }

    const formattedBusinessAddress = formatBusinessAddress({
      street: businessStreet,
      city: businessCity,
      state: businessState,
      zip: businessZip,
    });

    // 1. Create the auth user with metadata
    // IMPORTANT: Use 'company_name' to match the database trigger!
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: name,
          company_name: businessName,      // Changed from business_name to company_name
          business_address: formattedBusinessAddress,
          business_street: businessStreet?.trim(),
          business_city: businessCity?.trim(),
          business_state: businessState?.trim(),
          business_zip: businessZip?.trim(),
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

    try {
      await sendTeamEmail({
        subject: 'New Retailer Signup',
        text: `
New retailer signup received.

Business Name: ${businessName}
Contact Name: ${name}
Email: ${email}
Phone: ${phone}
Address: ${formattedBusinessAddress}
Tax ID: ${taxId}
        `.trim(),
      });
    } catch (emailError) {
      console.error('Signup notification email error:', emailError);
    }

    return NextResponse.json({
      success: true,
      message: 'Account created successfully',
    });

  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'An error occurred during signup' }, { status: 500 });
  }
}
