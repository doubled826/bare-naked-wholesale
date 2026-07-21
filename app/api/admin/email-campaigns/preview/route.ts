import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';
import {
  getCampaignValidationError,
  loadCampaignRecipients,
  renderEmailCampaign,
  summarizeRecipients,
} from '@/lib/emailCampaigns';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { adminClient } = await requireAdminAccess();
    const body = await request.json().catch(() => ({}));
    const rendered = renderEmailCampaign(body, {
      email: 'buyer@happypaws.example',
      company_name: 'Happy Paws Market',
      contact_name: 'Jamie Carter',
      first_name: 'Jamie',
    });
    const validationError = getCampaignValidationError(rendered.campaign, { requireRecipients: false });
    let recipients: Awaited<ReturnType<typeof loadCampaignRecipients>> = [];
    let recipientError: string | null = null;

    try {
      recipients = await loadCampaignRecipients(adminClient, rendered.campaign);
    } catch (error) {
      console.error('Email campaign recipient preview error:', error);
      recipientError = error instanceof Error ? error.message : 'Unable to load recipients.';
    }

    return NextResponse.json({
      subject: rendered.subject,
      preheader: rendered.preheader,
      text: rendered.text,
      html: rendered.html,
      validationError,
      recipientError,
      ...summarizeRecipients(recipients),
    });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Email campaign preview error:', error);
    return NextResponse.json({ error: 'Unable to render email campaign preview.' }, { status: 500 });
  }
}
