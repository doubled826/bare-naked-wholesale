import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';
import { getCampaignValidationError } from '@/lib/emailCampaigns';

export const dynamic = 'force-dynamic';

const campaignSelect = 'id, template_key, name, subject, preheader, headline, body, cta_label, cta_url, hero_image_url, audience_filter, manual_recipients, status, scheduled_at, schedule_error, sent_at, created_at, updated_at';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { user, adminClient } = await requireAdminAccess();
    const body = await request.json().catch(() => ({}));
    const scheduledAt = typeof body?.scheduledAt === 'string' ? body.scheduledAt : '';
    const scheduledDate = new Date(scheduledAt);

    if (!scheduledAt || Number.isNaN(scheduledDate.getTime())) {
      return NextResponse.json({ error: 'Choose a valid scheduled send time.' }, { status: 400 });
    }

    if (scheduledDate.getTime() <= Date.now() + 60 * 1000) {
      return NextResponse.json({ error: 'Schedule the send at least one minute from now.' }, { status: 400 });
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
    if (campaign.status === 'sent' || campaign.status === 'sending') {
      return NextResponse.json({ error: 'This campaign can no longer be scheduled.' }, { status: 400 });
    }

    const validationError = getCampaignValidationError(campaign);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const { data, error: updateError } = await adminClient
      .from('email_campaigns')
      .update({
        status: 'scheduled',
        scheduled_at: scheduledDate.toISOString(),
        scheduled_by: user.id,
        schedule_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select(campaignSelect)
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ campaign: data });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Email campaign schedule error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to schedule email campaign.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const { adminClient } = await requireAdminAccess();

    const { data: existing, error: existingError } = await adminClient
      .from('email_campaigns')
      .select('id, status')
      .eq('id', params.id)
      .single();

    if (existingError) throw existingError;
    if (!existing) {
      return NextResponse.json({ error: 'Email campaign not found.' }, { status: 404 });
    }
    if (existing.status !== 'scheduled') {
      return NextResponse.json({ error: 'Only scheduled campaigns can be unscheduled.' }, { status: 400 });
    }

    const { data, error } = await adminClient
      .from('email_campaigns')
      .update({
        status: 'draft',
        scheduled_at: null,
        scheduled_by: null,
        schedule_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select(campaignSelect)
      .single();

    if (error) throw error;

    return NextResponse.json({ campaign: data });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Email campaign unschedule error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to cancel scheduled send.' }, { status: 500 });
  }
}
