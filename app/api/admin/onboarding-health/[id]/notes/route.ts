import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';
import { addPipedriveNote } from '@/lib/pipedrive';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { adminClient, user } = await requireAdminAccess();
    const { body } = await request.json();

    if (!body?.trim()) {
      return NextResponse.json({ error: 'Note body is required.' }, { status: 400 });
    }

    const { data: onboarding, error: onboardingError } = await adminClient
      .from('retailer_onboarding')
      .select('id, pipedrive_deal_id')
      .eq('id', params.id)
      .single();

    if (onboardingError || !onboarding) {
      return NextResponse.json({ error: 'Onboarding record not found.' }, { status: 404 });
    }

    let pipedriveNoteId: number | null = null;

    if (onboarding.pipedrive_deal_id) {
      const note = await addPipedriveNote(onboarding.pipedrive_deal_id, body.trim());
      pipedriveNoteId = note.id;
    }

    const { data, error } = await adminClient
      .from('retailer_onboarding_notes')
      .insert({
        onboarding_id: params.id,
        body: body.trim(),
        source: 'portal',
        pipedrive_note_id: pipedriveNoteId,
        created_by: user.email || user.id,
      })
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ note: data });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Onboarding note create error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create onboarding note.' }, { status: 500 });
  }
}
