import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { sendRetailerEmail } from '@/lib/email';

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

    const { retailerId, invoiceUrl } = await request.json();

    if (!retailerId || !invoiceUrl) {
      return NextResponse.json({ error: 'Missing retailerId or invoiceUrl' }, { status: 400 });
    }

    const adminClient = createSupabaseAdminClient();
    const { data: retailerUser, error } = await adminClient.auth.admin.getUserById(retailerId);

    if (error || !retailerUser?.user?.email) {
      return NextResponse.json({ error: 'Retailer email not found' }, { status: 404 });
    }

    const { data: retailerRecord, error: retailerError } = await adminClient
      .from('retailers')
      .select('invoice_sent_count')
      .eq('id', retailerId)
      .single();

    if (retailerError) {
      return NextResponse.json({ error: 'Failed to load retailer record' }, { status: 500 });
    }

    await sendRetailerEmail({
      to: retailerUser.user.email,
      subject: 'Your QuickBooks Invoice',
      text: `Hi there,\n\nYour invoice is ready. Please use the link below to view and pay:\n${invoiceUrl}\n\nThanks,\nBare Naked Pet Co.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #3d2314; padding: 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0;">Bare Naked Pet Co.</h1>
          </div>
          <div style="padding: 30px; background-color: #f9f6f1;">
            <p>Hi there,</p>
            <p>Your invoice is ready. Please use the button below to view and pay:</p>
            <p style="margin: 24px 0;">
              <a href="${invoiceUrl}" style="background-color: #3d2314; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 6px; display: inline-block;">View Invoice</a>
            </p>
            <p>Thanks,<br />Bare Naked Pet Co.</p>
          </div>
        </div>
      `,
    });

    await adminClient
      .from('retailers')
      .update({
        invoice_sent_at: new Date().toISOString(),
        invoice_sent_count: (retailerRecord?.invoice_sent_count || 0) + 1,
      })
      .eq('id', retailerId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Invoice email error:', error);
    return NextResponse.json({ error: 'Failed to send invoice' }, { status: 500 });
  }
}
