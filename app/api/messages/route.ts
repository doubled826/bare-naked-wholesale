import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { sendTeamEmail } from '@/lib/email';

const MAX_SUBJECT_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 5000;

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const subject = typeof body?.subject === 'string' ? body.subject.trim() : '';
    const message = typeof body?.message === 'string' ? body.message.trim() : '';

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (subject.length > MAX_SUBJECT_LENGTH) {
      return NextResponse.json({ error: 'Subject is too long' }, { status: 400 });
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ error: 'Message is too long' }, { status: 400 });
    }

    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('name')
      .eq('id', user.id)
      .single();

    if (adminUser) {
      const adminName = adminUser.name || user.email || 'Admin';
      const subjectPrefix = `Team Message - ${adminName}`;
      const finalSubject = subject ? `${subjectPrefix}: ${subject}` : subjectPrefix;

      const emailText = [
        message,
        '',
        '--',
        `From: ${adminName}`,
        `Email: ${user.email || 'Not provided'}`,
        'Role: Admin',
      ].join('\n');

      await sendTeamEmail({
        subject: finalSubject,
        text: emailText,
      });

      return NextResponse.json({ success: true });
    }

    const { data: retailer } = await supabase
      .from('retailers')
      .select('company_name, business_name, account_number, phone, business_address')
      .eq('id', user.id)
      .single();

    if (!retailer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const businessName = retailer.company_name || retailer.business_name || 'Retailer';
    const subjectPrefix = `Retailer Message - ${businessName}`;
    const finalSubject = subject ? `${subjectPrefix}: ${subject}` : subjectPrefix;

    const emailText = [
      message,
      '',
      '--',
      `Retailer: ${businessName}`,
      `Account: ${retailer.account_number || 'Not provided'}`,
      `Email: ${user.email || 'Not provided'}`,
      `Phone: ${retailer.phone || 'Not provided'}`,
      `Address: ${retailer.business_address || 'Not provided'}`,
    ].join('\n');

    await sendTeamEmail({
      subject: finalSubject,
      text: emailText,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Message send error:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
