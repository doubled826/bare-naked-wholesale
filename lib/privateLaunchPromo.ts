import { sendRetailerEmail } from './email';

export type PrivateLaunchPromoStatus =
  | 'not_started'
  | 'dates_needed'
  | 'scheduled'
  | 'active'
  | 'awaiting_sales_summary'
  | 'completed'
  | 'canceled';

export type PrivateLaunchPromoSource = 'welcome_offer' | 'dashboard_request' | 'admin_created';

export type PrivateLaunchPromoStage =
  | 'scheduled_confirmation'
  | 'dates_needed'
  | 'prelaunch'
  | 'launch_day'
  | 'post_promo'
  | 'sales_summary_reminder';

const MS_IN_DAY = 1000 * 60 * 60 * 24;
export const PRIVATE_LAUNCH_PROMO_DISCOUNT_PERCENT = 10;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

export function addPromoWeeks(startDate: string | Date, durationWeeks: number) {
  const start = new Date(startDate);
  const end = new Date(start.getTime() + (durationWeeks * 7 - 1) * MS_IN_DAY);
  return end.toISOString().slice(0, 10);
}

export function getPrivatePromoStatusForDates({
  startDate,
  endDate,
  salesSummaryReceivedAt,
  fallbackStatus = 'scheduled',
  now = new Date(),
}: {
  startDate?: string | null;
  endDate?: string | null;
  salesSummaryReceivedAt?: string | null;
  fallbackStatus?: PrivateLaunchPromoStatus;
  now?: Date;
}): PrivateLaunchPromoStatus {
  if (salesSummaryReceivedAt) return 'completed';
  if (!startDate || !endDate) return fallbackStatus;

  const today = now.toISOString().slice(0, 10);
  if (today < startDate) return 'scheduled';
  if (today >= startDate && today <= endDate) return 'active';
  return 'awaiting_sales_summary';
}

export function buildPrivatePromoSchedule({
  startDate,
  durationWeeks,
}: {
  startDate: string;
  durationWeeks: number;
}) {
  return {
    startDate,
    endDate: addPromoWeeks(startDate, durationWeeks),
    durationWeeks,
    discountPercent: PRIVATE_LAUNCH_PROMO_DISCOUNT_PERCENT,
  };
}

export async function setPrivatePromoDatesNeeded({
  adminClient,
  retailerId,
  source,
}: {
  adminClient: any;
  retailerId: string;
  source: PrivateLaunchPromoSource;
}) {
  const now = new Date().toISOString();

  await adminClient
    .from('retailer_success_profiles')
    .upsert({
      retailer_id: retailerId,
      launch_promo_status: 'dates_needed',
      private_promo_status: 'dates_needed',
      private_promo_source: source,
      private_promo_discount_percent: PRIVATE_LAUNCH_PROMO_DISCOUNT_PERCENT,
      success_plan_last_updated_at: now,
      updated_at: now,
    }, { onConflict: 'retailer_id' });

  const { data: existingRequest } = await adminClient
    .from('launch_promo_requests')
    .select('id, status')
    .eq('retailer_id', retailerId)
    .neq('status', 'canceled')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingRequest?.id && existingRequest.status !== 'completed') return existingRequest;

  const { data, error } = await adminClient
    .from('launch_promo_requests')
    .insert({
      retailer_id: retailerId,
      promo_discount_percent: PRIVATE_LAUNCH_PROMO_DISCOUNT_PERCENT,
      duration_weeks: 2,
      status: 'dates_needed',
      source,
    })
    .select('id, status')
    .single();

  if (error) throw error;
  return data;
}

export async function schedulePrivateLaunchPromo({
  adminClient,
  retailerId,
  source,
  startDate,
  durationWeeks,
  retailerNotes = '',
}: {
  adminClient: any;
  retailerId: string;
  source: PrivateLaunchPromoSource;
  startDate: string;
  durationWeeks: number;
  retailerNotes?: string;
}) {
  const schedule = buildPrivatePromoSchedule({ startDate, durationWeeks });
  const now = new Date().toISOString();
  const status = getPrivatePromoStatusForDates({
    startDate: schedule.startDate,
    endDate: schedule.endDate,
    now: new Date(),
  });

  const { data: existingRequest } = await adminClient
    .from('launch_promo_requests')
    .select('id')
    .eq('retailer_id', retailerId)
    .neq('status', 'completed')
    .neq('status', 'canceled')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const requestPayload = {
    retailer_id: retailerId,
    promo_discount_percent: schedule.discountPercent,
    duration_weeks: schedule.durationWeeks,
    start_date: schedule.startDate,
    end_date: schedule.endDate,
    status,
    source,
    retailer_notes: retailerNotes,
    updated_at: now,
  };

  const { data: promoRequest, error } = existingRequest?.id
    ? await adminClient
        .from('launch_promo_requests')
        .update(requestPayload)
        .eq('id', existingRequest.id)
        .select('*')
        .single()
    : await adminClient
        .from('launch_promo_requests')
        .insert(requestPayload)
        .select('*')
        .single();

  if (error) throw error;

  const profilePayload = {
    retailer_id: retailerId,
    launch_promo_status: status,
    private_promo_status: status,
    private_promo_source: source,
    private_promo_start_date: schedule.startDate,
    private_promo_end_date: schedule.endDate,
    private_promo_duration_weeks: schedule.durationWeeks,
    private_promo_discount_percent: schedule.discountPercent,
    private_promo_last_email_stage: 'scheduled_confirmation',
    success_plan_last_updated_at: now,
    updated_at: now,
  };

  const { error: profileError } = await adminClient
    .from('retailer_success_profiles')
    .upsert(profilePayload, { onConflict: 'retailer_id' });

  if (profileError) throw profileError;

  return promoRequest;
}

