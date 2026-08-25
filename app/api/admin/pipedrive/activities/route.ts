import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';
import { createPipedriveActivity } from '@/lib/pipedrive';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    await requireAdminAccess();
    const { dealId, subject, dueDate } = await request.json();

    if (!dealId || !subject?.trim() || !dueDate) {
      return NextResponse.json({ error: 'dealId, subject, and dueDate are required.' }, { status: 400 });
    }

    const activity = await createPipedriveActivity(Number(dealId), subject.trim(), dueDate);
    return NextResponse.json({ activity });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Pipedrive activity error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create Pipedrive activity.' }, { status: 500 });
  }
}
