import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';

export const dynamic = 'force-dynamic';

type RetailerSearchRow = {
  id: string;
  company_name?: string | null;
  contact_name?: string | null;
  email?: string | null;
};

type AuthUser = {
  id?: string;
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

async function listAllAuthUsers(adminClient: any): Promise<AuthUser[]> {
  const users: AuthUser[] = [];
  let page = 1;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;

    users.push(...(data?.users || []));
    if (!data?.nextPage || !data.users?.length) break;
    page += 1;
  }

  return users;
}

async function hydrateRetailerEmails(adminClient: any, rows: RetailerSearchRow[]) {
  let authUsers: AuthUser[] = [];
  try {
    authUsers = await listAllAuthUsers(adminClient);
  } catch (error) {
    console.error('Unable to hydrate retailer emails from auth:', error);
    return rows;
  }

  const emailByUserId = new Map<string, string>();
  for (const user of authUsers) {
    if (user.id && user.email) emailByUserId.set(user.id, user.email);
  }

  return rows.map((row) => ({
    ...row,
    email: emailByUserId.get(row.id) || row.email || null,
  }));
}

const matchesQuery = (row: RetailerSearchRow, query: string) => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [row.company_name, row.contact_name, row.email]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(normalizedQuery));
};

async function loadRetailers(adminClient: any, columns: string) {
  const rows: RetailerSearchRow[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await adminClient
      .from('retailers')
      .select(columns)
      .order('company_name')
      .range(from, from + pageSize - 1);

    if (error) throw error;

    rows.push(...((data || []) as RetailerSearchRow[]));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function searchRetailers(adminClient: any) {
  const selectColumns = 'id, company_name, contact_name, email';
  const fallbackColumns = 'id, company_name, email';

  try {
    return hydrateRetailerEmails(adminClient, await loadRetailers(adminClient, selectColumns));
  } catch (error) {
    if (!isMissingContactNameColumnError(error)) throw error;
  }

  return hydrateRetailerEmails(adminClient, await loadRetailers(adminClient, fallbackColumns));
}

export async function GET(request: Request) {
  try {
    const { adminClient } = await requireAdminAccess();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const rows = await searchRetailers(adminClient);
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
