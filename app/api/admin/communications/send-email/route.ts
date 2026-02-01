import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
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

    // Configure email transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    // In a real implementation, you would:
    // 1. Get actual email addresses from auth.users or store them in retailers table
    // 2. Send emails to each retailer
    // 3. Log the emails sent

    // For now, log what would be sent
    console.log('Would send email to', retailers?.length, 'retailers');
    console.log('Subject:', subject);
    console.log('Message:', message);

    // Placeholder for actual email sending
    // You would loop through retailers and send emails like:
    /*
    for (const retailer of retailers) {
      await transporter.sendMail({
        from: `Bare Naked Pet Co. <${process.env.SMTP_USER}>`,
        to: retailer.email, // Need to add email to retailers table
        subject: subject,
        text: message,
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
        `
      });
    }
    */

    return NextResponse.json({ 
      success: true,
      count: retailers?.length || 0,
      message: 'Emails sent successfully'
    });

  } catch (error) {
    console.error('Send email error:', error);
    return NextResponse.json({ error: 'Failed to send emails' }, { status: 500 });
  }
}
