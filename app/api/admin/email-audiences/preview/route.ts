import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';
import { loadAudienceRecipients, summarizeRecipients } from '@/lib/emailCampaigns';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { adminClient } = await requireAdminAccess();
    const body = await request.json().catch(() => ({}));
    const recipients = await loadAudienceRecipients(adminClient, body?.conditions);
    return NextResponse.json(summarizeRecipients(recipients));
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Email audience preview error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to preview audience.' }, { status: 400 });
  }
}
