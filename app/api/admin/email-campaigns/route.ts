import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';
import { defaultEmailCampaign, getCampaignValidationError, renderEmailCampaign } from '@/lib/emailCampaigns';

export const dynamic = 'force-dynamic';

const campaignSelect = 'id, template_key, name, subject, preheader, headline, body, cta_label, cta_url, hero_image_url, audience_filter, manual_recipients, status, scheduled_at, schedule_error, sent_at, created_at, updated_at';

const isMissingCampaignTableError = (error: unknown) => {
  const maybeError = error as { code?: string; message?: string };
  return (
    maybeError?.code === '42P01' ||
    maybeError?.code === 'PGRST205' ||
    (typeof maybeError?.message === 'string' && maybeError.message.includes('email_campaigns'))
  );
};

export async function GET() {
  try {
    const { adminClient } = await requireAdminAccess();
    const { data, error } = await adminClient
      .from('email_campaigns')
      .select(campaignSelect)
      .order('created_at', { ascending: false });

    if (error) {
      if (isMissingCampaignTableError(error)) {
        return NextResponse.json({
          campaigns: [],
          defaultCampaign: renderEmailCampaign(defaultEmailCampaign).campaign,
          setupRequired: true,
          setupMessage: 'Run the email campaigns Supabase migration before saving or sending campaigns.',
        });
      }

      throw error;
    }

    return NextResponse.json({ campaigns: data || [], defaultCampaign: renderEmailCampaign(defaultEmailCampaign).campaign });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Email campaign load error:', error);
    return NextResponse.json({ error: 'Unable to load email campaigns.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, adminClient } = await requireAdminAccess();
    const body = await request.json().catch(() => ({}));
    const rendered = renderEmailCampaign(body || defaultEmailCampaign);
    const validationError = getCampaignValidationError(rendered.campaign);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const { data, error } = await adminClient
      .from('email_campaigns')
      .insert({
        ...rendered.campaign,
        created_by: user.id,
      })
      .select(campaignSelect)
      .single();

    if (error) throw error;

    return NextResponse.json({ campaign: data });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Email campaign create error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create email campaign.' }, { status: 500 });
  }
}
