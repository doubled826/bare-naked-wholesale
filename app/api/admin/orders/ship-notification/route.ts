import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { sendRetailerEmail } from '@/lib/email';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!adminUser) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { orderNumber, trackingNumber, retailerId } = await request.json();
    if (!retailerId) {
      return NextResponse.json({ error: 'Missing retailerId' }, { status: 400 });
    }

    const adminClient = createSupabaseAdminClient();
    const { data: userData, error } = await adminClient.auth.admin.getUserById(retailerId);
    if (error || !userData?.user?.email) {
      return NextResponse.json({ error: 'Retailer email not found' }, { status: 404 });
    }

    // Email content
    const emailText = `
Your order has shipped!

Order Number: ${orderNumber}
${trackingNumber ? `Tracking Number: ${trackingNumber}` : ''}

Thank you for your order. If you have any questions, please contact us at info@barenakedpet.com.

Best regards,
Bare Naked Pet Co.
    `.trim();

    await sendRetailerEmail({
      to: userData.user.email,
      subject: `Your order has shipped: ${orderNumber}`,
      text: emailText,
    });

    return NextResponse.json({ 
      success: true,
      message: 'Shipping notification sent'
    });

  } catch (error) {
    console.error('Ship notification error:', error);
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}