function formatDateLabel(date: string | Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

export function buildPrivateLaunchPromoEmail({
  stage,
  storeName,
  startDate,
  endDate,
  durationWeeks,
  discountPercent = PRIVATE_LAUNCH_PROMO_DISCOUNT_PERCENT,
}: {
  stage: PrivateLaunchPromoStage;
  storeName: string;
  startDate?: string | null;
  endDate?: string | null;
  durationWeeks?: number | null;
  discountPercent?: number | null;
}) {
  const dateRange = startDate && endDate
    ? `${formatDateLabel(startDate)} through ${formatDateLabel(endDate)}`
    : 'your selected promo dates';
  const length = durationWeeks ? `${durationWeeks}-week` : 'private';
  const discount = discountPercent || PRIVATE_LAUNCH_PROMO_DISCOUNT_PERCENT;

  const copyByStage: Record<PrivateLaunchPromoStage, { subject: string; intro: string; body: string }> = {
    scheduled_confirmation: {
      subject: `Your Bare private promo is scheduled`,
      intro: `Your ${length} Bare private promo is scheduled for ${dateRange}.`,
      body: `During that window, mark Bare down ${discount}% in your POS. After the promo ends, reply to this email with a screenshot or short summary of Bare POS sales from ${dateRange}.`,
    },
    dates_needed: {
      subject: `Choose your Bare private promo dates`,
      intro: `Your Welcome Offer includes a private Bare launch promo, and we still need your preferred dates.`,
      body: `Pick a 2, 3, or 4 week window in the portal. During that window, mark Bare down ${discount}% in your POS. After it ends, reply with a screenshot or short summary of Bare POS sales from that date range.`,
    },
    prelaunch: {
      subject: `Your Bare private promo starts soon`,
      intro: `Your Bare private promo starts on ${startDate ? formatDateLabel(startDate) : 'your selected start date'}.`,
      body: `For ${dateRange}, mark Bare down ${discount}% in your POS. When the promo is over, send us a screenshot or short summary of Bare POS sales from the promo date range.`,
    },
    launch_day: {
      subject: `Your Bare private promo starts today`,
      intro: `Your Bare private promo is live for ${dateRange}.`,
      body: `Mark Bare down ${discount}% in your POS during the promo. After the end date, reply to this email with a screenshot or short summary of Bare POS sales from the selected date range.`,
    },
    post_promo: {
      subject: `Send us your Bare promo sales summary`,
      intro: `Your Bare private promo has wrapped up.`,
      body: `Please reply with a screenshot or short summary of Bare POS sales from ${dateRange}. That is all we need from your team.`,
    },
    sales_summary_reminder: {
      subject: `Reminder: Bare promo sales summary`,
      intro: `Quick reminder from Bare Naked Pet Co.`,
      body: `Please reply with a screenshot or short summary of Bare POS sales from ${dateRange}. A POS screenshot is perfect.`,
    },
  };

  const copy = copyByStage[stage];
  const safeStoreName = escapeHtml(storeName);
  const safeSubject = escapeHtml(copy.subject);
  const safeIntro = escapeHtml(copy.intro);
  const safeBody = escapeHtml(copy.body);
  const text = `Hi ${storeName},

${copy.intro}

${copy.body}

Thanks,
Bare Naked Pet Co.`;

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8f4ec;font-family:Arial,Helvetica,sans-serif;color:#3b2a1e;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f4ec;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #eadfce;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:24px 26px;">
                <p style="margin:0;color:#7a4f2a;font-weight:700;font-size:13px;letter-spacing:.04em;text-transform:uppercase;">Bare Naked Pet Co.</p>
                <h1 style="margin:12px 0 8px;font-size:24px;line-height:1.25;color:#3b2a1e;">${safeSubject}</h1>
                <p style="margin:16px 0 0;color:#6b5f55;font-size:15px;line-height:1.6;">Hi ${safeStoreName},</p>
                <p style="margin:12px 0 0;color:#6b5f55;font-size:15px;line-height:1.6;">${safeIntro}</p>
                <p style="margin:12px 0 0;color:#6b5f55;font-size:15px;line-height:1.6;">${safeBody}</p>
                <div style="margin-top:18px;padding:14px;border-radius:10px;background:#f8f4ec;border:1px solid #eadfce;color:#4a3323;font-size:14px;line-height:1.6;">
                  <strong>Simple version:</strong> mark Bare down ${discount}% during the promo, then reply with a POS screenshot or sales summary after it ends.
                </div>
                <p style="margin:18px 0 0;color:#6b5f55;font-size:15px;line-height:1.6;">Thanks,<br />Bare Naked Pet Co.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return {
    subject: copy.subject,
    text,
    html,
  };
}

export async function sendPrivateLaunchPromoEmail({
  to,
  storeName,
  stage,
  startDate,
  endDate,
  durationWeeks,
  discountPercent,
}: {
  to: string;
  storeName: string;
  stage: PrivateLaunchPromoStage;
  startDate?: string | null;
  endDate?: string | null;
  durationWeeks?: number | null;
  discountPercent?: number | null;
}) {
  const email = buildPrivateLaunchPromoEmail({
    stage,
    storeName,
    startDate,
    endDate,
    durationWeeks,
    discountPercent,
  });

  await sendRetailerEmail({
    to,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
}
