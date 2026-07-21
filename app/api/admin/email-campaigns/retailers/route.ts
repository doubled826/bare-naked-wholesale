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

async function hydrateRetailerEmails(adminClient: any, rows: RetailerSearchRow[]) {
  const missingEmailRows = rows.filter((row) => !row.email);
  if (missingEmailRows.length === 0) return rows;

  const { data, error } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) {
    console.error('Unable to hydrate retailer emails from auth:', error);
    return rows;
  }

  const emailByUserId = new Map<string, string>();
  for (const user of data?.users || []) {
    if (user.id && user.email) emailByUserId.set(user.id, user.email);
  }

  return rows.map((row) => ({
    ...row,
    email: row.email || emailByUserId.get(row.id) || null,
  }));
}

const matchesQuery = (row: RetailerSearchRow, query: string) => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [row.company_name, row.contact_name, row.email]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(normalizedQuery));
};

async function searchRetailers(adminClient: any, query: string) {
  const selectColumns = 'id, company_name, contact_name, email';
  const fallbackColumns = 'id, company_name, email';

  const request = adminClient
    .from('retailers')
    .select(selectColumns)
    .order('company_name')
    .limit(500);

  const { data, error } = await request;
  if (!error) return hydrateRetailerEmails(adminClient, (data || []) as RetailerSearchRow[]);
  if (!isMissingContactNameColumnError(error)) throw error;

  const fallbackRequest = adminClient
    .from('retailers')
    .select(fallbackColumns)
    .order('company_name')
    .limit(500);

  const fallback = await fallbackRequest;
  if (fallback.error) throw fallback.error;
  return hydrateRetailerEmails(adminClient, (fallback.data || []) as RetailerSearchRow[]);
}

export async function GET(request: Request) {
  try {
    const { adminClient } = await requireAdminAccess();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const rows = await searchRetailers(adminClient, query);
    const uniqueByEmail = new Map<string, RetailerSearchRow>();

    for (const row of rows.filter((retailer) => matchesQuery(retailer, query))) {
      const email = (row.email || '').trim().toLowerCase();
      if (!email || !isLikelyEmail(email) || uniqueByEmail.has(email)) continue;
      uniqueByEmail.set(email, { ...row, email });
    }

    return NextResponse.json({ retailers: Array.from(uniqueByEmail.values()).slice(0, 12) });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Email campaign retailer search error:', error);
    return NextResponse.json({ error: 'Unable to search retailers.' }, { status: 500 });
  }
}
