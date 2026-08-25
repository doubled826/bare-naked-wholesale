import { NextResponse } from 'next/server';
import {
  BARE_LAUNCH_OFFER_DAYS,
  getBareLaunchOfferStatus,
} from '@/lib/bareLaunchOffer';
import { getTeamEmailTo, sendEmail } from '@/lib/email';
import { type EmailTemplateKey, renderEmailTemplate } from '@/lib/emailTemplates';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const MS_IN_DAY = 1000 * 60 * 60 * 24;

const reminderStages: Array<{ templateKey: EmailTemplateKey; dayOffset: number }> = [
  { templateKey: 'bare_launch_offer_day_1', dayOffset: 1 },
  { templateKey: 'bare_launch_offer_day_4', dayOffset: 7 },
  { templateKey: 'bare_launch_offer_day_9', dayOffset: 11 },
  { templateKey: 'bare_launch_offer_final', dayOffset: 13 },
];

const getAppUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'https://wholesale.barenakedpet.com';
const getRetailerEmailFrom = () =>
  process.env.ORDER_EMAIL_FROM || process.env.SMTP_USER || getTeamEmailTo();
const getReplyToEmail = () => process.env.REPLY_TO_EMAIL || getTeamEmailTo();

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authorization = request.headers.get('authorization');
  const headerSecret = request.headers.get('x-cron-secret');
  return authorization === `Bearer ${secret}` || headerSecret === secret;
}

function daysSince(date: string | Date, now: Date) {
  return Math.floor((now.getTime() - new Date(date).getTime()) / MS_IN_DAY);
}

function formatDateLabel(date: string | Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

async function handleReminderRun(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminClient = createSupabaseAdminClient();
  const now = new Date();
  const windowStart = new Date(now.getTime() - BARE_LAUNCH_OFFER_DAYS * MS_IN_DAY).toISOString();

  const { data: retailers, error: retailersError } = await adminClient
    .from('retailers')
    .select('id, company_name, created_at, status')
    .gte('created_at', windowStart)
    .order('created_at', { ascending: true });

  if (retailersError) {
    throw retailersError;
  }

  const retailerRows = retailers || [];
  if (retailerRows.length === 0) {
    return NextResponse.json({ success: true, sent: 0, skipped: 0, candidates: 0 });
  }

  const retailerIds = retailerRows.map((retailer) => retailer.id);
  const [
    { data: orderRows, error: ordersError },
    { data: sentRows, error: sentError },
    { data: preferenceRows, error: preferencesError },
  ] = await Promise.all([
    adminClient
      .from('orders')
      .select('retailer_id')
      .in('retailer_id', retailerIds)
      .neq('status', 'canceled'),
    adminClient
      .from('bare_launch_offer_email_reminders')
      .select('retailer_id, template_key')
      .in('retailer_id', retailerIds),
    adminClient
      .from('welcome_offer_reminder_preferences')
      .select('retailer_id, opted_out_at')
      .in('retailer_id', retailerIds),
  ]);

  if (ordersError) throw ordersError;
  if (sentError) throw sentError;
  if (preferencesError) throw preferencesError;

  const retailersWithOrders = new Set((orderRows || []).map((order) => order.retailer_id));
  const optedOutRetailers = new Set(
    (preferenceRows || [])
      .filter((preference) => Boolean(preference.opted_out_at))
      .map((preference) => preference.retailer_id),
  );
  const sentByRetailer = new Map<string, Set<string>>();
  (sentRows || []).forEach((row) => {
    const current = sentByRetailer.get(row.retailer_id) || new Set<string>();
    current.add(row.template_key);
    sentByRetailer.set(row.retailer_id, current);
  });

  let sent = 0;
  let skipped = 0;
  const errors: Array<{ retailerId: string; templateKey: string; error: string }> = [];

  for (const retailer of retailerRows) {
    if (['inactive', 'deleted'].includes(String(retailer.status || '').toLowerCase())) {
      skipped += 1;
      continue;
    }

    if (optedOutRetailers.has(retailer.id)) {
      skipped += 1;
      continue;
    }

    if (retailersWithOrders.has(retailer.id)) {
      skipped += 1;
      continue;
    }

    const offer = getBareLaunchOfferStatus({
      accountCreatedAt: retailer.created_at,
      activeOrderCount: 0,
      now,
    });

    if (!offer.eligible || !offer.expiresAt) {
      skipped += 1;
      continue;
    }

    const accountAgeDays = daysSince(retailer.created_at, now);
    const alreadySent = sentByRetailer.get(retailer.id) || new Set<string>();
    const dueStages = reminderStages.filter(
      (stage) => accountAgeDays >= stage.dayOffset && !alreadySent.has(stage.templateKey),
    );

    if (dueStages.length === 0) {
      skipped += 1;
      continue;
    }

    const stage = dueStages[0];
    const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(retailer.id);
    const recipient = userData?.user?.email;

    if (userError || !recipient) {
      errors.push({
        retailerId: retailer.id,
        templateKey: stage.templateKey,
        error: userError?.message || 'Retailer email not found.',
      });
      continue;
    }

    const template = renderEmailTemplate(stage.templateKey, [], {
      storeName: retailer.company_name || 'your store',
      daysRemaining: offer.daysRemaining,
      expiresAtLabel: formatDateLabel(offer.expiresAt),
      catalogUrl: `${getAppUrl()}/catalog?offer=bare-launch`,
    });

    if (!template) {
      errors.push({
        retailerId: retailer.id,
        templateKey: stage.templateKey,
        error: 'Template not found.',
      });
      continue;
    }

    try {
      await sendEmail({
        from: getRetailerEmailFrom(),
        to: recipient,
        replyTo: getReplyToEmail(),
        subject: template.subject,
        text: template.text,
        html: template.html,
        tags: [
          { name: 'feature', value: 'welcome-offer' },
          { name: 'template', value: template.key },
        ],
      });

      const { error: insertError } = await adminClient
        .from('bare_launch_offer_email_reminders')
        .insert({
          retailer_id: retailer.id,
          template_key: stage.templateKey,
          sent_at: now.toISOString(),
        });

      if (insertError) throw insertError;
      sent += 1;
    } catch (error) {
      errors.push({
        retailerId: retailer.id,
        templateKey: stage.templateKey,
        error: error instanceof Error ? error.message : 'Unable to send reminder.',
      });
    }
  }

  return NextResponse.json({
    success: errors.length === 0,
    sent,
    skipped,
    candidates: retailerRows.length,
    errors,
  }, { status: errors.length > 0 ? 207 : 200 });
}

export async function GET(request: Request) {
  return handleReminderRun(request);
}

export async function POST(request: Request) {
  return handleReminderRun(request);
}
