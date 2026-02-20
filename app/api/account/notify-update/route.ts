import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { sendTeamEmail } from '@/lib/email';
import { formatBusinessAddress } from '@/lib/address';

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      businessName,
      businessStreet,
      businessCity,
      businessState,
      businessZip,
      name,
      phone,
      taxId,
      accountNumber,
    } = await request.json();

    const formattedBusinessAddress = formatBusinessAddress({
      street: businessStreet,
      city: businessCity,
      state: businessState,
      zip: businessZip,
    });

    await sendTeamEmail({
      subject: 'Retailer Account Updated',
      text: `
A retailer updated their account information.

Business Name: ${businessName}
Account Number: ${accountNumber || 'Not provided'}
Contact Name: ${name}
Email: ${user.email}
Phone: ${phone}
Address: ${formattedBusinessAddress || 'Not provided'}
Tax ID: ${taxId}
      `.trim(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Account update notification error:', error);
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}
