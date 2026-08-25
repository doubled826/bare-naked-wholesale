import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';
import { getTeamEmailTo } from '@/lib/email';
import { renderEmailTemplate } from '@/lib/emailTemplates';

export const dynamic = 'force-dynamic';

type RetailerRecipient = {
  id: string;
  company_name?: string | null;
  email?: string | null;
};

const isLikelyEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const getFromAddress = () =>
  process.env.OUTREACH_EMAIL_FROM || process.env.ORDER_EMAIL_FROM || process.env.SMTP_USER || getTeamEmailTo();

const getReplyToEmail = () => process.env.REPLY_TO_EMAIL || getTeamEmailTo();

async function loadRecipients(adminClient: Awaited<ReturnType<typeof requireAdminAccess>>['adminClient']) {
  const { data, error } = await adminClient
    .from('retailers')
    .select('id, company_name, email')
    .order('company_name');

  if (error) throw error;

  const uniqueByEmail = new Map<string, RetailerRecipient & { email: string }>();

  for (const retailer of (data || []) as RetailerRecipient[]) {
    const email = (retailer.email || '').trim().toLowerCase();
    if (!email || !isLikelyEmail(email) || uniqueByEmail.has(email)) continue;
    uniqueByEmail.set(email, { ...retailer, email });
  }

  return Array.from(uniqueByEmail.values());
}

async function sendResendCampaignEmail(options: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error('Resend is not configured. Add RESEND_API_KEY to the server environment.');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `"Bare Naked Pet Co." <${getFromAddress()}>`,
      to: [options.to],
      reply_to: getReplyToEmail(),
      subject: options.subject,
      text: options.text,
      html: options.html,
      tags: [
        { name: 'feature', value: 'marketing' },
        { name: 'campaign', value: 'shelf-talker-launch' },
      ],
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || 'Resend request failed.');
  }

  return payload as { id?: string };
}

export async function GET() {
  try {
    const { adminClient } = await requireAdminAccess();
    const recipients = await loadRecipients(adminClient);

    return NextResponse.json({
      recipientCount: recipients.length,
      sampleRecipients: recipients.slice(0, 5).map((recipient) => ({
        id: recipient.id,
        company_name: recipient.company_name || null,
        email: recipient.email,
      })),
    });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Shelf talker campaign recipient load error:', error);
    return NextResponse.json({ error: 'Unable to load shelf talker campaign recipients.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { adminClient } = await requireAdminAccess();
    const body = await request.json().catch(() => ({}));

    if (body?.confirm !== true || body?.confirmText !== 'SEND') {
      return NextResponse.json({ error: 'Bulk send confirmation is required.' }, { status: 400 });
    }

    const template = renderEmailTemplate('shelf_talker_launch');
    if (!template) {
      return NextResponse.json({ error: 'Shelf talker campaign template not found.' }, { status: 404 });
    }

    const recipients = await loadRecipients(adminClient);
    const sent: Array<{ email: string; resend_message_id?: string | null }> = [];
    const failed: Array<{ email: string; error: string }> = [];

    for (const recipient of recipients) {
      try {
        const response = await sendResendCampaignEmail({
          to: recipient.email,
          subject: template.subject,
          text: template.text,
          html: template.html,
        });
        sent.push({ email: recipient.email, resend_message_id: response.id || null });
      } catch (error) {
        failed.push({
          email: recipient.email,
          error: error instanceof Error ? error.message : 'Unable to send email.',
        });
      }
    }

    return NextResponse.json({
      recipientCount: recipients.length,
      sentCount: sent.length,
      failedCount: failed.length,
      failed: failed.slice(0, 10),
    });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Shelf talker campaign send error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to send shelf talker campaign.' }, { status: 500 });
  }
}
