import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';
import { updatePipedriveDealStage } from '@/lib/pipedrive';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    await requireAdminAccess();
    const { dealId, stageName } = await request.json();

    if (!dealId || !stageName?.trim()) {
      return NextResponse.json({ error: 'dealId and stageName are required.' }, { status: 400 });
    }

    const deal = await updatePipedriveDealStage(Number(dealId), stageName.trim());
    return NextResponse.json({ deal });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Pipedrive deal stage update error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update Pipedrive deal stage.' }, { status: 500 });
  }
}
