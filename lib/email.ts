import nodemailer from 'nodemailer';

type EmailRecipient = string | string[];

type EmailOptions = {
  from: string;
  to: EmailRecipient;
  subject: string;
  text: string;
  html?: string;
  cc?: EmailRecipient;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
};

export const getTeamEmailTo = () =>
  process.env.ORDER_EMAIL_TO || process.env.SMTP_USER || 'info@barenakedpet.com';

const getRetailerEmailFrom = () =>
  process.env.ORDER_EMAIL_FROM || process.env.SMTP_USER || getTeamEmailTo();

const getTeamEmailFrom = () =>
  process.env.PORTAL_EMAIL_FROM || process.env.ORDER_EMAIL_FROM || process.env.SMTP_USER || getTeamEmailTo();

const getReplyToEmail = () =>
  process.env.REPLY_TO_EMAIL || getTeamEmailTo();

const getTransporter = () =>
  nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

const sendResendEmail = async (options: EmailOptions) => {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return false;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `"Bare Naked Pet Co." <${options.from}>`,
      to: Array.isArray(options.to) ? options.to : [options.to],
      ...(options.cc ? { cc: Array.isArray(options.cc) ? options.cc : [options.cc] } : {}),
      reply_to: options.replyTo,
      subject: options.subject,
      text: options.text,
      html: options.html,
      ...(options.tags ? { tags: options.tags } : {}),
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || 'Resend request failed.');
  }

  return true;
};

const sendSmtpEmail = async (options: EmailOptions) => {
  const transporter = getTransporter();

  await transporter.sendMail({
    from: `"Bare Naked Pet Co." <${options.from}>`,
    to: options.to,
    ...(options.cc ? { cc: options.cc } : {}),
    ...(options.replyTo ? { replyTo: options.replyTo } : {}),
    subject: options.subject,
    text: options.text,
    html: options.html,
  });
};

export const sendEmail = async (options: EmailOptions) => {
  const sentWithResend = await sendResendEmail(options);

  if (!sentWithResend) {
    await sendSmtpEmail(options);
  }
};

export const sendTeamEmail = async (options: {
  subject: string;
  text: string;
  html?: string;
  to?: string;
  cc?: string;
}) => {
  const to = options.to || getTeamEmailTo();
  const from = getTeamEmailFrom();
  const cc = options.cc ?? 'jack@barenakedpet.com';

  await sendEmail({
    from,
    to,
    cc,
    replyTo: getReplyToEmail(),
    subject: options.subject,
    text: options.text,
    html: options.html,
    tags: [{ name: 'feature', value: 'transactional' }],
  });
};

export const sendRetailerEmail = async (options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) => {
  const from = getRetailerEmailFrom();

  await sendEmail({
    from,
    to: options.to,
    replyTo: getReplyToEmail(),
    subject: options.subject,
    text: options.text,
    html: options.html,
    tags: [{ name: 'feature', value: 'transactional' }],
  });
};

const getOutreachEmailFrom = () =>
  process.env.OUTREACH_EMAIL_FROM || process.env.ORDER_EMAIL_FROM || process.env.SMTP_USER || getTeamEmailTo();

const getWholesaleSignupUrl = () =>
  process.env.WHOLESALE_SIGNUP_URL || 'https://wholesale.barenakedpet.com/signup';

const getSampleRequestUrl = () =>
  process.env.SAMPLE_REQUEST_URL || 'https://wholesale.barenakedpet.com/signup';

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

export type CustomerReviewEmailOptions = {
  to: string;
  contactName?: string | null;
  storeName?: string | null;
  subject: string;
  reviewText: string;
  reviewerName?: string | null;
  rating?: number | null;
  productName?: string | null;
  imageUrl?: string | null;
  ctaMode?: 'both' | 'samples' | 'wholesale';
};

