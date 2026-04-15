import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';
import { addPipedriveNote } from '@/lib/pipedrive';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    await requireAdminAccess();
    const { dealId, content } = await request.json();

    if (!dealId || !content?.trim()) {
      return NextResponse.json({ error: 'dealId and content are required.' }, { status: 400 });
    }

    const note = await addPipedriveNote(Number(dealId), content.trim());
    return NextResponse.json({ note });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Pipedrive note error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create Pipedrive note.' }, { status: 500 });
  }
}
