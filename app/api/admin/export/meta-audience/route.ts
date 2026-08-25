import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';
import { parseBusinessAddress } from '@/lib/address';

export const dynamic = 'force-dynamic';

type AudienceType = 'top_revenue' | 'repeat_buyers' | 'all_purchasers';

type RetailerRow = {
  id: string;
  company_name?: string | null;
  contact_name?: string | null;
  business_address?: string | null;
  phone?: string | null;
  account_number?: string | null;
  email?: string | null;
};

type OrderRow = {
  retailer_id?: string | null;
  total?: number | string | null;
  status?: string | null;
  created_at?: string | null;
};

type AuthUser = {
  id?: string;
  email?: string | null;
};

type AudienceRow = RetailerRow & {
  totalOrders: number;
  totalSpent: number;
  lastOrderAt: string | null;
};

const CSV_HEADERS = ['email', 'phone', 'fn', 'ln', 'zip', 'ct', 'st', 'country', 'uid', 'value'];
const MAX_LIMIT = 5000;

const parseLimit = (value: string | null) => {
  const parsed = Number(value || 250);
  if (!Number.isFinite(parsed)) return 250;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(parsed)));
};

const parseAudienceType = (value: string | null): AudienceType => {
  if (value === 'repeat_buyers' || value === 'all_purchasers') return value;
  return 'top_revenue';
};

const csvEscape = (value: unknown) => {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
};

const normalizeEmail = (value?: string | null) => value?.trim().toLowerCase() || '';

const normalizePhone = (value?: string | null) => {
  const digits = value?.replace(/\D/g, '') || '';
  if (digits.length === 10) return `1${digits}`;
  return digits;
};

const splitName = (value?: string | null) => {
  const fallback = '';
  const parts = (value || fallback).trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : '',
  };
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

async function loadRetailers(adminClient: any) {
  const { data, error } = await adminClient
    .from('retailers')
    .select('id, company_name, contact_name, business_address, phone, account_number, email')
    .order('company_name');

  if (error) throw error;
  return (data || []) as RetailerRow[];
}

async function loadOrders(adminClient: any) {
  const { data, error } = await adminClient
    .from('orders')
    .select('retailer_id, total, status, created_at')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as OrderRow[];
}

const buildAudienceRows = async (adminClient: any, audienceType: AudienceType, limit: number) => {
  const [retailers, orders, authUsers] = await Promise.all([
    loadRetailers(adminClient),
    loadOrders(adminClient),
    listAllAuthUsers(adminClient),
  ]);

  const emailByUserId = new Map<string, string>();
  for (const user of authUsers) {
    if (user.id && user.email) emailByUserId.set(user.id, user.email);
  }

  const statsByRetailer = new Map<string, { totalOrders: number; totalSpent: number; lastOrderAt: string | null }>();
  for (const order of orders) {
    if (!order.retailer_id || order.status === 'canceled') continue;

    const current = statsByRetailer.get(order.retailer_id) || {
      totalOrders: 0,
      totalSpent: 0,
      lastOrderAt: null,
    };
    const total = Number(order.total || 0);
    current.totalOrders += 1;
    current.totalSpent += Number.isFinite(total) ? total : 0;
    if (order.created_at && (!current.lastOrderAt || new Date(order.created_at) > new Date(current.lastOrderAt))) {
      current.lastOrderAt = order.created_at;
    }
    statsByRetailer.set(order.retailer_id, current);
  }

  return retailers
    .map((retailer) => {
      const stats = statsByRetailer.get(retailer.id) || {
        totalOrders: 0,
        totalSpent: 0,
        lastOrderAt: null,
      };
      return {
        ...retailer,
        email: normalizeEmail(retailer.email) || normalizeEmail(emailByUserId.get(retailer.id)),
        ...stats,
      };
    })
    .filter((retailer) => {
      if (!retailer.email && !normalizePhone(retailer.phone)) return false;
      if (audienceType === 'repeat_buyers') return retailer.totalOrders >= 2;
      return retailer.totalOrders > 0;
    })
    .sort((a, b) => {
      if (audienceType === 'all_purchasers') {
        return new Date(b.lastOrderAt || 0).getTime() - new Date(a.lastOrderAt || 0).getTime();
      }
      return b.totalSpent - a.totalSpent;
    })
    .slice(0, limit);
};

const toMetaCsvRow = (retailer: AudienceRow) => {
  const { city, state, zip } = parseBusinessAddress(retailer.business_address || '');
  const { firstName, lastName } = splitName(retailer.contact_name);
  const uid = retailer.account_number || retailer.id;

  return [
    normalizeEmail(retailer.email),
    normalizePhone(retailer.phone),
    firstName,
    lastName,
    zip || '',
    city || '',
    state || '',
    'US',
    uid,
    retailer.totalSpent.toFixed(2),
  ];
};

const buildCsv = (rows: AudienceRow[]) => [
  CSV_HEADERS.join(','),
  ...rows.map((retailer) => toMetaCsvRow(retailer).map(csvEscape).join(',')),
].join('\n');

export async function GET(request: Request) {
  try {
    const { adminClient } = await requireAdminAccess();
    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams.get('limit'));
    const audienceType = parseAudienceType(searchParams.get('audience'));
    const format = searchParams.get('format') || 'csv';
    const rows = await buildAudienceRows(adminClient, audienceType, limit);

    if (format === 'json') {
      const totalValue = rows.reduce((sum, retailer) => sum + retailer.totalSpent, 0);
      return NextResponse.json({
        audienceType,
        limit,
        count: rows.length,
        totalValue,
        rows: rows.slice(0, 10).map((retailer) => ({
          id: retailer.id,
          companyName: retailer.company_name,
          email: retailer.email,
          phone: retailer.phone,
          totalOrders: retailer.totalOrders,
          totalSpent: retailer.totalSpent,
          lastOrderAt: retailer.lastOrderAt,
        })),
      });
    }

    const csv = buildCsv(rows);
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="meta-${audienceType}-${stamp}.csv"`,
      },
    });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Meta audience export error:', error);
    return NextResponse.json({ error: 'Unable to export Meta audience.' }, { status: 500 });
  }
}
