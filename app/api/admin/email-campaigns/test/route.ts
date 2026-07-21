import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';
import {
  getCampaignValidationError,
  renderEmailCampaign,
  sendResendCampaignEmail,
} from '@/lib/emailCampaigns';

export const dynamic = 'force-dynamic';

const isLikelyEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export async function POST(request: Request) {
  try {
    await requireAdminAccess();
    const body = await request.json().catch(() => ({}));
    const testEmail = typeof body?.testEmail === 'string' ? body.testEmail.trim().toLowerCase() : '';
    const campaign = body?.campaign || {};

    if (!testEmail || !isLikelyEmail(testEmail)) {
      return NextResponse.json({ error: 'Enter a valid test recipient email.' }, { status: 400 });
    }

    const rendered = renderEmailCampaign(campaign, {
      email: testEmail,
      contact_name: 'Test Recipient',
      first_name: 'Test',
      company_name: 'Test Store',
    });
    const validationError = getCampaignValidationError(rendered.campaign, { requireRecipients: false });

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const response = await sendResendCampaignEmail({
      to: testEmail,
      subject: `[TEST] ${rendered.subject}`,
      text: rendered.text,
      html: rendered.html,
      campaignId: rendered.campaign.id || 'draft',
    });

    return NextResponse.json({ success: true, resendMessageId: response.id || null });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Email campaign draft test send error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to send test email.' }, { status: 500 });
  }
}
