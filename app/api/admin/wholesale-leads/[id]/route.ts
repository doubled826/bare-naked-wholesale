import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';
import { sendWholesaleLeadQualifiedEvent } from '@/lib/metaConversions';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    id: string;
  };
};

const LEAD_STATUSES = new Set(['new', 'qualified', 'disqualified', 'wholesale_customer']);
const SAMPLE_STATUSES = new Set(['not_sent', 'sent']);
const DISQUALIFIED_REASONS = new Set([
  'not_a_retailer',
  'no_verifiable_storefront',
  'outside_service_area',
  'duplicate_request',
  'no_response',
  'other',
]);

const getString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const getLegacyStatus = (leadStatus: string, sampleStatus: string) => {
  if (leadStatus === 'wholesale_customer') return 'converted';
  if (leadStatus === 'disqualified') return 'closed';
  if (leadStatus === 'qualified') return sampleStatus === 'sent' ? 'tracking_added' : 'sample_pack_pending';
  return 'new';
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { adminClient } = await requireAdminAccess();
    const leadId = context.params.id;

    if (!leadId) {
      return NextResponse.json({ error: 'Missing lead id.' }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Send a valid JSON request body.' }, { status: 400 });
    }

    const { data: currentLead, error: loadError } = await adminClient
      .from('wholesale_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (loadError || !currentLead) {
      return NextResponse.json({ error: 'Wholesale lead not found.' }, { status: 404 });
    }

    const requestedLeadStatus = getString((body as Record<string, unknown>).leadStatus || (body as Record<string, unknown>).lead_status);
    const requestedSampleStatus = getString((body as Record<string, unknown>).sampleStatus || (body as Record<string, unknown>).sample_status);
    const nextLeadStatus = requestedLeadStatus || currentLead.lead_status || 'new';
    const nextSampleStatus = requestedSampleStatus || currentLead.sample_status || 'not_sent';

    if (!LEAD_STATUSES.has(nextLeadStatus)) {
      return NextResponse.json({ error: 'Invalid lead status.' }, { status: 400 });
    }

    if (!SAMPLE_STATUSES.has(nextSampleStatus)) {
      return NextResponse.json({ error: 'Invalid sample status.' }, { status: 400 });
    }

    const disqualifiedReason = getString((body as Record<string, unknown>).disqualifiedReason || (body as Record<string, unknown>).disqualified_reason);
    if (nextLeadStatus === 'disqualified' && !DISQUALIFIED_REASONS.has(disqualifiedReason || currentLead.disqualified_reason || '')) {
      return NextResponse.json({ error: 'Select a disqualification reason.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const update: Record<string, unknown> = {
      lead_status: nextLeadStatus,
      sample_status: nextSampleStatus,
      status: getLegacyStatus(nextLeadStatus, nextSampleStatus),
      updated_at: now,
    };

    if ('adminNotes' in (body as Record<string, unknown>) || 'admin_notes' in (body as Record<string, unknown>)) {
      update.admin_notes = getString((body as Record<string, unknown>).adminNotes || (body as Record<string, unknown>).admin_notes) || null;
    }

    if ('disqualifiedNotes' in (body as Record<string, unknown>) || 'disqualified_notes' in (body as Record<string, unknown>)) {
      update.disqualified_notes = getString((body as Record<string, unknown>).disqualifiedNotes || (body as Record<string, unknown>).disqualified_notes) || null;
    }

    if (nextLeadStatus === 'qualified') {
      update.qualified_at = currentLead.qualified_at || now;
      update.disqualified_reason = null;
      update.disqualified_notes = null;
      update.meta_qualified_event_id = currentLead.meta_qualified_event_id || `WholesaleLeadQualified:${leadId}`;
    }

    if (nextLeadStatus === 'disqualified') {
      update.disqualified_at = currentLead.disqualified_at || now;
      update.disqualified_reason = disqualifiedReason || currentLead.disqualified_reason;
    }

    if (nextLeadStatus === 'wholesale_customer') {
      update.wholesale_customer_at = currentLead.wholesale_customer_at || now;
    }

    if (nextLeadStatus === 'new') {
      update.disqualified_reason = null;
      update.disqualified_notes = null;
    }

    if (nextSampleStatus === 'sent') {
      update.sample_sent_at = currentLead.sample_sent_at || now;
      update.tracking_added_at = currentLead.tracking_added_at || now;
    }

    if (nextSampleStatus === 'not_sent') {
      update.sample_sent_at = null;
    }

    const { data, error } = await adminClient
      .from('wholesale_leads')
      .update(update)
      .eq('id', leadId)
      .select('*')
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message || 'Unable to update wholesale lead.' }, { status: 400 });
    }

    if (nextLeadStatus === 'qualified' && !data.meta_qualified_event_sent_at) {
      await sendWholesaleLeadQualifiedEvent(adminClient, data);
    }

    const { data: refreshedLead } = await adminClient
      .from('wholesale_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    return NextResponse.json({ success: true, lead: refreshedLead || data });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Wholesale lead update error:', error);
    return NextResponse.json({ error: 'Unable to update wholesale lead.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { adminClient } = await requireAdminAccess();
    const leadId = context.params.id;

    if (!leadId) {
      return NextResponse.json({ error: 'Missing lead id.' }, { status: 400 });
    }

    const { data, error } = await adminClient
      .from('wholesale_leads')
      .delete()
      .eq('id', leadId)
      .select('id, store_name')
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message || 'Wholesale lead not found.' }, { status: error ? 400 : 404 });
    }

    return NextResponse.json({ success: true, lead: data });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Wholesale lead delete error:', error);
    return NextResponse.json({ error: 'Unable to delete wholesale lead.' }, { status: 500 });
  }
}
