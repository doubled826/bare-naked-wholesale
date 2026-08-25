import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';
import { sendCustomerReviewEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

type ReviewRow = {
  id: string;
  title: string;
  review_text: string;
  reviewer_name: string | null;
  rating: number | null;
  product_name: string | null;
  image_url: string | null;
};

type ProspectRow = {
  id: string;
  store_name: string;
  contact_name: string | null;
  email: string;
  status: string;
  suppressed_at: string | null;
  last_customer_review_sent_at: string | null;
};

const DEFAULT_COOLDOWN_DAYS = 21;

function normalizeCtaMode(value: unknown): 'both' | 'samples' | 'wholesale' {
  if (value === 'samples' || value === 'wholesale') return value;
  return 'both';
}

function getCooldownDate() {
  const configuredDays = Number(process.env.OUTREACH_CUSTOMER_REVIEW_COOLDOWN_DAYS || DEFAULT_COOLDOWN_DAYS);
  const days = Number.isFinite(configuredDays) && configuredDays > 0 ? configuredDays : DEFAULT_COOLDOWN_DAYS;
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function isOutsideCooldown(value?: string | null) {
  if (!value) return true;
  const sentAt = new Date(value);
  if (Number.isNaN(sentAt.getTime())) return true;
  return sentAt < getCooldownDate();
}

export async function POST(request: Request) {
  try {
    const { user, adminClient } = await requireAdminAccess();
    const body = await request.json();
    const reviewId = typeof body?.reviewId === 'string' ? body.reviewId : '';
    const prospectIds = Array.isArray(body?.prospectIds) ? body.prospectIds.filter((id: unknown) => typeof id === 'string') : [];
    const subject = typeof body?.subject === 'string' && body.subject.trim()
      ? body.subject.trim()
      : 'New customer review | Bare Naked Pet Co.';
    const ctaMode = normalizeCtaMode(body?.ctaMode);

    if (!reviewId) {
      return NextResponse.json({ error: 'Choose a review before sending.' }, { status: 400 });
    }

    if (prospectIds.length === 0) {
      return NextResponse.json({ error: 'Choose at least one prospect.' }, { status: 400 });
    }

    const [{ data: review, error: reviewError }, { data: prospects, error: prospectsError }] = await Promise.all([
      adminClient
        .from('outreach_customer_reviews')
        .select('id, title, review_text, reviewer_name, rating, product_name, image_url')
        .eq('id', reviewId)
        .eq('is_active', true)
        .single(),
      adminClient
        .from('outreach_prospects')
        .select('id, store_name, contact_name, email, status, suppressed_at, last_customer_review_sent_at')
        .in('id', prospectIds),
    ]);

    if (reviewError || !review) {
      return NextResponse.json({ error: reviewError?.message || 'Review not found.' }, { status: 404 });
    }

    if (prospectsError) {
      return NextResponse.json({ error: prospectsError.message || 'Unable to load prospects.' }, { status: 400 });
    }

    const eligibleProspects = ((prospects || []) as ProspectRow[]).filter(
      (prospect) =>
        prospect.email &&
        !prospect.suppressed_at &&
        ['prospect', 'samples_sent'].includes(prospect.status) &&
        isOutsideCooldown(prospect.last_customer_review_sent_at),
    );

    if (eligibleProspects.length === 0) {
      return NextResponse.json({ error: 'No selected prospects are eligible to receive this email.' }, { status: 400 });
    }

    const { data: send, error: sendError } = await adminClient
      .from('outreach_email_sends')
      .insert({
        review_id: reviewId,
        subject,
        cta_mode: ctaMode,
        recipient_count: eligibleProspects.length,
        sent_by: user.id,
      })
      .select('id')
      .single();

    if (sendError || !send) {
      return NextResponse.json({ error: sendError?.message || 'Unable to create send log.' }, { status: 400 });
    }

    const sentAt = new Date().toISOString();
    const recipientLogs = [];
    const failed = [];

    for (const prospect of eligibleProspects) {
      try {
        const response = await sendCustomerReviewEmail({
          to: prospect.email,
          contactName: prospect.contact_name,
          storeName: prospect.store_name,
          subject,
          reviewText: (review as ReviewRow).review_text,
          reviewerName: (review as ReviewRow).reviewer_name,
          rating: (review as ReviewRow).rating,
          productName: (review as ReviewRow).product_name,
          imageUrl: (review as ReviewRow).image_url,
          ctaMode,
        });

        recipientLogs.push({
          send_id: send.id,
          prospect_id: prospect.id,
          email: prospect.email,
          store_name: prospect.store_name,
          contact_name: prospect.contact_name,
          resend_message_id: response.id || null,
          status: 'sent',
          sent_at: sentAt,
        });
      } catch (error) {
        failed.push({ prospect, error: error instanceof Error ? error.message : 'Unable to send email.' });
        recipientLogs.push({
          send_id: send.id,
          prospect_id: prospect.id,
          email: prospect.email,
          store_name: prospect.store_name,
          contact_name: prospect.contact_name,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unable to send email.',
          sent_at: sentAt,
        });
      }
    }

    if (recipientLogs.length > 0) {
      const { error: logError } = await adminClient.from('outreach_email_recipients').insert(recipientLogs);
      if (logError) {
        console.error('Customer review recipient log error:', logError);
      }
    }

    const sentProspectIds = recipientLogs
      .filter((log) => log.status === 'sent' && log.prospect_id)
      .map((log) => log.prospect_id as string);

    if (sentProspectIds.length > 0) {
      const { error: prospectUpdateError } = await adminClient
        .from('outreach_prospects')
        .update({ last_customer_review_sent_at: sentAt, updated_at: sentAt })
        .in('id', sentProspectIds);

      if (prospectUpdateError) {
        console.error('Customer review prospect update error:', prospectUpdateError);
      }
    }

    return NextResponse.json({
      sendId: send.id,
      sent: sentProspectIds.length,
      failed: failed.length,
      failures: failed.map((entry) => ({ email: entry.prospect.email, error: entry.error })),
    });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Customer review outreach send error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to send customer review outreach.' }, { status: 500 });
  }
}
