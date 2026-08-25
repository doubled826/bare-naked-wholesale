import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import {
  DAVID_EMAIL,
  renderWholesaleLeadFollowupHtml,
  renderWholesaleLeadFollowupText,
  type WholesaleLeadFollowupLead,
  type WholesaleLeadFollowupStage,
  wholesaleLeadFollowupStages,
} from '@/lib/wholesaleLeadFollowupTemplates';

export const dynamic = 'force-dynamic';

const MS_IN_DAY = 1000 * 60 * 60 * 24;
const STALE_PROCESSING_MINUTES = 30;
const MAX_LEADS_PER_RUN = 50;

type FollowupRow = {
  id: string;
  lead_id: string;
  template_key: string;
  scheduled_for: string;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  attempts: number;
  processing_at?: string | null;
};

const getRetailerEmailFrom = () =>
  process.env.OUTREACH_EMAIL_FROM || process.env.ORDER_EMAIL_FROM || process.env.SMTP_USER || 'info@barenakedpet.com';

const getAppUrl = () =>
  (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://wholesale.barenakedpet.com').replace(/\/$/, '');

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authorization = request.headers.get('authorization');
  const headerSecret = request.headers.get('x-cron-secret');
  return authorization === `Bearer ${secret}` || headerSecret === secret;
}

const daysSince = (value: string, now: Date) =>
  Math.floor((now.getTime() - new Date(value).getTime()) / MS_IN_DAY);

const addDays = (value: string, days: number) =>
  new Date(new Date(value).getTime() + days * MS_IN_DAY).toISOString();

const isStaleProcessing = (row: FollowupRow, now: Date) => {
  if (row.status !== 'sending' || !row.processing_at) return false;
  return now.getTime() - new Date(row.processing_at).getTime() > STALE_PROCESSING_MINUTES * 60 * 1000;
};

const getDueStage = (lead: WholesaleLeadFollowupLead, sentOrClaimedKeys: Set<string>, now: Date) => {
  if (!lead.approved_at) return null;
  const ageDays = daysSince(lead.approved_at, now);
  return wholesaleLeadFollowupStages.find((stage) => ageDays >= stage.dayOffset && !sentOrClaimedKeys.has(stage.key)) || null;
};

async function claimFollowup(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  lead: WholesaleLeadFollowupLead,
  stage: WholesaleLeadFollowupStage,
  existingRow: FollowupRow | undefined,
  now: Date,
) {
  const nowIso = now.toISOString();

  if (!existingRow) {
    const { data, error } = await adminClient
      .from('wholesale_lead_followup_emails')
      .insert({
        lead_id: lead.id,
        template_key: stage.key,
        scheduled_for: addDays(lead.approved_at as string, stage.dayOffset),
        status: 'sending',
        attempts: 1,
        processing_at: nowIso,
        last_error: null,
      })
      .select('*')
      .single();

    if (error || !data) return null;
    return data as FollowupRow;
  }

  if (existingRow.status === 'sent') return null;
  if (existingRow.status === 'sending' && !isStaleProcessing(existingRow, now)) return null;

  const { data, error } = await adminClient
    .from('wholesale_lead_followup_emails')
    .update({
      status: 'sending',
      attempts: (existingRow.attempts || 0) + 1,
      processing_at: nowIso,
      last_error: null,
      updated_at: nowIso,
    })
    .eq('id', existingRow.id)
    .in('status', existingRow.status === 'sending' ? ['sending'] : ['pending', 'failed'])
    .select('*')
    .single();

  if (error || !data) return null;
  return data as FollowupRow;
}

async function handleFollowupRun(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminClient = createSupabaseAdminClient();
  const now = new Date();
  const oldestDueApproval = new Date(now.getTime() - wholesaleLeadFollowupStages[0].dayOffset * MS_IN_DAY).toISOString();

  const { data: leads, error: leadsError } = await adminClient
    .from('wholesale_leads')
    .select('id, contact_name, email, store_name, lead_status, approved_at, sample_status')
    .not('approved_at', 'is', null)
    .lte('approved_at', oldestDueApproval)
    .order('approved_at', { ascending: true })
    .limit(MAX_LEADS_PER_RUN);

  if (leadsError) throw leadsError;

  const eligibleLeads = (leads || []).filter((lead) => {
    const status = String(lead.lead_status || 'new');
    return lead.email && !['qualified', 'disqualified', 'wholesale_customer'].includes(status);
  }) as WholesaleLeadFollowupLead[];

  if (eligibleLeads.length === 0) {
    return NextResponse.json({ success: true, sent: 0, skipped: 0, candidates: 0, errors: [] });
  }

  const leadIds = eligibleLeads.map((lead) => lead.id);
  const { data: followups, error: followupsError } = await adminClient
    .from('wholesale_lead_followup_emails')
    .select('id, lead_id, template_key, scheduled_for, status, attempts, processing_at')
    .in('lead_id', leadIds);

  if (followupsError) throw followupsError;

  const followupsByLead = new Map<string, FollowupRow[]>();
  (followups || []).forEach((row) => {
    const current = followupsByLead.get(row.lead_id) || [];
    current.push(row as FollowupRow);
    followupsByLead.set(row.lead_id, current);
  });

  let sent = 0;
  let skipped = 0;
  const errors: Array<{ leadId: string; templateKey: string; error: string }> = [];

  for (const lead of eligibleLeads) {
    const leadFollowups = followupsByLead.get(lead.id) || [];
    const sentOrSendingKeys = new Set(
      leadFollowups
        .filter((row) => row.status === 'sent' || (row.status === 'sending' && !isStaleProcessing(row, now)))
        .map((row) => row.template_key),
    );
    const stage = getDueStage(lead, sentOrSendingKeys, now);

    if (!stage) {
      skipped += 1;
      continue;
    }

    const existingRow = leadFollowups.find((row) => row.template_key === stage.key);
    const claimedRow = await claimFollowup(adminClient, lead, stage, existingRow, now);
    if (!claimedRow) {
      skipped += 1;
      continue;
    }

    try {
      await sendEmail({
        from: getRetailerEmailFrom(),
        to: lead.email,
        replyTo: DAVID_EMAIL,
        subject: stage.subject,
        text: renderWholesaleLeadFollowupText(lead, stage, getAppUrl()),
        html: renderWholesaleLeadFollowupHtml(lead, stage, getAppUrl()),
        tags: [
          { name: 'feature', value: 'wholesale-lead-followup' },
          { name: 'template', value: stage.key },
        ],
      });

      const sentAt = new Date().toISOString();
      await adminClient
        .from('wholesale_lead_followup_emails')
        .update({
          status: 'sent',
          sent_at: sentAt,
          processing_at: null,
          last_error: null,
          updated_at: sentAt,
        })
        .eq('id', claimedRow.id);

      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to send wholesale lead follow-up.';
      const failedAt = new Date().toISOString();
      await adminClient
        .from('wholesale_lead_followup_emails')
        .update({
          status: 'failed',
          processing_at: null,
          last_error: message,
          updated_at: failedAt,
        })
        .eq('id', claimedRow.id);

      errors.push({ leadId: lead.id, templateKey: stage.key, error: message });
    }
  }

  return NextResponse.json({
    success: errors.length === 0,
    sent,
    skipped,
    candidates: eligibleLeads.length,
    errors,
  }, { status: errors.length > 0 ? 207 : 200 });
}

export async function GET(request: Request) {
  try {
    return await handleFollowupRun(request);
  } catch (error) {
    console.error('Wholesale lead follow-up cron error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to run wholesale lead follow-ups.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
