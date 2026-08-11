import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';
import {
  deliverEmailCampaign,
} from '@/lib/emailCampaigns';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { user, adminClient } = await requireAdminAccess();
    const body = await request.json().catch(() => ({}));

    if (body?.confirmText !== 'SEND') {
      return NextResponse.json({ error: 'Type SEND to confirm this campaign send.' }, { status: 400 });
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
    if (campaign.status === 'sent') {
      return NextResponse.json({ error: 'This campaign has already been sent.' }, { status: 400 });
    }
    if (campaign.status === 'scheduled') {
      return NextResponse.json({ error: 'Cancel the scheduled send before sending this campaign now.' }, { status: 400 });
    }
    if (campaign.status === 'sending') {
      return NextResponse.json({ error: 'This campaign is already being sent.' }, { status: 400 });
    }

    return NextResponse.json(await deliverEmailCampaign(adminClient, campaign, user.id));
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Email campaign send error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to send email campaign.' }, { status: 500 });
  }
}
