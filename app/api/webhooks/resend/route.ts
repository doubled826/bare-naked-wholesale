import { NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

type ResendEmailEventType =
  | 'email.delivered'
  | 'email.opened'
  | 'email.clicked'
  | 'email.bounced'
  | 'email.complained'
  | string;

type ResendWebhookPayload = {
  type?: ResendEmailEventType;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[];
    tags?: Record<string, string>;
    click?: {
      link?: string;
      timestamp?: string;
    };
  };
};

type CampaignRecipientEventState = {
  id: string;
  campaign_id: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  complained_at: string | null;
  last_event_at: string | null;
};

const trackedEventColumns: Record<string, keyof CampaignRecipientEventState> = {
  'email.delivered': 'delivered_at',
  'email.opened': 'opened_at',
  'email.clicked': 'clicked_at',
  'email.bounced': 'bounced_at',
  'email.complained': 'complained_at',
};

const isEarlier = (incoming: string, existing: string | null) =>
  !existing || new Date(incoming).getTime() < new Date(existing).getTime();

const isLater = (incoming: string, existing: string | null) =>
  !existing || new Date(incoming).getTime() > new Date(existing).getTime();

const getEventTimestamp = (event: ResendWebhookPayload) =>
  event.type === 'email.clicked' && event.data?.click?.timestamp
    ? event.data.click.timestamp
    : event.created_at || new Date().toISOString();

export async function POST(request: Request) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('Missing RESEND_WEBHOOK_SECRET for Resend webhook.');
    return NextResponse.json({ error: 'Webhook is not configured.' }, { status: 500 });
  }

  const payload = await request.text();
  let event: ResendWebhookPayload;

  try {
    const webhook = new Webhook(webhookSecret);
    event = webhook.verify(payload, {
      'svix-id': request.headers.get('svix-id') || '',
      'svix-timestamp': request.headers.get('svix-timestamp') || '',
      'svix-signature': request.headers.get('svix-signature') || '',
    }) as ResendWebhookPayload;
  } catch (error) {
    console.error('Invalid Resend webhook signature:', error);
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 400 });
  }

  const svixId = request.headers.get('svix-id');
  const eventType = event.type || 'unknown';
  const resendMessageId = event.data?.email_id || null;
  const eventTimestamp = getEventTimestamp(event);
  const recipientEmail = event.data?.to?.[0] || null;
  const clickedUrl = event.type === 'email.clicked' ? event.data?.click?.link || null : null;
  const adminClient = createSupabaseAdminClient();

  if (!svixId) {
    return NextResponse.json({ error: 'Missing webhook delivery id.' }, { status: 400 });
  }

  let campaignRecipient: CampaignRecipientEventState | null = null;

  if (resendMessageId) {
    const { data, error } = await adminClient
      .from('email_campaign_recipients')
      .select('id, campaign_id, delivered_at, opened_at, clicked_at, bounced_at, complained_at, last_event_at')
      .eq('resend_message_id', resendMessageId)
      .maybeSingle();

    if (error) {
      console.error('Unable to load campaign recipient for Resend event:', error);
      return NextResponse.json({ error: 'Unable to process webhook.' }, { status: 500 });
    }

    campaignRecipient = (data || null) as CampaignRecipientEventState | null;
  }

  const { data: insertedEvent, error: insertError } = await adminClient
    .from('resend_email_events')
    .upsert(
      {
        svix_id: svixId,
        resend_message_id: resendMessageId,
        event_type: eventType,
        event_created_at: eventTimestamp,
        recipient_email: recipientEmail,
        campaign_id: campaignRecipient?.campaign_id || null,
        campaign_recipient_id: campaignRecipient?.id || null,
        clicked_url: clickedUrl,
        raw_payload: event,
      },
      { onConflict: 'svix_id', ignoreDuplicates: true },
    )
    .select('id')
    .maybeSingle();

  if (insertError) {
    console.error('Unable to store Resend email event:', insertError);
    return NextResponse.json({ error: 'Unable to store webhook.' }, { status: 500 });
  }

  if (!insertedEvent) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const eventColumn = trackedEventColumns[eventType];

  if (campaignRecipient && eventColumn) {
    const updates: Partial<Record<keyof CampaignRecipientEventState, string>> = {};

    if (isEarlier(eventTimestamp, campaignRecipient[eventColumn] as string | null)) {
      updates[eventColumn] = eventTimestamp;
    }

    if (isLater(eventTimestamp, campaignRecipient.last_event_at)) {
      updates.last_event_at = eventTimestamp;
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await adminClient
        .from('email_campaign_recipients')
        .update(updates)
        .eq('id', campaignRecipient.id);

      if (updateError) {
        console.error('Unable to update campaign recipient event summary:', updateError);
        return NextResponse.json({ error: 'Unable to process webhook.' }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
