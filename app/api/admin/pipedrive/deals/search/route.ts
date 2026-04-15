import { NextResponse } from 'next/server';
import { requireAdminAccess, AdminAuthorizationError } from '@/lib/admin';
import { searchPipedriveDeals } from '@/lib/pipedrive';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await requireAdminAccess();

    const { searchParams } = new URL(request.url);
    const term = searchParams.get('term')?.trim() || '';

    if (!term) {
      return NextResponse.json({ deals: [] });
    }

    const deals = await searchPipedriveDeals(term);
    return NextResponse.json({ deals });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Pipedrive deal search error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to search Pipedrive deals.' }, { status: 500 });
  }
}
