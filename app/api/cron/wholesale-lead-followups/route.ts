import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const MS_IN_DAY = 1000 * 60 * 60 * 24;
const STALE_PROCESSING_MINUTES = 30;
const MAX_LEADS_PER_RUN = 50;
const WHOLESALE_SIGNUP_URL = 'https://wholesale.barenakedpet.com/signup';
const RETAILER_ONE_PAGER_URL = 'https://retail.barenakedpet.com';
const DAVID_EMAIL = 'david@barenakedpet.com';

type WholesaleLead = {
  id: string;
  contact_name: string;
  email: string;
  store_name: string;
  lead_status?: string | null;
  approved_at?: string | null;
  sample_status?: string | null;
};

type FollowupRow = {
  id: string;
  lead_id: string;
  template_key: string;
  scheduled_for: string;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  attempts: number;
  processing_at?: string | null;
};

type FollowupStage = {
  key: string;
  dayOffset: number;
  subject: string;
  headline: string;
  preview: string;
  body: (lead: WholesaleLead) => string[];
  ctaLabel: string;
};

const followupStages: FollowupStage[] = [
  {
    key: 'sample_followup_day_14',
    dayOffset: 14,
    subject: 'How did the Bare samples land?',
    headline: 'How did the samples land?',
    preview: 'Just checking that everything arrived ok and seeing what you thought.',
    ctaLabel: 'Create wholesale account',
    body: (lead) => [
      `Hi ${lead.contact_name},`,
      `I wanted to check in and make sure your Bare Naked Pet Co. samples made it to ${lead.store_name} ok.`,
      'Once you have had a chance to try them, I would love to hear what you think. How did the texture, smell, ingredients, and customer fit feel for your store?',
      'If you are ready to bring Bare in, getting started is simple: no minimums, free shipping, and we fully guarantee product sell-through.',
      'Your welcome offer includes 10% off your first order, a free sample campaign for your customers, and a fully supported private promo with 10% off for 2-4 weeks. That offer is good for 14 days after you create your wholesale account.',
    ],
  },
  {
    key: 'sample_followup_day_21',
    dayOffset: 21,
    subject: 'A risk-free way to test Bare in your store',
    headline: 'Easy to test. Easy to start.',
    preview: 'No minimums, free shipping, and guaranteed sell-through.',
    ctaLabel: 'Review wholesale details',
    body: (lead) => [
      `Hi ${lead.contact_name},`,
      `Just wanted to follow up on the Bare samples we sent for ${lead.store_name}.`,
      'We try to make Bare an easy yes for independent retailers: no minimums, free shipping, and a full sell-through guarantee, so adding a new brand does not feel risky.',
      'If you want the deeper details on pricing, sourcing, how we do business, ISOs, Astro, launch perks, and performance data, our retailer one-pager covers it all.',
      'When you are ready, you can create your wholesale account and start with the welcome offer: 10% off your first order, customer samples, and a supported private promo.',
    ],
  },
  {
    key: 'sample_followup_day_30',
    dayOffset: 30,
    subject: 'Any feedback on the Bare samples?',
    headline: 'Any sample feedback?',
    preview: 'Happy to answer questions or help you get started.',
    ctaLabel: 'Get started with Bare',
    body: (lead) => [
      `Hi ${lead.contact_name},`,
      `One more quick check-in on the samples we sent to ${lead.store_name}.`,
      'If Bare feels like a fit, the next step is creating your wholesale account. From there, you can place a first order and use the welcome offer for 14 days.',
      'As a reminder, we keep the launch low-risk: no minimums, free shipping, a full product sell-through guarantee, free customer samples, and a supported private promo to help introduce Bare in your store.',
      `Questions, feedback, or want help thinking through the first order? Email ${DAVID_EMAIL}.`,
    ],
  },
];

const getRetailerEmailFrom = () =>
  process.env.OUTREACH_EMAIL_FROM || process.env.ORDER_EMAIL_FROM || process.env.SMTP_USER || 'info@barenakedpet.com';

