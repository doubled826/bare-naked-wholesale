import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';
import { computeFollowUpStatus } from '@/lib/onboarding';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { adminClient } = await requireAdminAccess();
    const { first_order_received_at, next_follow_up_at, owner_name } = await request.json();

    const updates: Record<string, string | null> = {};

    if (typeof first_order_received_at !== 'undefined') {
      updates.first_order_received_at = first_order_received_at || null;
    }

    if (typeof next_follow_up_at !== 'undefined') {
      updates.next_follow_up_at = next_follow_up_at || null;
    }

    if (typeof owner_name !== 'undefined') {
      updates.owner_name = owner_name || null;
    }

    const { data: current, error: currentError } = await adminClient
      .from('retailer_onboarding')
      .select('id, third_order_received_at, next_follow_up_at')
      .eq('id', params.id)
      .single();

    if (currentError || !current) {
      return NextResponse.json({ error: 'Onboarding record not found.' }, { status: 404 });
    }

    updates.follow_up_status = computeFollowUpStatus(
      typeof updates.next_follow_up_at === 'undefined' ? current.next_follow_up_at : updates.next_follow_up_at,
      current.third_order_received_at
    );

    const { data, error } = await adminClient
      .from('retailer_onboarding')
      .update(updates)
      .eq('id', params.id)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ onboarding: data });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Onboarding update error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update onboarding record.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const { adminClient } = await requireAdminAccess();

    const { error } = await adminClient
      .from('retailer_onboarding')
      .delete()
      .eq('id', params.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Onboarding delete error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to remove onboarding link.' },
      { status: 500 }
    );
  }
}
