import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';

export const dynamic = 'force-dynamic';

type RetailerRow = {
  id: string;
  company_name: string;
  business_address: string | null;
  phone: string | null;
  account_number: string | null;
  status: string | null;
  created_at: string | null;
};

type OrderRow = {
  retailer_id: string | null;
  status: string | null;
};

type FollowUpRow = {
  retailer_id: string;
  owner_name: string | null;
  next_follow_up_at: string | null;
  last_contacted_at: string | null;
  last_contact_method: string | null;
  notes: string | null;
};

function getFollowUpStatus(nextFollowUpAt: string | null) {
  if (!nextFollowUpAt) return 'not_set';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(nextFollowUpAt);
  due.setHours(0, 0, 0, 0);

  if (due.getTime() < today.getTime()) return 'overdue';
  if (due.getTime() === today.getTime()) return 'due';
  return 'upcoming';
}

function getSignupAgeDays(createdAt: string | null) {
  if (!createdAt) return null;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return null;
  return Math.max(0, Math.floor((Date.now() - created) / (1000 * 60 * 60 * 24)));
}

export async function GET() {
  try {
    const { adminClient } = await requireAdminAccess();

    const [{ data: retailers, error: retailersError }, { data: orders, error: ordersError }, { data: followUps, error: followUpsError }] =
      await Promise.all([
        adminClient
          .from('retailers')
          .select('id, company_name, business_address, phone, account_number, status, created_at')
          .order('created_at', { ascending: false }),
        adminClient
          .from('orders')
          .select('retailer_id, status'),
        adminClient
          .from('first_order_followups')
          .select('retailer_id, owner_name, next_follow_up_at, last_contacted_at, last_contact_method, notes'),
      ]);

    if (retailersError) throw retailersError;
    if (ordersError) throw ordersError;
    if (followUpsError) throw followUpsError;

    const orderedRetailerIds = new Set(
      ((orders || []) as OrderRow[])
        .filter((order) => order.retailer_id && order.status !== 'canceled')
        .map((order) => order.retailer_id as string),
    );

    const followUpByRetailerId = new Map(
      ((followUps || []) as FollowUpRow[]).map((followUp) => [followUp.retailer_id, followUp]),
    );

    const { data: authUsers } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    const emailByUserId = new Map((authUsers?.users || []).map((user) => [user.id, user.email || '']));

    const stores = ((retailers || []) as RetailerRow[])
      .filter((retailer) => !orderedRetailerIds.has(retailer.id))
      .map((retailer) => {
        const followUp = followUpByRetailerId.get(retailer.id);
        const signupAgeDays = getSignupAgeDays(retailer.created_at);
        const followUpStatus = getFollowUpStatus(followUp?.next_follow_up_at || null);
        const priority =
          retailer.status === 'pending'
            ? 'setup_pending'
            : followUpStatus === 'overdue'
              ? 'overdue'
              : followUpStatus === 'due'
                ? 'due'
                : signupAgeDays !== null && signupAgeDays >= 7
                  ? 'aging'
                  : 'new';

        return {
          id: retailer.id,
          company_name: retailer.company_name,
          business_address: retailer.business_address || '',
          phone: retailer.phone || '',
          account_number: retailer.account_number || '',
          status: retailer.status || 'pending',
          created_at: retailer.created_at,
          email: emailByUserId.get(retailer.id) || '',
          signup_age_days: signupAgeDays,
          follow_up: {
            owner_name: followUp?.owner_name || '',
            next_follow_up_at: followUp?.next_follow_up_at || null,
            last_contacted_at: followUp?.last_contacted_at || null,
            last_contact_method: followUp?.last_contact_method || '',
            notes: followUp?.notes || '',
            status: followUpStatus,
          },
          priority,
        };
      })
      .sort((a, b) => {
        const rank = { setup_pending: 0, overdue: 1, due: 2, aging: 3, new: 4 } as const;
        const priorityDiff = rank[a.priority as keyof typeof rank] - rank[b.priority as keyof typeof rank];
        if (priorityDiff !== 0) return priorityDiff;
        return (b.signup_age_days || 0) - (a.signup_age_days || 0);
      });

    return NextResponse.json({ stores });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Needs first order load error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load first-order queue.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, adminClient } = await requireAdminAccess();
    const body = await request.json();
    const retailerId = typeof body?.retailerId === 'string' ? body.retailerId : '';

    if (!retailerId) {
      return NextResponse.json({ error: 'retailerId is required.' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      retailer_id: retailerId,
      updated_at: new Date().toISOString(),
    };

    if ('ownerName' in body) {
      updates.owner_name = typeof body.ownerName === 'string' && body.ownerName.trim() ? body.ownerName.trim() : null;
    }

    if ('nextFollowUpAt' in body) {
      updates.next_follow_up_at =
        typeof body.nextFollowUpAt === 'string' && body.nextFollowUpAt
          ? new Date(`${body.nextFollowUpAt}T12:00:00`).toISOString()
          : null;
    }

    if ('notes' in body) {
      updates.notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null;
    }

    if ('contactMethod' in body) {
      updates.last_contact_method =
        typeof body.contactMethod === 'string' && body.contactMethod.trim() ? body.contactMethod.trim() : null;
      updates.last_contacted_at = new Date().toISOString();
    }

    const { data: existing } = await adminClient
      .from('first_order_followups')
      .select('retailer_id')
      .eq('retailer_id', retailerId)
      .maybeSingle();

    if (!existing) {
      updates.created_by = user.id;
      updates.created_at = new Date().toISOString();
    }

    const { data, error } = await adminClient
      .from('first_order_followups')
      .upsert(updates, { onConflict: 'retailer_id' })
      .select('retailer_id, owner_name, next_follow_up_at, last_contacted_at, last_contact_method, notes')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message || 'Unable to save follow-up.' }, { status: 400 });
    }

    return NextResponse.json({ followUp: data });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Needs first order save error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save follow-up.' }, { status: 500 });
  }
}
