import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    id: string;
  };
};

type RecipientRow = {
  id: string;
  email: string;
  company_name?: string | null;
  contact_name?: string | null;
  resend_message_id?: string | null;
  status: 'sent' | 'failed';
  error?: string | null;
  sent_at?: string | null;
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { adminClient } = await requireAdminAccess();

    const [{ data: campaign, error: campaignError }, { data: recipients, error: recipientsError }] = await Promise.all([
      adminClient
        .from('email_campaigns')
        .select('id, name, subject, status, sent_at')
        .eq('id', params.id)
        .single(),
      adminClient
        .from('email_campaign_recipients')
        .select('id, email, company_name, contact_name, resend_message_id, status, error, sent_at')
        .eq('campaign_id', params.id)
        .order('sent_at', { ascending: false }),
    ]);

    if (campaignError) throw campaignError;
    if (!campaign) {
      return NextResponse.json({ error: 'Email campaign not found.' }, { status: 404 });
    }
    if (recipientsError) throw recipientsError;

    const recipientRows = ((recipients || []) as RecipientRow[]).map((recipient) => ({
      id: recipient.id,
      email: recipient.email,
      companyName: recipient.company_name || null,
      contactName: recipient.contact_name || null,
      resendMessageId: recipient.resend_message_id || null,
      status: recipient.status,
      error: recipient.error || null,
      sentAt: recipient.sent_at || null,
    }));

    const accepted = recipientRows.filter((recipient) => recipient.status === 'sent').length;
    const failed = recipientRows.filter((recipient) => recipient.status === 'failed').length;

    return NextResponse.json({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        subject: campaign.subject,
        status: campaign.status,
        sentAt: campaign.sent_at || null,
      },
      summary: {
        total: recipientRows.length,
        accepted,
        failed,
      },
      recipients: recipientRows,
    });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Email campaign delivery load error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load delivery details.' }, { status: 500 });
  }
}
