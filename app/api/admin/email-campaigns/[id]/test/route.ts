import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';
import {
  isLikelyEmail,
  normalizeEmailAddress,
  renderEmailCampaign,
  ResendCampaignEmailError,
  sendResendCampaignEmail,
} from '@/lib/emailCampaigns';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { adminClient } = await requireAdminAccess();
    const body = await request.json().catch(() => ({}));
    const testEmail = typeof body?.testEmail === 'string' ? normalizeEmailAddress(body.testEmail) : '';

    if (!testEmail || !isLikelyEmail(testEmail)) {
      return NextResponse.json({ error: 'Enter a valid test recipient email.' }, { status: 400 });
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

    const rendered = renderEmailCampaign(campaign, {
      email: testEmail,
      contact_name: 'Test Recipient',
      first_name: 'Test',
      company_name: 'Test Store',
    });
    const response = await sendResendCampaignEmail({
      to: testEmail,
      subject: `[TEST] ${rendered.subject}`,
      text: rendered.text,
      html: rendered.html,
      campaignId: params.id,
    });

    return NextResponse.json({ success: true, resendMessageId: response.id || null });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ResendCampaignEmailError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }

    console.error('Email campaign test send error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to send test email.' }, { status: 500 });
  }
}
