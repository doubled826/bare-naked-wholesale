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
  delivered_at?: string | null;
  opened_at?: string | null;
  clicked_at?: string | null;
  bounced_at?: string | null;
  complained_at?: string | null;
  last_event_at?: string | null;
};

type ClickEventRow = {
  clicked_url?: string | null;
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
        .select('id, email, company_name, contact_name, resend_message_id, status, error, sent_at, delivered_at, opened_at, clicked_at, bounced_at, complained_at, last_event_at')
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
      deliveredAt: recipient.delivered_at || null,
      openedAt: recipient.opened_at || null,
      clickedAt: recipient.clicked_at || null,
      bouncedAt: recipient.bounced_at || null,
      complainedAt: recipient.complained_at || null,
      lastEventAt: recipient.last_event_at || null,
    }));

    const accepted = recipientRows.filter((recipient) => recipient.status === 'sent').length;
    const failed = recipientRows.filter((recipient) => recipient.status === 'failed').length;
    const delivered = recipientRows.filter((recipient) => recipient.deliveredAt).length;
    const opened = recipientRows.filter((recipient) => recipient.openedAt).length;
    const clicked = recipientRows.filter((recipient) => recipient.clickedAt).length;
    const bounced = recipientRows.filter((recipient) => recipient.bouncedAt).length;
    const complained = recipientRows.filter((recipient) => recipient.complainedAt).length;

    const { data: clickEvents, error: clickEventsError } = await adminClient
      .from('resend_email_events')
      .select('clicked_url')
      .eq('campaign_id', params.id)
      .eq('event_type', 'email.clicked')
      .not('clicked_url', 'is', null);

    if (clickEventsError) throw clickEventsError;

    const topClickedLinks = Array.from(
      ((clickEvents || []) as ClickEventRow[]).reduce((counts, event) => {
        const url = event.clicked_url;
        if (!url) return counts;
        counts.set(url, (counts.get(url) || 0) + 1);
        return counts;
      }, new Map<string, number>()),
    )
      .map(([url, count]) => ({ url, count }))
      .sort((a, b) => b.count - a.count || a.url.localeCompare(b.url))
      .slice(0, 5);

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
        delivered,
        opened,
        clicked,
        bounced,
        complained,
      },
      topClickedLinks,
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