const getAppUrl = () =>
  (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://wholesale.barenakedpet.com').replace(/\/$/, '');

const getRepRequestUrl = (leadId: string) =>
  `${getAppUrl()}/wholesale-leads/rep-request?lead=${encodeURIComponent(leadId)}`;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authorization = request.headers.get('authorization');
  const headerSecret = request.headers.get('x-cron-secret');
  return authorization === `Bearer ${secret}` || headerSecret === secret;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const daysSince = (value: string, now: Date) =>
  Math.floor((now.getTime() - new Date(value).getTime()) / MS_IN_DAY);

const addDays = (value: string, days: number) =>
  new Date(new Date(value).getTime() + days * MS_IN_DAY).toISOString();

const isStaleProcessing = (row: FollowupRow, now: Date) => {
  if (row.status !== 'sending' || !row.processing_at) return false;
  return now.getTime() - new Date(row.processing_at).getTime() > STALE_PROCESSING_MINUTES * 60 * 1000;
};

const getDueStage = (lead: WholesaleLead, sentOrClaimedKeys: Set<string>, now: Date) => {
  if (!lead.approved_at) return null;
  const ageDays = daysSince(lead.approved_at, now);
  return followupStages.find((stage) => ageDays >= stage.dayOffset && !sentOrClaimedKeys.has(stage.key)) || null;
};

const renderText = (lead: WholesaleLead, stage: FollowupStage) => {
  const lines = [
    ...stage.body(lead),
    '',
    `Create your wholesale account: ${WHOLESALE_SIGNUP_URL}`,
    `Want to talk with a rep? ${getRepRequestUrl(lead.id)}`,
    `Retailer one-pager: ${RETAILER_ONE_PAGER_URL}`,
    '',
    `Questions? Email ${DAVID_EMAIL}`,
    '',
    'Thanks,',
    'Bare Naked Pet Co.',
  ];
  return lines.join('\n\n');
};

const renderHtml = (lead: WholesaleLead, stage: FollowupStage) => {
  const paragraphs = stage.body(lead).map((line) => `<p style="margin:0 0 14px;color:#6b5f55;font-size:15px;line-height:1.6;">${escapeHtml(line)}</p>`).join('');

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8f4ec;font-family:Arial,Helvetica,sans-serif;color:#3b2a1e;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f4ec;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #eadfce;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:28px;">
                <p style="margin:0;color:#7a4f2a;font-weight:700;font-size:13px;letter-spacing:.04em;text-transform:uppercase;">Bare Naked Pet Co.</p>
                <h1 style="margin:12px 0 10px;font-size:25px;line-height:1.25;color:#3b2a1e;">${escapeHtml(stage.headline)}</h1>
                ${paragraphs}
                <div style="border:1px solid #eadfce;border-radius:12px;padding:18px;background:#fbf7ed;margin:18px 0;">
                  <p style="margin:0 0 10px;font-size:16px;font-weight:700;color:#3b2a1e;">Low-risk launch perks</p>
                  <p style="margin:0;color:#6b5f55;font-size:14px;line-height:1.7;">No minimums<br />Free shipping<br />Guaranteed product sell-through<br />Welcome offer: 10% first order, free customer sample campaign, and a supported 10% private promo for 2-4 weeks</p>
                </div>
                <p style="margin:22px 0 0;">
                  <a href="${WHOLESALE_SIGNUP_URL}" style="display:inline-block;background:#3b2a1e;color:#ffffff;text-decoration:none;font-weight:700;border-radius:8px;padding:12px 16px;">${escapeHtml(stage.ctaLabel)}</a>
                  <a href="${escapeHtml(getRepRequestUrl(lead.id))}" style="display:inline-block;margin-left:10px;background:#ffffff;color:#3b2a1e;text-decoration:none;font-weight:700;border:1px solid #3b2a1e;border-radius:8px;padding:11px 16px;">Talk to a rep</a>
                </p>
                <p style="margin:14px 0 0;color:#6b5f55;font-size:13px;line-height:1.6;">
                  Want the details first? Review the retailer one-pager:
                  <a href="${RETAILER_ONE_PAGER_URL}" style="color:#3b2a1e;font-weight:700;">retail.barenakedpet.com</a>
                </p>
                <p style="margin:22px 0 0;color:#6b5f55;font-size:14px;line-height:1.6;">Questions? Email <a href="mailto:${DAVID_EMAIL}" style="color:#3b2a1e;font-weight:700;">${DAVID_EMAIL}</a>.</p>
                <p style="margin:22px 0 0;color:#3b2a1e;font-size:15px;line-height:1.6;">Thanks,<br />Bare Naked Pet Co.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

async function claimFollowup(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  lead: WholesaleLead,
  stage: FollowupStage,
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
  const oldestDueApproval = new Date(now.getTime() - followupStages[0].dayOffset * MS_IN_DAY).toISOString();

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
  }) as WholesaleLead[];

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
        text: renderText(lead, stage),
        html: renderHtml(lead, stage),
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
