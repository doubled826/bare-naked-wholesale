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
