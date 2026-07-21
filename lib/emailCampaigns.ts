import { getTeamEmailTo } from '@/lib/email';

export type EmailCampaignAudienceFilter =
  | 'all_retailers'
  | 'never_ordered'
  | 'ordered_once'
  | 'repeat_buyers'
  | 'manual';

export type EmailCampaignInput = {
  id?: string;
  template_key?: string;
  name: string;
  subject: string;
  preheader?: string | null;
  headline: string;
  body: string;
  cta_label?: string | null;
  cta_url?: string | null;
  hero_image_url?: string | null;
  audience_filter: EmailCampaignAudienceFilter;
  manual_recipients?: string | null;
};

export type EmailCampaignRecipient = {
  retailer_id?: string | null;
  email: string;
  company_name?: string | null;
  contact_name?: string | null;
  first_name?: string | null;
};

type RetailerRow = {
  id: string;
  company_name?: string | null;
  email?: string | null;
  contact_name?: string | null;
};

type OrderRow = {
  retailer_id?: string | null;
  status?: string | null;
};

const DEFAULT_APP_URL = 'https://wholesale.barenakedpet.com';

export const defaultEmailCampaign: EmailCampaignInput = {
  template_key: 'retailer_announcement',
  name: 'New retailer campaign',
  subject: 'A quick update from Bare Naked Pet Co.',
  preheader: 'A retailer update from Bare Naked Pet Co.',
  headline: 'A quick update for your Bare Naked display',
  body: `Hi {{first_name}},

We wanted to share a quick update with our retail partners.

Thanks for carrying Bare Naked Pet Co. and helping more pet parents discover simple, high-quality toppers.`,
  cta_label: 'Shop wholesale catalog',
  cta_url: `${process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL}/catalog`,
  hero_image_url: '',
  audience_filter: 'all_retailers',
  manual_recipients: '',
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const isLikelyEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const getFirstName = (contactName?: string | null) => {
  const firstName = (contactName || '').trim().split(/\s+/)[0];
  return firstName || null;
};

const replaceMergeTags = (value: string, recipient?: Partial<EmailCampaignRecipient>) => {
  const contactName = (recipient?.contact_name || '').trim();
  const firstName = (recipient?.first_name || getFirstName(contactName) || 'there').trim();
  const replacements: Record<string, string> = {
    first_name: firstName,
    contact_name: contactName || firstName,
    company_name: (recipient?.company_name || 'your store').trim(),
    store_name: (recipient?.company_name || 'your store').trim(),
    email: (recipient?.email || '').trim(),
  };

  return value.replace(/\{\{\s*(first_name|contact_name|company_name|store_name|email)\s*\}\}/gi, (_match, key: string) => {
    return replacements[key.toLowerCase()] || '';
  });
};

const stripFormattingMarkers = (value: string) =>
  value
    .replace(/\*\*([\s\S]+?)\*\*/g, '$1')
    .replace(/_([^_\n]+?)_/g, '$1')
    .replace(/\[u\]([\s\S]+?)\[\/u\]/gi, '$1');

const formatInlineHtml = (value: string) => {
  let html = escapeHtml(value);
  html = html.replace(/\[u\]([\s\S]+?)\[\/u\]/gi, '<span style="text-decoration:underline;">$1</span>');
  html = html.replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/_([^_\n]+?)_/g, '<em>$1</em>');
  return html;
};

const isMissingContactNameColumnError = (error: unknown) => {
  const maybeError = error as { code?: string; message?: string };
  return (
    maybeError?.code === '42703' ||
    maybeError?.code === 'PGRST204' ||
    (typeof maybeError?.message === 'string' && maybeError.message.includes('contact_name'))
  );
};

async function loadRetailerRows(adminClient: any): Promise<RetailerRow[]> {
  const { data, error } = await adminClient
    .from('retailers')
    .select('id, company_name, email, contact_name')
    .order('company_name');

  if (!error) return (data || []) as RetailerRow[];
  if (!isMissingContactNameColumnError(error)) throw error;

  const fallback = await adminClient
    .from('retailers')
    .select('id, company_name, email')
    .order('company_name');

  if (fallback.error) throw fallback.error;
  return (fallback.data || []) as RetailerRow[];
}

