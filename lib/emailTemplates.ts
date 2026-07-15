export type EmailTemplateAudience = 'retailer' | 'team';

export type EmailTemplateKey =
  | 'order_confirmation'
  | 'new_order_team'
  | 'shipping_notification'
  | 'invoice_reminder'
  | 'sample_request_confirmation'
  | 'signup_team_notification'
  | 'message_team_notification';

export type RenderedEmailTemplate = {
  key: EmailTemplateKey;
  name: string;
  audience: EmailTemplateAudience;
  description: string;
  subject: string;
  text: string;
  html: string;
};

type EmailTemplateDefinition = {
  key: EmailTemplateKey;
  name: string;
  audience: EmailTemplateAudience;
  description: string;
  render: () => {
    subject: string;
    text: string;
    html?: string;
  };
};

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'https://wholesale.barenakedpet.com';

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const textToHtml = (text: string) =>
  text
    .split('\n')
    .map((line) => (line.trim() ? escapeHtml(line) : '&nbsp;'))
    .join('<br />');

const button = (href: string, label: string) =>
  `<a href="${escapeHtml(href)}" style="display:inline-block;background:#3d2314;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:700;">${escapeHtml(label)}</a>`;

const renderShell = (options: {
  title: string;
  preheader: string;
  text: string;
  cta?: { href: string; label: string };
}) => {
  const cta = options.cta
    ? `<p style="margin:24px 0;">${button(options.cta.href, options.cta.label)}</p>`
    : '';

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8f4ec;font-family:Arial,Helvetica,sans-serif;color:#3b2a1e;">
    <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(options.preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f4ec;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #eadfce;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:#3d2314;padding:20px 24px;">
                <p style="margin:0;color:#ffffff;font-size:18px;font-weight:700;">Bare Naked Pet Co.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 24px;">
                <h1 style="margin:0 0 18px;font-size:24px;line-height:1.25;color:#3b2a1e;">${escapeHtml(options.title)}</h1>
                <div style="font-size:15px;line-height:1.65;color:#4c3a2f;">${textToHtml(options.text)}</div>
                ${cta}
              </td>
            </tr>
          </table>
          <p style="max-width:620px;margin:14px auto 0;color:#9a8e82;font-size:11px;line-height:1.45;">Bare Naked Pet Co. wholesale portal email preview.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

const sampleItems = `Chicken Jerky (6oz) x12 - $119.88
Salmon Jerky (6oz) x8 - $87.92
Chicken Jerky (12oz) x6 - $95.94`;

const definitions: EmailTemplateDefinition[] = [
  {
    key: 'order_confirmation',
    name: 'Order confirmation',
    audience: 'retailer',
    description: 'Sent to a retailer after an order is placed or created by an admin.',
    render: () => {
      const subject = 'Order Confirmation: BNP-1042';
      const text = `Thank you for your order!

Your order BNP-1042 has been received and is being processed.

Order Details:
${sampleItems}

Marketing Materials Added: Counter card kit
Subtotal: $303.74
Credit Applied: -$25.00
Total: $278.74

Ship-To Location:
- Name: Happy Paws Market
- Address: 123 Main Street, Detroit, MI 48226
- Phone: (313) 555-0198

We'll notify you when your order ships.

Thank you for choosing Bare Naked Pet Co.!`;

      return {
        subject,
        text,
        html: renderShell({
          title: 'Order confirmation',
          preheader: 'Your Bare Naked Pet Co. wholesale order has been received.',
          text,
        }),
      };
    },
  },
  {
    key: 'new_order_team',
    name: 'New order team notification',
    audience: 'team',
    description: 'Sent internally when a wholesale order is submitted.',
    render: () => {
      const subject = 'New Wholesale Order: BNP-1042';
      const text = `New Wholesale Order Received!

Order Number: BNP-1042

Customer Information:
- Business Name: Happy Paws Market
- Email: buyer@happypaws.example
- Phone: (313) 555-0198
- Address: 123 Main Street, Detroit, MI 48226

Ship-To Location:
- Name: Happy Paws Market
- Address: 123 Main Street, Detroit, MI 48226
- Phone: (313) 555-0198

Order Details:
${sampleItems}

Subtotal: $303.74
Credit Applied: -$25.00
Total: $278.74

Requested Delivery Date: July 22, 2026
Promotion Code: LAUNCH25

---
This order was placed through the Bare Naked Pet Co. Wholesale Portal.`;

      return {
        subject,
        text,
        html: renderShell({
          title: 'New wholesale order',
          preheader: 'A new wholesale order was submitted through the portal.',
          text,
        }),
      };
    },
  },
  {
    key: 'shipping_notification',
    name: 'Shipping notification',
    audience: 'retailer',
    description: 'Sent to a retailer when an admin sends tracking details.',
    render: () => {
      const subject = 'Your order has shipped: BNP-1042';
      const text = `Your order has shipped!

Order Number: BNP-1042
Tracking Number: 1Z999AA10123456784
Carrier: UPS

Thank you for your order. If you have any questions, please contact us at info@barenakedpet.com.

Best regards,
Bare Naked Pet Co.`;

      return {
        subject,
        text,
        html: renderShell({
          title: 'Your order has shipped',
          preheader: 'Tracking details are available for your wholesale order.',
          text,
          cta: { href: 'https://www.ups.com/track?tracknum=1Z999AA10123456784', label: 'Track shipment' },
        }),
      };
    },
  },
  {
    key: 'invoice_reminder',
    name: 'Invoice reminder',
    audience: 'retailer',
    description: 'Sent to a retailer with a QuickBooks invoice link.',
    render: () => {
      const subject = 'Your QuickBooks Invoice for BNP-1042';
      const invoiceUrl = `${appUrl()}/sample-invoice`;
      const text = `Hi there,

Your invoice is ready. Please use the link below to view and pay:
${invoiceUrl}

Thanks,
Bare Naked Pet Co.`;

      return {
        subject,
        text,
        html: renderShell({
          title: 'Your invoice is ready',
          preheader: 'Your Bare Naked Pet Co. wholesale invoice is ready to view and pay.',
          text,
          cta: { href: invoiceUrl, label: 'View invoice' },
        }),
      };
    },
  },
  {
    key: 'sample_request_confirmation',
    name: 'Sample request confirmation',
    audience: 'retailer',
    description: 'Sent to a retailer after they request samples.',
    render: () => {
      const subject = 'Sample Request Received';
      const text = 'Thanks! Your request has been submitted. We will include samples with your next order.';

      return {
        subject,
        text,
        html: renderShell({
          title: 'Sample request received',
          preheader: 'We received your sample request.',
          text,
        }),
      };
    },
  },
  {
    key: 'signup_team_notification',
    name: 'Signup team notification',
    audience: 'team',
    description: 'Sent internally when a new retailer creates an account.',
    render: () => {
      const subject = 'New Retailer Signup';
      const text = `New retailer signup received.

Business Name: Happy Paws Market
Contact Name: Jamie Carter
Email: buyer@happypaws.example
Phone: (313) 555-0198
Address: 123 Main Street, Detroit, MI 48226
Tax ID: 12-3456789`;

      return {
        subject,
        text,
        html: renderShell({
          title: 'New retailer signup',
          preheader: 'A new retailer created a wholesale portal account.',
          text,
        }),
      };
    },
  },
  {
    key: 'message_team_notification',
    name: 'Message team notification',
    audience: 'team',
    description: 'Sent internally when a retailer sends a portal message.',
    render: () => {
      const subject = 'Retailer Message - Happy Paws Market';
      const text = `Hi team, can you confirm whether the launch promo applies to our next reorder?

--
Retailer: Happy Paws Market
Account: HP-1024
Email: buyer@happypaws.example
Phone: (313) 555-0198
Address: 123 Main Street, Detroit, MI 48226
Conversation ID: preview-conversation-id`;

      return {
        subject,
        text,
        html: renderShell({
          title: 'New retailer message',
          preheader: 'A retailer sent a message through the wholesale portal.',
          text,
        }),
      };
    },
  },
];

export const emailTemplateSummaries = definitions.map((template) => ({
  key: template.key,
  name: template.name,
  audience: template.audience,
  description: template.description,
}));

export function renderEmailTemplate(key: EmailTemplateKey): RenderedEmailTemplate | null {
  const template = definitions.find((definition) => definition.key === key);
  if (!template) return null;

  const rendered = template.render();

  return {
    key: template.key,
    name: template.name,
    audience: template.audience,
    description: template.description,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html || renderShell({
      title: template.name,
      preheader: template.description,
      text: rendered.text,
    }),
  };
}

export function isEmailTemplateKey(value: unknown): value is EmailTemplateKey {
  return typeof value === 'string' && definitions.some((template) => template.key === value);
}
