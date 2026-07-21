import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';
import { renderEmailCampaign, sendResendCampaignEmail } from '@/lib/emailCampaigns';

export const dynamic = 'force-dynamic';

const isLikelyEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { adminClient } = await requireAdminAccess();
    const body = await request.json().catch(() => ({}));
    const testEmail = typeof body?.testEmail === 'string' ? body.testEmail.trim().toLowerCase() : '';

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

    const rendered = renderEmailCampaign(campaign);
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

    console.error('Email campaign test send error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to send test email.' }, { status: 500 });
  }
}