const normalizeCampaign = (campaign: Partial<EmailCampaignInput>): EmailCampaignInput => ({
  ...defaultEmailCampaign,
  ...campaign,
  template_key: campaign.template_key || defaultEmailCampaign.template_key,
  name: (campaign.name || defaultEmailCampaign.name).trim(),
  subject: (campaign.subject || defaultEmailCampaign.subject).trim(),
  preheader: (campaign.preheader || '').trim(),
  headline: (campaign.headline || defaultEmailCampaign.headline).trim(),
  body: (campaign.body || defaultEmailCampaign.body).trim(),
  cta_label: (campaign.cta_label || '').trim(),
  cta_url: (campaign.cta_url || '').trim(),
  hero_image_url: (campaign.hero_image_url || '').trim(),
  audience_filter: campaign.audience_filter || defaultEmailCampaign.audience_filter,
  manual_recipients: campaign.manual_recipients || '',
});

const textToParagraphs = (text: string) =>
  text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p style="margin:0 0 16px;color:#4c3a2f;font-size:15px;line-height:1.65;">${formatInlineHtml(paragraph).replace(/\n/g, '<br />')}</p>`)
    .join('');

export function renderEmailCampaign(campaignInput: Partial<EmailCampaignInput>, recipient?: Partial<EmailCampaignRecipient>) {
  const campaign = normalizeCampaign(campaignInput);
  const personalizedSubject = replaceMergeTags(campaign.subject, recipient);
  const personalizedPreheader = replaceMergeTags(campaign.preheader || campaign.subject, recipient);
  const personalizedHeadline = replaceMergeTags(campaign.headline, recipient);
  const personalizedBody = replaceMergeTags(campaign.body, recipient);
  const ctaUrl = replaceMergeTags(campaign.cta_url || '', recipient);
  const ctaLabel = replaceMergeTags(campaign.cta_label || '', recipient);
  const heroImageUrl = replaceMergeTags(campaign.hero_image_url || '', recipient);
  const bodyHtml = textToParagraphs(personalizedBody);
  const cta = ctaUrl && ctaLabel
    ? `<p style="margin:24px 0 0;"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#3d2314;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:700;font-size:14px;">${escapeHtml(ctaLabel)}</a></p>`
    : '';
  const hero = heroImageUrl
    ? `<tr><td style="padding:0 24px 22px;"><img src="${escapeHtml(heroImageUrl)}" alt="" width="612" style="display:block;width:100%;max-width:612px;border-radius:12px;border:1px solid #eadfce;" /></td></tr>`
    : '';

  const text = `${stripFormattingMarkers(personalizedHeadline)}

${stripFormattingMarkers(personalizedBody)}
${ctaUrl && ctaLabel ? `\n${ctaLabel}: ${ctaUrl}` : ''}

Bare Naked Pet Co.`;

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8f4ec;font-family:Arial,Helvetica,sans-serif;color:#3b2a1e;">
    <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(personalizedPreheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f4ec;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:660px;background:#ffffff;border:1px solid #eadfce;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="background:#3d2314;padding:18px 24px;">
                <p style="margin:0;color:#ffffff;font-size:18px;font-weight:700;">Bare Naked Pet Co.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 24px 18px;">
                <p style="margin:0 0 10px;color:#a74f28;font-weight:700;font-size:12px;letter-spacing:.05em;text-transform:uppercase;">Retailer Update</p>
                <h1 style="margin:0;color:#3b2a1e;font-size:30px;line-height:1.18;font-weight:800;">${escapeHtml(personalizedHeadline)}</h1>
              </td>
            </tr>
            ${hero}
            <tr>
              <td style="padding:0 24px 28px;">
                ${bodyHtml}
                ${cta}
              </td>
            </tr>
          </table>
          <p style="max-width:660px;margin:14px auto 0;color:#9a8e82;font-size:11px;line-height:1.45;">You are receiving this because your store has a Bare Naked Pet Co. wholesale portal account. Reply to this email if you need help.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return {
    campaign,
    subject: personalizedSubject,
    preheader: personalizedPreheader,
    text,
    html,
  };
}

