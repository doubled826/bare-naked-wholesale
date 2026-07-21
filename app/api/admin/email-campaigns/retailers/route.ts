import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';

export const dynamic = 'force-dynamic';

type RetailerSearchRow = {
  id: string;
  company_name?: string | null;
  contact_name?: string | null;
  email?: string | null;
};

const isLikelyEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const isMissingContactNameColumnError = (error: unknown) => {
  const maybeError = error as { code?: string; message?: string };
  return (
    maybeError?.code === '42703' ||
    maybeError?.code === 'PGRST204' ||
    (typeof maybeError?.message === 'string' && maybeError.message.includes('contact_name'))
  );
};

async function searchRetailers(adminClient: any, query: string) {
  const normalizedQuery = query.trim();
  const selectColumns = 'id, company_name, contact_name, email';
  const fallbackColumns = 'id, company_name, email';

  let request = adminClient
    .from('retailers')
    .select(selectColumns)
    .not('email', 'is', null)
    .order('company_name')
    .limit(12);

  if (normalizedQuery) {
    request = request.or(`company_name.ilike.%${normalizedQuery}%,contact_name.ilike.%${normalizedQuery}%,email.ilike.%${normalizedQuery}%`);
  }

  const { data, error } = await request;
  if (!error) return (data || []) as RetailerSearchRow[];
  if (!isMissingContactNameColumnError(error)) throw error;

  let fallbackRequest = adminClient
    .from('retailers')
    .select(fallbackColumns)
    .not('email', 'is', null)
    .order('company_name')
    .limit(12);

  if (normalizedQuery) {
    fallbackRequest = fallbackRequest.or(`company_name.ilike.%${normalizedQuery}%,email.ilike.%${normalizedQuery}%`);
  }

  const fallback = await fallbackRequest;
  if (fallback.error) throw fallback.error;
  return (fallback.data || []) as RetailerSearchRow[];
}

export async function GET(request: Request) {
  try {
    const { adminClient } = await requireAdminAccess();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const rows = await searchRetailers(adminClient, query);
    const uniqueByEmail = new Map<string, RetailerSearchRow>();

    for (const row of rows) {
      const email = (row.email || '').trim().toLowerCase();
      if (!email || !isLikelyEmail(email) || uniqueByEmail.has(email)) continue;
      uniqueByEmail.set(email, { ...row, email });
    }

    return NextResponse.json({ retailers: Array.from(uniqueByEmail.values()) });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Email campaign retailer search error:', error);
    return NextResponse.json({ error: 'Unable to search retailers.' }, { status: 500 });
  }
}
