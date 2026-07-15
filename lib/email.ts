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
