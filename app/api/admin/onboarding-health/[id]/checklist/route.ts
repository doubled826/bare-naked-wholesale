import { formatISO } from 'date-fns';
import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { adminClient } = await requireAdminAccess();
    const { itemId, completed, agreedValue } = await request.json();

    if (!itemId) {
      return NextResponse.json({ error: 'itemId is required.' }, { status: 400 });
    }

    const payload = {
      onboarding_id: params.id,
      item_id: itemId,
      completed: !!completed,
      agreed_value: agreedValue || '',
      completed_at: completed ? formatISO(new Date()) : null,
      updated_at: formatISO(new Date()),
    };

    const { data, error } = await adminClient
      .from('retailer_onboarding_checklist_items')
      .upsert(payload, { onConflict: 'onboarding_id,item_id' })
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ item: data });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Onboarding checklist update error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update checklist item.' }, { status: 500 });
  }
}
