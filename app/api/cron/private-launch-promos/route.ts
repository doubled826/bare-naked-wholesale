import { NextResponse } from 'next/server';
import {
  getPrivatePromoStatusForDates,
  sendPrivateLaunchPromoEmail,
  type PrivateLaunchPromoStage,
  type PrivateLaunchPromoStatus,
} from '@/lib/privateLaunchPromo';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const MS_IN_DAY = 1000 * 60 * 60 * 24;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authorization = request.headers.get('authorization');
  const headerSecret = request.headers.get('x-cron-secret');
  return authorization === `Bearer ${secret}` || headerSecret === secret;
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function daysBetween(startDate: string | Date, endDate: Date) {
  const start = new Date(startDate);
  return Math.floor((endDate.getTime() - start.getTime()) / MS_IN_DAY);
}

function shouldSendDatesNeededReminder(row: any, now: Date) {
  if (row.last_email_stage !== 'dates_needed') return true;
  if (!row.last_reminder_sent_at) return true;
  return daysBetween(row.last_reminder_sent_at, now) >= 3;
}

function getDueStage(row: any, now: Date): PrivateLaunchPromoStage | null {
  const today = dateKey(now);

  if (row.status === 'dates_needed') {
    return shouldSendDatesNeededReminder(row, now) ? 'dates_needed' : null;
  }

  if (!row.start_date || !row.end_date || row.status === 'completed' || row.status === 'canceled') {
    return null;
  }

  const start = new Date(row.start_date);
  const daysUntilStart = Math.ceil((start.getTime() - now.getTime()) / MS_IN_DAY);

  if (daysUntilStart <= 3 && daysUntilStart > 0 && row.last_email_stage !== 'prelaunch') {
    return 'prelaunch';
  }

  if (today === row.start_date && row.last_email_stage !== 'launch_day') {
    return 'launch_day';
  }

  if (today > row.end_date && !row.sales_summary_requested_at) {
    return 'post_promo';
  }

  if (today > row.end_date && row.sales_summary_requested_at && !row.sales_summary_received_at) {
    if (!row.last_reminder_sent_at) return 'sales_summary_reminder';
    return daysBetween(row.last_reminder_sent_at, now) >= 7 ? 'sales_summary_reminder' : null;
  }

  return null;
}

async function handleCron(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminClient = createSupabaseAdminClient();
  const now = new Date();
  const nowIso = now.toISOString();

  const { data: rows, error } = await adminClient
    .from('launch_promo_requests')
    .select('*, retailer:retailers(company_name, status)')
    .in('status', ['dates_needed', 'scheduled', 'active', 'awaiting_sales_summary']);

  if (error) throw error;

  let sent = 0;
  let updated = 0;
  let skipped = 0;
  const errors: Array<{ retailerId: string; stage?: string; error: string }> = [];

  for (const row of rows || []) {
    if (['inactive', 'deleted'].includes(String(row.retailer?.status || '').toLowerCase())) {
      skipped += 1;
      continue;
    }

    const nextStatus: PrivateLaunchPromoStatus = getPrivatePromoStatusForDates({
      startDate: row.start_date,
      endDate: row.end_date,
      salesSummaryReceivedAt: row.sales_summary_received_at,
      fallbackStatus: row.status,
      now,
    });

    const stage = getDueStage(row, now);
    const updatePayload: Record<string, unknown> = {
      status: nextStatus,
      updated_at: nowIso,
    };

    if (stage === 'post_promo') {
      updatePayload.sales_summary_requested_at = nowIso;
      updatePayload.last_reminder_sent_at = nowIso;
      updatePayload.last_email_stage = stage;
    } else if (stage) {
      updatePayload.last_reminder_sent_at = nowIso;
      updatePayload.last_email_stage = stage;
    }

    try {
      if (stage) {
        const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(row.retailer_id);
        const recipient = userData?.user?.email;
        if (userError || !recipient) {
          throw new Error(userError?.message || 'Retailer email not found.');
        }

        await sendPrivateLaunchPromoEmail({
          to: recipient,
          storeName: row.retailer?.company_name || 'your store',
          stage,
          startDate: row.start_date,
          endDate: row.end_date,
          durationWeeks: row.duration_weeks,
          discountPercent: row.promo_discount_percent,
        });
        sent += 1;
      }

      const { error: updateError } = await adminClient
        .from('launch_promo_requests')
        .update(updatePayload)
        .eq('id', row.id);
      if (updateError) throw updateError;

      const profilePayload: Record<string, unknown> = {
        retailer_id: row.retailer_id,
        launch_promo_status: nextStatus,
        private_promo_status: nextStatus,
        private_promo_start_date: row.start_date,
        private_promo_end_date: row.end_date,
        private_promo_duration_weeks: row.duration_weeks,
        private_promo_discount_percent: row.promo_discount_percent,
        private_promo_sales_summary_requested_at: stage === 'post_promo'
          ? nowIso
          : row.sales_summary_requested_at,
        private_promo_last_reminder_sent_at: stage ? nowIso : row.last_reminder_sent_at,
        private_promo_last_email_stage: stage || row.last_email_stage,
        success_plan_last_updated_at: nowIso,
        updated_at: nowIso,
      };

      const { error: profileError } = await adminClient
        .from('retailer_success_profiles')
        .upsert(profilePayload, { onConflict: 'retailer_id' });
      if (profileError) throw profileError;

      updated += 1;
    } catch (stageError) {
      errors.push({
        retailerId: row.retailer_id,
        stage: stage || undefined,
        error: stageError instanceof Error ? stageError.message : 'Unable to process private promo.',
      });
    }
  }

  return NextResponse.json({
    success: errors.length === 0,
    candidates: rows?.length || 0,
    sent,
    updated,
    skipped,
    errors,
  }, { status: errors.length > 0 ? 207 : 200 });
}

export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}
