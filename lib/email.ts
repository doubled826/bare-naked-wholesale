import nodemailer from 'nodemailer';

const getTeamEmailTo = () =>
  process.env.ORDER_EMAIL_TO || process.env.SMTP_USER || 'info@barenakedpet.com';

const getRetailerEmailFrom = () =>
  process.env.ORDER_EMAIL_FROM || process.env.SMTP_USER || getTeamEmailTo();

const getTeamEmailFrom = () =>
  process.env.ORDER_EMAIL_TO || getRetailerEmailFrom();

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

export const sendTeamEmail = async (options: {
  subject: string;
  text: string;
  html?: string;
}) => {
  const transporter = getTransporter();
  const to = getTeamEmailTo();
  const from = getTeamEmailFrom();
  const cc = 'jack@barenakedpet.com';

  await transporter.sendMail({
    from: `"Bare Naked Pet Co." <${from}>`,
    to,
    cc,
    subject: options.subject,
    text: options.text,
    html: options.html,
  });
};

export const sendRetailerEmail = async (options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) => {
  const transporter = getTransporter();
  const from = getRetailerEmailFrom();

  await transporter.sendMail({
    from: `"Bare Naked Pet Co." <${from}>`,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
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
