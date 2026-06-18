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
  id: string;
  retailer_id: string | null;
  status: string | null;
  total: number | null;
  created_at: string | null;
};

type FollowUpRow = {
  retailer_id: string;
  owner_name: string | null;
  next_follow_up_at: string | null;
  last_contacted_at: string | null;
  last_contact_method: string | null;
  notes: string | null;
};

function daysSince(value: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  return Math.max(0, Math.floor((Date.now() - time) / (1000 * 60 * 60 * 24)));
}

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

function getLifecycle(orderCount: number, signupAgeDays: number | null, daysSinceLastOrder: number | null) {
  if (orderCount === 0) return 'needs_first_order';
  if (daysSinceLastOrder !== null && daysSinceLastOrder >= 90) return 'at_risk';
  if (orderCount === 1 && daysSinceLastOrder !== null && daysSinceLastOrder <= 45) return 'launch_follow_up';
  if (daysSinceLastOrder !== null && daysSinceLastOrder >= 35) return 'reorder_due';
  if (orderCount >= 2) return 'growth';
  if (signupAgeDays !== null && signupAgeDays >= 45) return 'reorder_due';
  return 'launch_follow_up';
}

function getRecommendedAction(lifecycle: string, orderCount: number, daysSinceLastOrder: number | null, signupAgeDays: number | null) {
  if (lifecycle === 'needs_first_order') {
    return {
      label: 'Send first-order nudge',
      reason: signupAgeDays === null ? 'Signed up with no order yet.' : `Signed up ${signupAgeDays} days ago with no order yet.`,
      angle: 'Low-friction starter order, no minimums, free shipping, samples, and easy portal help.',
    };
  }

  if (lifecycle === 'launch_follow_up') {
    return {
      label: 'Check launch status',
      reason: daysSinceLastOrder === null ? 'First order needs launch support.' : `First order was ${daysSinceLastOrder} days ago.`,
      angle: 'Ask how launch is going, confirm product is on shelf, offer sample/staff support, and set up the second order.',
    };
  }

  if (lifecycle === 'reorder_due') {
    return {
      label: 'Send reorder reminder',
      reason: daysSinceLastOrder === null ? 'Retailer may be ready for a reorder.' : `Last order was ${daysSinceLastOrder} days ago.`,
      angle: 'Make reordering easy, reference their previous order, and suggest a simple replenishment mix.',
    };
  }

  if (lifecycle === 'at_risk') {
    return {
      label: 'Start save conversation',
      reason: daysSinceLastOrder === null ? 'Retailer has gone quiet.' : `No order in ${daysSinceLastOrder} days.`,
      angle: 'Ask what happened after launch, offer help moving product, and reopen the relationship before pushing another order.',
    };
  }

  return {
    label: 'Look for growth opportunity',
    reason: `${orderCount} non-canceled orders on record.`,
    angle: 'Explore bigger reorder, additional sizes, Astro participation, samples, or in-store promo support.',
  };
}

function getPriority(lifecycle: string, followUpStatus: string, signupAgeDays: number | null, daysSinceLastOrder: number | null) {
  if (followUpStatus === 'overdue') return 0;
  if (followUpStatus === 'due') return 1;
  if (lifecycle === 'at_risk') return 2;
  if (lifecycle === 'needs_first_order' && (signupAgeDays || 0) >= 7) return 3;
  if (lifecycle === 'reorder_due') return 4;
  if (lifecycle === 'launch_follow_up' && (daysSinceLastOrder || 0) >= 14) return 5;
  if (lifecycle === 'growth') return 6;
  return 7;
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
          .select('id, retailer_id, status, total, created_at'),
        adminClient
          .from('first_order_followups')
          .select('retailer_id, owner_name, next_follow_up_at, last_contacted_at, last_contact_method, notes'),
      ]);

    if (retailersError) throw retailersError;
    if (ordersError) throw ordersError;
    if (followUpsError) throw followUpsError;

    const validOrders = ((orders || []) as OrderRow[]).filter((order) => order.retailer_id && order.status !== 'canceled');
    const ordersByRetailerId = new Map<string, OrderRow[]>();
    validOrders.forEach((order) => {
      const retailerId = order.retailer_id as string;
      ordersByRetailerId.set(retailerId, [...(ordersByRetailerId.get(retailerId) || []), order]);
    });

    const followUpByRetailerId = new Map(
      ((followUps || []) as FollowUpRow[]).map((followUp) => [followUp.retailer_id, followUp]),
    );

    const { data: authUsers } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    const emailByUserId = new Map((authUsers?.users || []).map((user) => [user.id, user.email || '']));

    const retailersWithMomentum = ((retailers || []) as RetailerRow[]).map((retailer) => {
      const retailerOrders = (ordersByRetailerId.get(retailer.id) || []).sort(
        (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime(),
      );
      const orderCount = retailerOrders.length;
      const totalRevenue = retailerOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
      const firstOrderDate = retailerOrders[0]?.created_at || null;
      const lastOrderDate = retailerOrders[retailerOrders.length - 1]?.created_at || null;
      const signupAgeDays = daysSince(retailer.created_at);
      const daysSinceLastOrder = daysSince(lastOrderDate);
      const followUp = followUpByRetailerId.get(retailer.id);
      const followUpStatus = getFollowUpStatus(followUp?.next_follow_up_at || null);
      const lifecycle = getLifecycle(orderCount, signupAgeDays, daysSinceLastOrder);
      const recommendedAction = getRecommendedAction(lifecycle, orderCount, daysSinceLastOrder, signupAgeDays);
      const priority = getPriority(lifecycle, followUpStatus, signupAgeDays, daysSinceLastOrder);

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
        lifecycle,
        priority,
        order_count: orderCount,
        total_revenue: totalRevenue,
        first_order_date: firstOrderDate,
        last_order_date: lastOrderDate,
        days_since_last_order: daysSinceLastOrder,
        recommended_action: recommendedAction,
        follow_up: {
          owner_name: followUp?.owner_name || '',
          next_follow_up_at: followUp?.next_follow_up_at || null,
          last_contacted_at: followUp?.last_contacted_at || null,
          last_contact_method: followUp?.last_contact_method || '',
          notes: followUp?.notes || '',
          status: followUpStatus,
        },
      };
    });

    const retailersSorted = retailersWithMomentum.sort((a, b) => {
      const priorityDiff = a.priority - b.priority;
      if (priorityDiff !== 0) return priorityDiff;
      return (b.days_since_last_order || b.signup_age_days || 0) - (a.days_since_last_order || a.signup_age_days || 0);
    });

    const stats = {
      total: retailersSorted.length,
      needs_first_order: retailersSorted.filter((retailer) => retailer.lifecycle === 'needs_first_order').length,
      launch_follow_up: retailersSorted.filter((retailer) => retailer.lifecycle === 'launch_follow_up').length,
      reorder_due: retailersSorted.filter((retailer) => retailer.lifecycle === 'reorder_due').length,
      at_risk: retailersSorted.filter((retailer) => retailer.lifecycle === 'at_risk').length,
      growth: retailersSorted.filter((retailer) => retailer.lifecycle === 'growth').length,
      due_today: retailersSorted.filter((retailer) => ['due', 'overdue'].includes(retailer.follow_up.status)).length,
    };

    return NextResponse.json({ retailers: retailersSorted, stats });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Sales momentum load error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load Sales Hub momentum.' }, { status: 500 });
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

    console.error('Sales momentum save error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save follow-up.' }, { status: 500 });
  }
}
