import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';
import { computeFollowUpStatus, getDefaultMilestones } from '@/lib/onboarding';
import { getPipedriveDeal, isOnboardingStage } from '@/lib/pipedrive';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { adminClient, user } = await requireAdminAccess();
    const { retailerId, dealId } = await request.json();

    if (!retailerId || !dealId) {
      return NextResponse.json({ error: 'retailerId and dealId are required.' }, { status: 400 });
    }

    const { data: retailer } = await adminClient
      .from('retailers')
      .select('id, company_name')
      .eq('id', retailerId)
      .single();

    if (!retailer) {
      return NextResponse.json({ error: 'Retailer not found in the portal.' }, { status: 404 });
    }

    const deal = await getPipedriveDeal(Number(dealId));

    if (!isOnboardingStage(deal.stageName)) {
      return NextResponse.json({ error: 'Selected deal is not in First, Second, or Third Order Received.' }, { status: 400 });
    }

    const defaults = getDefaultMilestones(deal.stageName);
    const payload = {
      retailer_id: retailerId,
      pipedrive_deal_id: deal.id,
      pipedrive_stage_name: deal.stageName,
      owner_name: deal.ownerName,
      first_order_received_at: defaults.first_order_received_at,
      second_order_received_at: defaults.second_order_received_at,
      third_order_received_at: defaults.third_order_received_at,
      next_follow_up_at: defaults.next_follow_up_at,
      follow_up_status: computeFollowUpStatus(defaults.next_follow_up_at, defaults.third_order_received_at),
      last_synced_at: defaults.first_order_received_at,
      updated_at: defaults.first_order_received_at,
      created_by: user.id,
    };

    const { data: existing } = await adminClient
      .from('retailer_onboarding')
      .select('id')
      .eq('retailer_id', retailerId)
      .maybeSingle();

    const query = adminClient.from('retailer_onboarding');
    const result = existing
      ? await query.update(payload).eq('id', existing.id).select('*').single()
      : await query.insert(payload).select('*').single();

    if (result.error) {
      throw result.error;
    }

    return NextResponse.json({ onboarding: result.data });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Onboarding link error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to link retailer to Pipedrive.' }, { status: 500 });
  }
}
