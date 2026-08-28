import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';

type RouteContext = {
  params: {
    id: string;
  };
};

const allowedStatuses = new Set(['new', 'reviewing', 'contacted', 'converted', 'dismissed']);

const getString = (value: unknown, maxLength = 5000) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { adminClient } = await requireAdminAccess();
    const body = await request.json().catch(() => ({}));
    const updates: { status?: string; admin_notes?: string | null } = {};

    if (typeof body.status === 'string') {
      if (!allowedStatuses.has(body.status)) {
        return NextResponse.json({ success: false, error: 'Invalid nomination status.' }, { status: 400 });
      }
      updates.status = body.status;
    }

    if ('adminNotes' in body || 'admin_notes' in body) {
      updates.admin_notes = getString(body.adminNotes ?? body.admin_notes);
    }

    if (!Object.keys(updates).length) {
      return NextResponse.json({ success: false, error: 'No updates provided.' }, { status: 400 });
    }

    const { data, error } = await adminClient
      .from('store_nominations')
      .update(updates)
      .eq('id', params.id)
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, nomination: data });
  } catch (error) {
    const status = error instanceof AdminAuthorizationError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Unable to update store nomination.';
    console.error('Store nomination update error:', error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { adminClient } = await requireAdminAccess();
    const { error } = await adminClient
      .from('store_nominations')
      .delete()
      .eq('id', params.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    const status = error instanceof AdminAuthorizationError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Unable to delete store nomination.';
    console.error('Store nomination delete error:', error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
