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
    const validationError = getCampaignValidationError(rendered.campaign);
    const recipients = validationError ? [] : await loadCampaignRecipients(adminClient, rendered.campaign);

    return NextResponse.json({
      subject: rendered.subject,
      preheader: rendered.preheader,
      text: rendered.text,
      html: rendered.html,
      validationError,
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
