import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { sendTeamEmail } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { locationId } = await request.json();

    if (!locationId) {
      return NextResponse.json({ error: 'Missing locationId' }, { status: 400 });
    }

    const [{ data: retailer }, { data: location, error: locationError }] = await Promise.all([
      supabase
        .from('retailers')
        .select('company_name, business_address, phone')
        .eq('id', user.id)
        .single(),
      supabase
        .from('retailer_locations')
        .select('location_name, business_address, phone, is_default')
        .eq('id', locationId)
        .eq('retailer_id', user.id)
        .single(),
    ]);

    if (locationError || !location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    const emailText = `
Retailer added a new ship-to location.

Retailer: ${retailer?.company_name || 'Unknown'}
Email: ${user.email || 'Not provided'}
Phone: ${retailer?.phone || 'Not provided'}
Primary Address: ${retailer?.business_address || 'Not provided'}

New Location:
- Name: ${location.location_name}
- Address: ${location.business_address}
- Phone: ${location.phone || 'Not provided'}
- Default: ${location.is_default ? 'Yes' : 'No'}
    `.trim();

    await sendTeamEmail({
      subject: `New ship-to location added: ${retailer?.company_name || 'Retailer'}`,
      text: emailText,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Notify location error:', error);
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}
