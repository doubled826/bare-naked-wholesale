import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
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

    const { recipients, selectedRetailers, subject, message } = await request.json();

    // Get retailer emails
    let retailerIds: string[] = [];
    
    if (recipients === 'all') {
      const { data: allRetailers } = await supabase
        .from('retailers')
        .select('id');
      retailerIds = allRetailers?.map(r => r.id) || [];
    } else {
      retailerIds = selectedRetailers;
    }

    if (retailerIds.length === 0) {
      return NextResponse.json({ error: 'No recipients found' }, { status: 400 });
    }

    // Get emails from auth.users via admin API
    // Note: In production, you'd need to store emails in the retailers table
    // or use Supabase Admin API to get user emails
    
    // For now, we'll use a service role key approach
    const { data: retailers } = await supabase
      .from('retailers')
      .select('id, company_name')
      .in('id', retailerIds);

    const adminClient = createSupabaseAdminClient();

    const emailTargets = await Promise.all(
      (retailers || []).map(async (retailer) => {
        const { data: userData, error } = await adminClient.auth.admin.getUserById(retailer.id);
        if (error || !userData?.user?.email) {
          return null;
        }
        return { email: userData.user.email, company_name: retailer.company_name };
      })
    );

    const validTargets = emailTargets.filter(Boolean) as Array<{ email: string; company_name: string }>;

    if (validTargets.length === 0) {
      return NextResponse.json({ error: 'No recipient emails found' }, { status: 400 });
    }

    for (const retailer of validTargets) {
      await sendRetailerEmail({
        to: retailer.email,
        subject,
        text: `Hi ${retailer.company_name},\n\n${message}\n\nBest regards,\nBare Naked Pet Co.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #3d2314; padding: 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0;">Bare Naked Pet Co.</h1>
            </div>
            <div style="padding: 30px; background-color: #f9f6f1;">
              <p>Hi ${retailer.company_name},</p>
              <div style="white-space: pre-wrap;">${message}</div>
              <p style="margin-top: 30px;">Best regards,<br>Bare Naked Pet Co.</p>
            </div>
          </div>
        `,
      });
    }

    return NextResponse.json({ 
      success: true,
      count: validTargets.length,
      message: 'Emails sent successfully'
    });

  } catch (error) {
    console.error('Send email error:', error);
    return NextResponse.json({ error: 'Failed to send emails' }, { status: 500 });
  }
}