export function buildCustomerReviewEmail(options: CustomerReviewEmailOptions) {
  const firstName = (options.contactName || '').trim().split(/\s+/)[0];
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,';
  const rating = Math.min(5, Math.max(1, options.rating || 5));
  const stars = '★'.repeat(rating);
  const reviewer = options.reviewerName?.trim() || 'Verified customer';
  const productLine = options.productName?.trim() ? `<p style="margin:0 0 16px;color:#6b5f55;font-size:14px;">${escapeHtml(options.productName.trim())}</p>` : '';
  const image = options.imageUrl?.trim()
    ? `<img src="${escapeHtml(options.imageUrl.trim())}" alt="Customer review" width="520" style="display:block;width:100%;max-width:520px;border-radius:12px;border:1px solid #eadfce;margin:18px 0;" />`
    : '';
  const ctaMode = options.ctaMode || 'both';
  const showSamples = ctaMode === 'both' || ctaMode === 'samples';
  const showWholesale = ctaMode === 'both' || ctaMode === 'wholesale';
  const ctaSentence =
    ctaMode === 'samples'
      ? 'If you would like to take a closer look at Bare for your store, you can request samples below.'
      : ctaMode === 'wholesale'
        ? 'If you would like to take a closer look at Bare for your store, you can create a wholesale account below.'
        : 'If you would like to take a closer look at Bare for your store, you can request samples or create a wholesale account below.';
  const buttonStyle = 'display:inline-block;margin:6px 8px 6px 0;padding:12px 16px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;';
  const sampleButton = showSamples
    ? `<a href="${escapeHtml(getSampleRequestUrl())}" style="${buttonStyle}background:#7a4f2a;color:#ffffff;">Request Samples</a>`
    : '';
  const wholesaleButton = showWholesale
    ? `<a href="${escapeHtml(getWholesaleSignupUrl())}" style="${buttonStyle}background:#f5efe3;color:#4a3323;border:1px solid #dfd1bf;">Create Wholesale Account</a>`
    : '';

  const text = `${greeting}

We wanted to share a recent customer review from Bare Naked Pet Co.

"${options.reviewText}"

${reviewer}${options.productName ? `, ${options.productName}` : ''}

${ctaSentence}

${showSamples ? `Request Samples: ${getSampleRequestUrl()}` : ''}
${showWholesale ? `Create Wholesale Account: ${getWholesaleSignupUrl()}` : ''}

Bare Naked Pet Co.`;

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8f4ec;font-family:Arial,Helvetica,sans-serif;color:#3b2a1e;">
    <div style="display:none;max-height:0;overflow:hidden;">A recent customer review from Bare Naked Pet Co.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f4ec;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #eadfce;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:24px 26px 10px;">
                <p style="margin:0;color:#7a4f2a;font-weight:700;font-size:13px;letter-spacing:.04em;text-transform:uppercase;">Bare Naked Pet Co.</p>
                <h1 style="margin:12px 0 8px;font-size:24px;line-height:1.25;color:#3b2a1e;">New customer review</h1>
                <p style="margin:0 0 20px;color:#6b5f55;font-size:15px;line-height:1.55;">${escapeHtml(greeting)} We wanted to share a recent customer review from Bare Naked Pet Co.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 26px 8px;">
                <div style="border-left:4px solid #7a4f2a;padding:4px 0 4px 18px;">
                  <p style="margin:0 0 12px;color:#d7a327;font-size:17px;letter-spacing:1px;">${stars}</p>
                  ${productLine}
                  <p style="margin:0;font-size:20px;line-height:1.45;color:#3b2a1e;">“${escapeHtml(options.reviewText)}”</p>
                  <p style="margin:16px 0 0;color:#6b5f55;font-size:14px;">${escapeHtml(reviewer)}</p>
                </div>
                ${image}
              </td>
            </tr>
            <tr>
              <td style="padding:10px 26px 28px;">
                <p style="margin:0 0 14px;color:#6b5f55;font-size:15px;line-height:1.55;">${escapeHtml(ctaSentence)}</p>
                <div>${sampleButton}${wholesaleButton}</div>
                <p style="margin:22px 0 0;color:#6b5f55;font-size:14px;line-height:1.5;">Bare Naked Pet Co.</p>
              </td>
            </tr>
          </table>
          <p style="max-width:600px;margin:14px auto 0;color:#9a8e82;font-size:11px;line-height:1.45;">You are receiving this because your store expressed interest in Bare Naked Pet Co. Reply to this email if you would rather not receive occasional product updates.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { html, text };
}

