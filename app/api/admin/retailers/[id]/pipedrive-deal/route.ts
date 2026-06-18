import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';
import { getPipedriveDeal } from '@/lib/pipedrive';

type RouteContext = {
  params: {
    id: string;
  };
};

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { adminClient } = await requireAdminAccess();
    const retailerId = params.id;
    const { dealId } = await request.json();

    if (!retailerId || !dealId) {
      return NextResponse.json({ error: 'retailerId and dealId are required.' }, { status: 400 });
    }

    const { data: retailer } = await adminClient
      .from('retailers')
      .select('id')
      .eq('id', retailerId)
      .single();

    if (!retailer) {
      return NextResponse.json({ error: 'Retailer not found.' }, { status: 404 });
    }

    const deal = await getPipedriveDeal(Number(dealId));
    const now = new Date().toISOString();

    const payload = {
      retailer_id: retailerId,
      pipedrive_deal_id: deal.id,
      pipedrive_stage_name: deal.stageName,
      owner_name: deal.ownerName,
      last_synced_at: now,
      updated_at: now,
    };

    const { data: existing } = await adminClient
      .from('retailer_onboarding')
      .select('id')
      .eq('retailer_id', retailerId)
      .maybeSingle();

    const result = existing
      ? await adminClient
        .from('retailer_onboarding')
        .update(payload)
        .eq('id', existing.id)
        .select('*')
        .single()
      : await adminClient
        .from('retailer_onboarding')
        .insert(payload)
        .select('*')
        .single();

    if (result.error) {
      throw result.error;
    }

    return NextResponse.json({
      onboarding: result.data,
      deal,
    });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Retailer Pipedrive link error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to link Pipedrive deal.' },
      { status: 500 },
    );
  }
}
