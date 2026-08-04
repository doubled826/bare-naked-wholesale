import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    id: string;
  };
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { adminClient } = await requireAdminAccess();
    const leadId = context.params.id;

    if (!leadId) {
      return NextResponse.json({ error: 'Missing lead id.' }, { status: 400 });
    }

    const { data, error } = await adminClient
      .from('wholesale_leads')
      .delete()
      .eq('id', leadId)
      .select('id, store_name')
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message || 'Wholesale lead not found.' }, { status: error ? 400 : 404 });
    }

    return NextResponse.json({ success: true, lead: data });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Wholesale lead delete error:', error);
    return NextResponse.json({ error: 'Unable to delete wholesale lead.' }, { status: 500 });
  }
}