export function parseManualRecipients(value?: string | null): EmailCampaignRecipient[] {
  const unique = new Map<string, EmailCampaignRecipient>();
  const tokens = (value || '')
    .split(/[\n,;]/)
    .map((token) => token.trim())
    .filter(Boolean);

  for (const token of tokens) {
    const match = token.match(/^(?:(.*?)\s*)?<([^>]+)>$/);
    const email = (match?.[2] || token).trim().toLowerCase();
    const companyName = (match?.[1] || '').trim() || null;
    if (!isLikelyEmail(email) || unique.has(email)) continue;
    unique.set(email, {
      email,
      company_name: companyName,
      contact_name: companyName,
      first_name: getFirstName(companyName),
    });
  }

  return Array.from(unique.values());
}

export async function loadCampaignRecipients(
  adminClient: any,
  campaignInput: Partial<EmailCampaignInput>,
): Promise<EmailCampaignRecipient[]> {
  const campaign = normalizeCampaign(campaignInput);

  if (campaign.audience_filter === 'manual') {
    return parseManualRecipients(campaign.manual_recipients);
  }

  const [retailers, { data: orders, error: ordersError }] = await Promise.all([
    loadRetailerRows(adminClient),
    adminClient.from('orders').select('retailer_id, status'),
  ]);

  if (ordersError) throw ordersError;

  const orderCounts = new Map<string, number>();
  for (const order of (orders || []) as OrderRow[]) {
    if (!order.retailer_id || order.status === 'canceled') continue;
    orderCounts.set(order.retailer_id, (orderCounts.get(order.retailer_id) || 0) + 1);
  }

  const unique = new Map<string, EmailCampaignRecipient>();
  for (const retailer of retailers) {
    const email = (retailer.email || '').trim().toLowerCase();
    if (!email || !isLikelyEmail(email) || unique.has(email)) continue;

    const orderCount = orderCounts.get(retailer.id) || 0;
    if (campaign.audience_filter === 'never_ordered' && orderCount !== 0) continue;
    if (campaign.audience_filter === 'ordered_once' && orderCount !== 1) continue;
    if (campaign.audience_filter === 'repeat_buyers' && orderCount < 2) continue;

    unique.set(email, {
      retailer_id: retailer.id,
      email,
      company_name: retailer.company_name || null,
      contact_name: retailer.contact_name || null,
      first_name: getFirstName(retailer.contact_name),
    });
  }

  return Array.from(unique.values());
}

const getFromAddress = () =>
  process.env.OUTREACH_EMAIL_FROM || process.env.ORDER_EMAIL_FROM || process.env.SMTP_USER || getTeamEmailTo();

const getReplyToEmail = () => process.env.REPLY_TO_EMAIL || getTeamEmailTo();

export async function sendResendCampaignEmail(options: {
  to: string;
  subject: string;
  text: string;
  html: string;
  campaignId?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error('Resend is not configured. Add RESEND_API_KEY to the server environment.');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `"Bare Naked Pet Co." <${getFromAddress()}>`,
      to: [options.to],
      reply_to: getReplyToEmail(),
      subject: options.subject,
      text: options.text,
      html: options.html,
      tags: [
        { name: 'feature', value: 'marketing' },
        { name: 'campaign', value: options.campaignId || 'draft' },
      ],
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || 'Resend request failed.');
  }

  return payload as { id?: string };
}

export function summarizeRecipients(recipients: EmailCampaignRecipient[]) {
  return {
    recipientCount: recipients.length,
    sampleRecipients: recipients.slice(0, 6),
  };
}

export function getCampaignValidationError(
  campaignInput: Partial<EmailCampaignInput>,
  options: { requireRecipients?: boolean } = { requireRecipients: true },
) {
  const campaign = normalizeCampaign(campaignInput);
  if (!campaign.name) return 'Add a campaign name.';
  if (!campaign.subject) return 'Add a subject line.';
  if (!campaign.headline) return 'Add a headline.';
  if (!campaign.body) return 'Add email body copy.';
  if ((campaign.cta_label && !campaign.cta_url) || (!campaign.cta_label && campaign.cta_url)) {
    return 'Add both a CTA label and CTA URL, or leave both blank.';
  }
  if (options.requireRecipients !== false && campaign.audience_filter === 'manual' && parseManualRecipients(campaign.manual_recipients).length === 0) {
    return 'Add at least one valid manual recipient.';
  }
  return null;
}
