import { NextResponse } from 'next/server';
import { deliverEmailCampaign } from '@/lib/emailCampaigns';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const DUE_CAMPAIGN_LIMIT = 3;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authorization = request.headers.get('authorization');
  const headerSecret = request.headers.get('x-cron-secret');
  return authorization === `Bearer ${secret}` || headerSecret === secret;
}

async function handleScheduledCampaigns(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminClient = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data: dueCampaigns, error } = await adminClient
    .from('email_campaigns')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(DUE_CAMPAIGN_LIMIT);

  if (error) throw error;

  const results: Array<{
    campaignId: string;
    status: 'sent' | 'skipped' | 'failed';
    sentCount?: number;
    failedCount?: number;
    error?: string;
  }> = [];

  for (const campaign of dueCampaigns || []) {
    const { data: lockedCampaign, error: lockError } = await adminClient
      .from('email_campaigns')
      .update({
        status: 'sending',
        schedule_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaign.id)
      .eq('status', 'scheduled')
      .select('*')
      .single();

    if (lockError || !lockedCampaign) {
      results.push({
        campaignId: campaign.id,
        status: 'skipped',
        error: lockError?.message || 'Campaign was already claimed.',
      });
      continue;
    }

    try {
      const result = await deliverEmailCampaign(adminClient, lockedCampaign, lockedCampaign.scheduled_by || null);
      results.push({
        campaignId: campaign.id,
        status: 'sent',
        sentCount: result.sentCount,
        failedCount: result.failedCount,
      });
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : 'Unable to send scheduled campaign.';
      await adminClient
        .from('email_campaigns')
        .update({
          status: 'draft',
          scheduled_at: null,
          schedule_error: message,
          updated_at: new Date().toISOString(),
        })
        .eq('id', campaign.id);

      results.push({
        campaignId: campaign.id,
        status: 'failed',
        error: message,
      });
    }
  }

  return NextResponse.json({
    success: true,
    checkedAt: now,
    due: dueCampaigns?.length || 0,
    results,
  });
}

export async function GET(request: Request) {
  try {
    return await handleScheduledCampaigns(request);
  } catch (error) {
    console.error('Scheduled email campaign cron error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to run scheduled email campaigns.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
