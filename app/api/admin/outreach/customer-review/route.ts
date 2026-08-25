import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';
import { buildCustomerReviewEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

type ProspectInput = {
  storeName?: string;
  contactName?: string;
  email?: string;
  status?: string;
  source?: string;
  notes?: string;
};

const VALID_STATUSES = new Set(['prospect', 'samples_sent', 'signed_up', 'ordered', 'suppressed']);
const DEFAULT_COOLDOWN_DAYS = 21;

function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeStatus(value: unknown) {
  return typeof value === 'string' && VALID_STATUSES.has(value) ? value : 'prospect';
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

export async function GET() {
  try {
    const { adminClient } = await requireAdminAccess();

    const [{ data: reviews, error: reviewsError }, { data: prospects, error: prospectsError }, { data: sends, error: sendsError }] =
      await Promise.all([
        adminClient
          .from('outreach_customer_reviews')
          .select('id, title, review_text, reviewer_name, rating, product_name, image_url, fera_review_id, is_active, created_at')
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
        adminClient
          .from('outreach_prospects')
          .select('id, store_name, contact_name, email, status, source, last_customer_review_sent_at, suppressed_at, notes, created_at')
          .in('status', ['prospect', 'samples_sent'])
          .is('suppressed_at', null)
          .order('last_customer_review_sent_at', { ascending: true, nullsFirst: true }),
        adminClient
          .from('outreach_email_sends')
          .select('id, review_id, subject, cta_mode, recipient_count, created_at')
          .order('created_at', { ascending: false })
          .limit(8),
      ]);

    if (reviewsError) throw reviewsError;
    if (prospectsError) throw prospectsError;
    if (sendsError) throw sendsError;

    const eligibleProspects = ((prospects || []) as Array<{ last_customer_review_sent_at?: string | null }>).filter((prospect) =>
      isOutsideCooldown(prospect.last_customer_review_sent_at),
    );

    return NextResponse.json({ reviews: reviews || [], prospects: eligibleProspects, sends: sends || [] });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Customer review outreach load error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load customer review outreach.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, adminClient } = await requireAdminAccess();
    const body = await request.json();
    const action = typeof body?.action === 'string' ? body.action : '';

    if (action === 'review') {
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      const reviewText = typeof body.reviewText === 'string' ? body.reviewText.trim() : '';

      if (!title || !reviewText) {
        return NextResponse.json({ error: 'Review title and text are required.' }, { status: 400 });
      }

      const { data, error } = await adminClient
        .from('outreach_customer_reviews')
        .insert({
          title,
          review_text: reviewText,
          reviewer_name: typeof body.reviewerName === 'string' && body.reviewerName.trim() ? body.reviewerName.trim() : null,
          rating: Number.isFinite(Number(body.rating)) ? Math.min(5, Math.max(1, Number(body.rating))) : 5,
          product_name: typeof body.productName === 'string' && body.productName.trim() ? body.productName.trim() : null,
          image_url: typeof body.imageUrl === 'string' && body.imageUrl.trim() ? body.imageUrl.trim() : null,
          fera_review_id: typeof body.feraReviewId === 'string' && body.feraReviewId.trim() ? body.feraReviewId.trim() : null,
          created_by: user.id,
        })
        .select('id, title, review_text, reviewer_name, rating, product_name, image_url, fera_review_id, is_active, created_at')
        .single();

      if (error) {
        return NextResponse.json({ error: error.message || 'Unable to save review.' }, { status: 400 });
      }

      return NextResponse.json({ review: data });
    }

    if (action === 'prospects') {
      const prospects = Array.isArray(body.prospects) ? (body.prospects as ProspectInput[]) : [];
      const rows = prospects
        .map((prospect) => ({
          store_name: typeof prospect.storeName === 'string' ? prospect.storeName.trim() : '',
          contact_name: typeof prospect.contactName === 'string' && prospect.contactName.trim() ? prospect.contactName.trim() : null,
          email: normalizeEmail(prospect.email),
          status: normalizeStatus(prospect.status),
          source: typeof prospect.source === 'string' && prospect.source.trim() ? prospect.source.trim() : 'manual',
          notes: typeof prospect.notes === 'string' && prospect.notes.trim() ? prospect.notes.trim() : null,
          created_by: user.id,
          updated_at: new Date().toISOString(),
        }))
        .filter((prospect) => prospect.store_name && prospect.email);

      if (rows.length === 0) {
        return NextResponse.json({ error: 'Add at least one prospect with a store name and email.' }, { status: 400 });
      }

      const { data, error } = await adminClient
        .from('outreach_prospects')
        .upsert(rows, { onConflict: 'email' })
        .select('id, store_name, contact_name, email, status, source, last_customer_review_sent_at, suppressed_at, notes, created_at');

      if (error) {
        return NextResponse.json({ error: error.message || 'Unable to save prospects.' }, { status: 400 });
      }

      return NextResponse.json({ prospects: data || [] });
    }

    if (action === 'preview') {
      const { html, text } = buildCustomerReviewEmail({
        to: 'preview@example.com',
        contactName: typeof body.contactName === 'string' ? body.contactName : 'there',
        storeName: typeof body.storeName === 'string' ? body.storeName : 'Preview Store',
        subject: typeof body.subject === 'string' && body.subject.trim() ? body.subject.trim() : 'New customer review | Bare Naked Pet Co.',
        reviewText: typeof body.reviewText === 'string' ? body.reviewText : '',
        reviewerName: typeof body.reviewerName === 'string' ? body.reviewerName : '',
        rating: Number(body.rating) || 5,
        productName: typeof body.productName === 'string' ? body.productName : '',
        imageUrl: typeof body.imageUrl === 'string' ? body.imageUrl : '',
        ctaMode: body.ctaMode === 'samples' || body.ctaMode === 'wholesale' ? body.ctaMode : 'both',
      });

      return NextResponse.json({ html, text });
    }

    return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Customer review outreach save error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save customer review outreach.' }, { status: 500 });
  }
}
