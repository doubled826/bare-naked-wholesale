import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  BARE_LAUNCH_OFFER_DAYS,
  getBareLaunchOfferStatus,
} from '@/lib/bareLaunchOffer';
import { getTeamEmailTo, sendEmail } from '@/lib/email';
import { renderEmailTemplate } from '@/lib/emailTemplates';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const REMINDER_TEMPLATE_KEY = 'bare_launch_offer_remind_me_later';

const getAppUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'https://wholesale.barenakedpet.com';
const getRetailerEmailFrom = () =>
  process.env.ORDER_EMAIL_FROM || process.env.SMTP_USER || getTeamEmailTo();
const getReplyToEmail = () => process.env.REPLY_TO_EMAIL || getTeamEmailTo();

function formatDateLabel(date: string | Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

function isInactiveRetailer(status?: string | null) {
  return ['inactive', 'deleted'].includes(String(status || '').toLowerCase());
}

export async function POST(request: Request) {
  const now = new Date();
  let retailerId: string | null = null;
  let daysRemaining = 0;
  let reminderSequenceStatus = 'not_started';

  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    retailerId = user.id;
    const body = await request.json().catch(() => ({}));
    const requestedDaysRemaining = Number(body?.daysRemaining);
    const adminClient = createSupabaseAdminClient();

    const recordReminderRequest = async (status: string, recordedDaysRemaining = daysRemaining) => {
      const { error } = await adminClient
        .from('welcome_offer_reminder_requests')
        .insert({
          retailer_id: user.id,
          clicked_at: now.toISOString(),
          days_remaining: recordedDaysRemaining,
          reminder_sequence_status: status,
        });

      if (error) throw error;
    };

    const { data: retailer, error: retailerError } = await adminClient
      .from('retailers')
      .select('id, company_name, created_at, status')
      .eq('id', user.id)
      .maybeSingle();

    if (retailerError) throw retailerError;
    if (!retailer || isInactiveRetailer(retailer.status)) {
      reminderSequenceStatus = 'ineligible';
      await recordReminderRequest(reminderSequenceStatus);
      return NextResponse.json({ error: 'Retailer is not eligible for Welcome Offer reminders.' }, { status: 400 });
    }

    const { count: activeOrderCount, error: ordersError } = await adminClient
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('retailer_id', user.id)
      .neq('status', 'canceled');

    if (ordersError) throw ordersError;

    const offer = getBareLaunchOfferStatus({
      accountCreatedAt: retailer.created_at,
      activeOrderCount: activeOrderCount || 0,
      now,
    });
    daysRemaining = offer.daysRemaining || Math.max(0, requestedDaysRemaining || 0);

    if (!offer.eligible || !offer.expiresAt) {
      reminderSequenceStatus = 'ineligible';
      await recordReminderRequest(reminderSequenceStatus, daysRemaining);
      return NextResponse.json({ error: 'This Welcome Offer is no longer active.' }, { status: 400 });
    }

    const { data: sentRows, error: sentError } = await adminClient
      .from('bare_launch_offer_email_reminders')
      .select('template_key')
      .eq('retailer_id', user.id);

    if (sentError) throw sentError;

    const sentTemplateKeys = new Set((sentRows || []).map((row) => row.template_key));
    const alreadyEnrolled = sentTemplateKeys.size > 0;
    reminderSequenceStatus = alreadyEnrolled ? 'already_enrolled' : 'enrolled';

    const { error: preferenceError } = await adminClient
      .from('welcome_offer_reminder_preferences')
      .upsert({
        retailer_id: user.id,
        remind_me_later_requested: true,
        updated_at: now.toISOString(),
      }, { onConflict: 'retailer_id' });

    if (preferenceError) throw preferenceError;

    if (!alreadyEnrolled && user.email) {
      const template = renderEmailTemplate(REMINDER_TEMPLATE_KEY, [], {
        storeName: retailer.company_name || 'your store',
        daysRemaining: offer.daysRemaining,
        expiresAtLabel: formatDateLabel(offer.expiresAt),
        catalogUrl: `${getAppUrl()}/catalog?offer=bare-launch`,
      });

      if (template) {
        await sendEmail({
          from: getRetailerEmailFrom(),
          to: user.email,
          replyTo: getReplyToEmail(),
          subject: template.subject,
          text: template.text,
          html: template.html,
          tags: [
            { name: 'feature', value: 'welcome-offer' },
            { name: 'template', value: template.key },
          ],
        });

        const { error: insertReminderError } = await adminClient
          .from('bare_launch_offer_email_reminders')
          .insert([
            {
              retailer_id: user.id,
              template_key: REMINDER_TEMPLATE_KEY,
              sent_at: now.toISOString(),
            },
            {
              retailer_id: user.id,
              template_key: 'bare_launch_offer_day_1',
              sent_at: now.toISOString(),
            },
          ]);

        if (insertReminderError && insertReminderError.code !== '23505') {
          throw insertReminderError;
        }
      }
    }

    await recordReminderRequest(reminderSequenceStatus, offer.daysRemaining);

    return NextResponse.json({
      success: true,
      alreadyEnrolled,
      daysRemaining: offer.daysRemaining,
      reminderSequenceStatus,
    });
  } catch (error) {
    console.error('Welcome Offer reminder request error:', error);

    if (retailerId) {
      try {
        const adminClient = createSupabaseAdminClient();
        await adminClient
          .from('welcome_offer_reminder_requests')
          .insert({
            retailer_id: retailerId,
            clicked_at: now.toISOString(),
            days_remaining: daysRemaining,
            reminder_sequence_status: reminderSequenceStatus === 'not_started'
              ? 'failed'
              : `${reminderSequenceStatus}_failed`,
          });
      } catch (eventError) {
        console.error('Welcome Offer reminder failure logging error:', eventError);
      }
    }

    return NextResponse.json({ error: 'Unable to save reminder preference.' }, { status: 500 });
  }
}
