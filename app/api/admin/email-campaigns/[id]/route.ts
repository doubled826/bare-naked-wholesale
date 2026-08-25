import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';
import { getCampaignValidationError, renderEmailCampaign } from '@/lib/emailCampaigns';

export const dynamic = 'force-dynamic';

const campaignSelect = 'id, template_key, name, subject, preheader, headline, body, cta_label, cta_url, hero_image_url, audience_filter, manual_recipients, status, scheduled_at, schedule_error, sent_at, created_at, updated_at';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const { adminClient } = await requireAdminAccess();
    const body = await request.json().catch(() => ({}));
    const rendered = renderEmailCampaign(body);
    const validationError = getCampaignValidationError(rendered.campaign);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const { data: existing, error: existingError } = await adminClient
      .from('email_campaigns')
      .select('id, status')
      .eq('id', params.id)
      .single();

    if (existingError) throw existingError;
    if (!existing) {
      return NextResponse.json({ error: 'Email campaign not found.' }, { status: 404 });
    }
    if (existing.status === 'sent' || existing.status === 'sending') {
      return NextResponse.json({ error: 'This campaign can no longer be edited.' }, { status: 400 });
    }

    const { data, error } = await adminClient
      .from('email_campaigns')
      .update({
        ...rendered.campaign,
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

    console.error('Email campaign update error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update email campaign.' }, { status: 500 });
  }
}
