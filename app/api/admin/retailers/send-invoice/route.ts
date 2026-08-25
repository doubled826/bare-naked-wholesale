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

    const { orderId, invoiceUrl } = await request.json();

    if (!orderId || !invoiceUrl) {
      return NextResponse.json({ error: 'Missing orderId or invoiceUrl' }, { status: 400 });
    }

    const adminClient = createSupabaseAdminClient();
    const { data: orderRecord, error: orderError } = await adminClient
      .from('orders')
      .select('id, retailer_id, order_number, invoice_sent_count')
      .eq('id', orderId)
      .single();

    if (orderError || !orderRecord?.retailer_id) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const { data: retailerUser, error } = await adminClient.auth.admin.getUserById(orderRecord.retailer_id);

    if (error || !retailerUser?.user?.email) {
      return NextResponse.json({ error: 'Retailer email not found' }, { status: 404 });
    }

    await sendRetailerEmail({
      to: retailerUser.user.email,
      subject: `Your QuickBooks Invoice${orderRecord.order_number ? ` for ${orderRecord.order_number}` : ''}`,
      text: `Hi there,\n\nYour invoice is ready. Please use the link below to view and pay:\n${invoiceUrl}\n\nThanks,\nBare Naked Pet Co.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #3d2314; padding: 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0;">Bare Naked Pet Co.</h1>
          </div>
          <div style="padding: 30px; background-color: #f9f6f1;">
            <p>Hi there,</p>
            ${orderRecord.order_number ? `<p>Order: <strong>${orderRecord.order_number}</strong></p>` : ''}
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
      .from('orders')
      .update({
        invoice_url: invoiceUrl,
        invoice_sent_at: new Date().toISOString(),
        invoice_sent_count: (orderRecord?.invoice_sent_count || 0) + 1,
      })
      .eq('id', orderId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Invoice email error:', error);
    return NextResponse.json({ error: 'Failed to send invoice' }, { status: 500 });
  }
}
