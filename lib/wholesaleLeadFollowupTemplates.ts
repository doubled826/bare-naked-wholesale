export const WHOLESALE_SIGNUP_URL = 'https://wholesale.barenakedpet.com/signup';
export const RETAILER_ONE_PAGER_URL = 'https://retail.barenakedpet.com';
export const DAVID_EMAIL = 'david@barenakedpet.com';

export type WholesaleLeadFollowupLead = {
  id: string;
  contact_name: string;
  email: string;
  store_name: string;
  lead_status?: string | null;
  approved_at?: string | null;
  sample_status?: string | null;
};

export type WholesaleLeadFollowupStage = {
  key: string;
  dayOffset: number;
  subject: string;
  headline: string;
  preview: string;
  body: (lead: WholesaleLeadFollowupLead) => string[];
  ctaLabel: string;
};

export const wholesaleLeadFollowupStages: WholesaleLeadFollowupStage[] = [
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
    subject: 'Ready to review wholesale details?',
    headline: 'Wholesale details and next steps',
    preview: 'Review pricing, retailer perks, and the low-risk launch offer.',
    ctaLabel: 'Review wholesale details',
    body: (lead) => [
      `Hi ${lead.contact_name},`,
      `Your Bare Naked Pet Co. sample pack should be ready for review at ${lead.store_name}.`,
      'If Bare feels like a fit, the retailer one-pager covers the details most stores want before getting started: pricing, sourcing, minimums, shipping, ISOs, Astro, launch perks, and performance data.',
      'Bare is built to be simple to test in-store: no minimums, free shipping, and guaranteed product sell-through.',
      'When you are ready, you can create a wholesale account and place an opening order through the wholesale portal.',
      'The welcome offer includes 10% off your first order, a free sample campaign for your customers, and a fully supported private promo with 10% off for 2-4 weeks. The offer is available for 14 days after your wholesale account is created.',
      'If you would rather talk through the products, pricing, or best first order for your store, you can request a rep to reach out.',
    ],
  },
  {
    key: 'sample_followup_day_30',
    dayOffset: 30,
    subject: 'Still considering Bare for your store?',
    headline: 'Still considering Bare?',
    preview: 'Here are the next steps if the samples feel like a fit.',
    ctaLabel: 'Get started with Bare',
    body: (lead) => [
      `Hi ${lead.contact_name},`,
      `This is a final follow-up on the Bare Naked Pet Co. samples sent to ${lead.store_name}.`,
      'If the samples feel like a fit, the next step is creating a wholesale account. From there, you can review pricing, place an opening order, and use the welcome offer for 14 days.',
      'Bare is a low-risk way to test a new brand: no minimums, free shipping, guaranteed product sell-through, free customer samples, and a supported private promo to help introduce the product in-store.',
      'If you are not ready to order yet but have questions, you can request a rep to reach out by call, text, or email.',
      `Questions can also be sent directly to ${DAVID_EMAIL}.`,
    ],
  },
];

export const getRepRequestUrl = (leadId: string, appUrl: string) =>
  `${appUrl.replace(/\/$/, '')}/wholesale-leads/rep-request?lead=${encodeURIComponent(leadId)}`;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

export const renderWholesaleLeadFollowupText = (
  lead: WholesaleLeadFollowupLead,
  stage: WholesaleLeadFollowupStage,
  appUrl: string,
) => {
  const lines = [
    ...stage.body(lead),
    '',
    `Create your wholesale account: ${WHOLESALE_SIGNUP_URL}`,
    `Want to talk with a rep? ${getRepRequestUrl(lead.id, appUrl)}`,
    `Retailer one-pager: ${RETAILER_ONE_PAGER_URL}`,
    '',
    `Questions? Email ${DAVID_EMAIL}`,
    '',
    'Thanks,',
    'Bare Naked Pet Co.',
  ];
  return lines.join('\n\n');
};

export const renderWholesaleLeadFollowupHtml = (
  lead: WholesaleLeadFollowupLead,
  stage: WholesaleLeadFollowupStage,
  appUrl: string,
) => {
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
                  <a href="${escapeHtml(getRepRequestUrl(lead.id, appUrl))}" style="display:inline-block;margin-left:10px;background:#ffffff;color:#3b2a1e;text-decoration:none;font-weight:700;border:1px solid #3b2a1e;border-radius:8px;padding:11px 16px;">Talk to a rep</a>
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