export async function sendCustomerReviewEmail(options: CustomerReviewEmailOptions) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error('Resend is not configured. Add RESEND_API_KEY to the server environment.');
  }

  const { html, text } = buildCustomerReviewEmail(options);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `"Bare Naked Pet Co." <${getOutreachEmailFrom()}>`,
      to: [options.to],
      subject: options.subject,
      html,
      text,
      tags: [
        { name: 'feature', value: 'outreach' },
        { name: 'play', value: 'customer-review' },
      ],
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || 'Resend request failed.');
  }

  return payload as { id?: string };
}

export const formatOrderItemsText = (items: Array<{ name: string; size?: string; quantity: number; price: number }>) =>
  items
    .map(
      (item) =>
        `• ${item.name}${item.size ? ` (${item.size})` : ''} x${item.quantity} - $${(
          item.price * item.quantity
        ).toFixed(2)}`
    )
    .join('\n');

const normalizeText = (value?: string) => (value || '').toLowerCase().trim();

const sizeStartsWith = (value: string, target: '6' | '12') =>
  value.startsWith(target);

export const formatTeamOrderItemsText = (
  items: Array<{ name: string; size?: string; quantity: number; price: number }>
) => {
  const normalizedItems = items.map((item) => ({
    ...item,
    nameNormalized: normalizeText(item.name),
    sizeNormalized: normalizeText(item.size).replace(/\s+/g, ''),
  }));

  const fixedSkuOrder = [
    {
      label: 'Chicken (6oz)',
      match: (item: typeof normalizedItems[number]) =>
        item.nameNormalized.includes('chicken') && sizeStartsWith(item.sizeNormalized, '6'),
    },
    {
      label: 'Chicken (12oz)',
      match: (item: typeof normalizedItems[number]) =>
        item.nameNormalized.includes('chicken') && sizeStartsWith(item.sizeNormalized, '12'),
    },
    {
      label: 'Salmon (6oz)',
      match: (item: typeof normalizedItems[number]) =>
        item.nameNormalized.includes('salmon') && sizeStartsWith(item.sizeNormalized, '6'),
    },
    {
      label: 'Salmon (12oz)',
      match: (item: typeof normalizedItems[number]) =>
        item.nameNormalized.includes('salmon') && sizeStartsWith(item.sizeNormalized, '12'),
    },
    {
      label: 'Beef (6oz)',
      match: (item: typeof normalizedItems[number]) =>
        item.nameNormalized.includes('beef') && sizeStartsWith(item.sizeNormalized, '6'),
    },
    {
      label: 'Beef (12oz)',
      match: (item: typeof normalizedItems[number]) =>
        item.nameNormalized.includes('beef') && sizeStartsWith(item.sizeNormalized, '12'),
    },
    {
      label: 'Lamb',
      match: (item: typeof normalizedItems[number]) => item.nameNormalized.includes('lamb'),
    },
    {
      label: 'Minnow',
      match: (item: typeof normalizedItems[number]) => item.nameNormalized.includes('minnow'),
    },
    {
      label: 'Bison',
      match: (item: typeof normalizedItems[number]) => item.nameNormalized.includes('bison'),
    },
  ];

  return fixedSkuOrder
    .map((sku) => {
      const matchedItems = normalizedItems.filter((item) => sku.match(item));
      const totalQuantity = matchedItems.reduce((sum, item) => sum + item.quantity, 0);
      const totalPrice = matchedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

      if (totalQuantity <= 0) {
        return `• ${sku.label}`;
      }

      return `• ${sku.label} x${totalQuantity} - $${totalPrice.toFixed(2)}`;
    })
    .join('\n');
};
