import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';
import {
  getCampaignValidationError,
  loadCampaignRecipients,
  renderEmailCampaign,
  sendResendCampaignEmail,
} from '@/lib/emailCampaigns';

export const dynamic = 'force-dynamic';

const SEND_BATCH_SIZE = 8;
const SEND_BATCH_DELAY_MS = 1100;

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { user, adminClient } = await requireAdminAccess();
    const body = await request.json().catch(() => ({}));

    if (body?.confirmText !== 'SEND') {
      return NextResponse.json({ error: 'Type SEND to confirm this campaign send.' }, { status: 400 });
    }

    const { data: campaign, error } = await adminClient
      .from('email_campaigns')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) throw error;
    if (!campaign) {
      return NextResponse.json({ error: 'Email campaign not found.' }, { status: 404 });
    }
    if (campaign.status === 'sent') {
      return NextResponse.json({ error: 'This campaign has already been sent.' }, { status: 400 });
    }

    const validationError = getCampaignValidationError(campaign);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const recipients = await loadCampaignRecipients(adminClient, campaign);
    if (recipients.length === 0) {
      return NextResponse.json({ error: 'No eligible recipients were found.' }, { status: 400 });
    }

    const recipientLogs: Array<{
      campaign_id: string;
      retailer_id?: string | null;
      email: string;
      company_name?: string | null;
      contact_name?: string | null;
      resend_message_id?: string | null;
      status: 'sent' | 'failed';
      error?: string | null;
    }> = [];

    for (let index = 0; index < recipients.length; index += 1) {
      const recipient = recipients[index]!;
      const rendered = renderEmailCampaign(campaign, recipient);

      try {
        const response = await sendResendCampaignEmail({
          to: recipient.email,
          subject: rendered.subject,
          text: rendered.text,
          html: rendered.html,
          campaignId: params.id,
        });
        recipientLogs.push({
          campaign_id: params.id,
          retailer_id: recipient.retailer_id || null,
          email: recipient.email,
          company_name: recipient.company_name || null,
          contact_name: recipient.contact_name || null,
          resend_message_id: response.id || null,
          status: 'sent',
        });
      } catch (sendError) {
        recipientLogs.push({
          campaign_id: params.id,
          retailer_id: recipient.retailer_id || null,
          email: recipient.email,
          company_name: recipient.company_name || null,
          contact_name: recipient.contact_name || null,
          status: 'failed',
          error: sendError instanceof Error ? sendError.message : 'Unable to send email.',
        });
      }

      if ((index + 1) % SEND_BATCH_SIZE === 0 && index < recipients.length - 1) {
        await sleep(SEND_BATCH_DELAY_MS);
      }
    }

    const { error: logError } = await adminClient
      .from('email_campaign_recipients')
      .insert(recipientLogs);

    if (logError) throw logError;

    const sentCount = recipientLogs.filter((recipient) => recipient.status === 'sent').length;
    const failedCount = recipientLogs.length - sentCount;
    const { error: updateError } = await adminClient
      .from('email_campaigns')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        sent_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id);

    if (updateError) throw updateError;

    return NextResponse.json({
      recipientCount: recipients.length,
      sentCount,
      failedCount,
      sent: recipientLogs
        .filter((recipient) => recipient.status === 'sent')
        .slice(0, 10)
        .map((recipient) => ({
          email: recipient.email,
          resendMessageId: recipient.resend_message_id || null,
        })),
      failed: recipientLogs.filter((recipient) => recipient.status === 'failed').slice(0, 10),
    });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Email campaign send error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to send email campaign.' }, { status: 500 });
  }
}
