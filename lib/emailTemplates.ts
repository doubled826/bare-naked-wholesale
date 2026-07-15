import {
  BARE_LAUNCH_OFFER_DAYS,
  BARE_LAUNCH_OFFER_NAME,
} from '@/lib/bareLaunchOffer';

export type EmailTemplateAudience = 'retailer' | 'team';
export type EmailTemplateGroup = 'transactional' | 'launch_offer';

export type EmailTemplateKey =
  | 'order_confirmation'
  | 'new_order_team'
  | 'shipping_notification'
  | 'invoice_reminder'
  | 'sample_request_confirmation'
  | 'bare_launch_offer_day_1'
  | 'bare_launch_offer_day_4'
  | 'bare_launch_offer_day_9'
  | 'bare_launch_offer_final'
  | 'signup_team_notification'
  | 'message_team_notification';

export type RenderedEmailTemplate = {
  key: EmailTemplateKey;
  name: string;
  group: EmailTemplateGroup;
  audience: EmailTemplateAudience;
  description: string;
  subject: string;
  text: string;
  html: string;
};

type EmailTemplateDefinition = {
  key: EmailTemplateKey;
  name: string;
  group: EmailTemplateGroup;
  audience: EmailTemplateAudience;
  description: string;
  render: (context: EmailTemplateContext) => {
    subject: string;
    text: string;
    html?: string;
  };
};

export type EmailTemplateSampleProduct = {
  name: string;
  size?: string | null;
  price?: number | string | null;
  quantity?: number;
};

type EmailTemplateContext = {
  sampleItems: string;
  launchOffer: {
    storeName: string;
    daysRemaining: number;
    expiresAtLabel: string;
    catalogUrl: string;
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

const fallbackSampleProducts: EmailTemplateSampleProduct[] = [
  { name: 'Chicken Meal Mixer', size: '6 oz', price: 16.67, quantity: 12 },
  { name: 'Salmon Meal Mixer', size: '6 oz', price: 16.67, quantity: 8 },
  { name: 'Chicken Meal Mixer', size: '12 oz', price: 30, quantity: 6 },
];

function formatSampleItems(products: EmailTemplateSampleProduct[]) {
  return products
    .slice(0, 3)
    .map((product, index) => {
      const quantity = product.quantity || [12, 8, 6][index] || 6;
      const price = Number(product.price || 0);
      const lineTotal = price > 0 ? ` - $${(price * quantity).toFixed(2)}` : '';
      const size = product.size ? ` (${product.size})` : '';
      return `${product.name}${size} x${quantity}${lineTotal}`;
    })
    .join('\n');
}

const defaultLaunchOfferContext = () => ({
  storeName: 'Happy Paws Market',
  daysRemaining: 10,
  expiresAtLabel: 'July 15, 2026',
  catalogUrl: `${appUrl()}/catalog?offer=bare-launch`,
});

function renderBareLaunchOfferTemplate({
  subject,
  title,
  preheader,
  intro,
  bullets,
  closing,
  daysRemaining,
  expiresAtLabel,
  catalogUrl,
}: {
  subject: string;
  title: string;
  preheader: string;
  intro: string;
  bullets: string[];
  closing: string;
  daysRemaining: number;
  expiresAtLabel: string;
  catalogUrl: string;
}) {
  const urgencyLine = daysRemaining <= 1
    ? 'Your Bare Launch Offer ends today.'
    : `Your Bare Launch Offer is available for ${daysRemaining} more days, through ${expiresAtLabel}.`;
  const offerLine = 'Your launch package: 10% off your first wholesale order, free samples, and private promo support from our team.';
  const text = `${intro}

${offerLine}

${urgencyLine}

What is included:
${bullets.map((bullet) => `- ${bullet}`).join('\n')}

Claim it here:
${catalogUrl}

${closing}

Bare Naked Pet Co.`;

  return {
    subject,
    text,
    html: renderBareLaunchOfferShell({
      title,
      preheader,
      intro,
      offerLine,
      urgencyLine,
      bullets,
      closing,
      catalogUrl,
    }),
  };
}

function renderBareLaunchOfferShell({
  title,
  preheader,
  intro,
  offerLine,
  urgencyLine,
  bullets,
  closing,
  catalogUrl,
}: {
  title: string;
  preheader: string;
  intro: string;
  offerLine: string;
  urgencyLine: string;
  bullets: string[];
  closing: string;
  catalogUrl: string;
}) {
  const benefitCards = bullets
    .map((bullet) => `
      <tr>
        <td style="padding:0 0 10px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff8ea;border:1px solid #eadfce;border-radius:10px;">
            <tr>
              <td width="34" valign="top" style="padding:13px 0 13px 14px;">
                <div style="width:20px;height:20px;border-radius:50%;background:#7a4f2a;color:#ffffff;text-align:center;font-size:13px;line-height:20px;font-weight:700;">&#10003;</div>
              </td>
              <td style="padding:13px 16px 13px 8px;color:#3b2a1e;font-size:15px;line-height:1.45;">${escapeHtml(bullet)}</td>
            </tr>
          </table>
        </td>
      </tr>`)
    .join('');

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8f4ec;font-family:Arial,Helvetica,sans-serif;color:#3b2a1e;">
    <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f4ec;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:660px;background:#ffffff;border:1px solid #eadfce;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="background:#3d2314;padding:22px 26px;">
                <p style="margin:0;color:#ffffff;font-size:21px;font-weight:800;letter-spacing:.01em;">Bare Naked Pet Co.</p>
              </td>
            </tr>
            <tr>
              <td style="background:#7a4f2a;padding:22px 26px 24px;">
                <p style="display:inline-block;margin:0 0 14px;padding:6px 10px;border-radius:999px;background:#fff8ea;color:#5b351f;font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;">First-order launch package</p>
                <h1 style="margin:0;color:#ffffff;font-size:34px;line-height:1.15;font-weight:800;">${escapeHtml(title)}</h1>
                <p style="margin:14px 0 0;color:#fff2dc;font-size:17px;line-height:1.55;">${escapeHtml(intro)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:26px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f4ec;border:1px solid #eadfce;border-radius:12px;">
                  <tr>
                    <td style="padding:18px 18px 16px;">
                      <p style="margin:0 0 6px;color:#7a4f2a;font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;">Included with your launch</p>
                      <p style="margin:0;color:#3b2a1e;font-size:21px;line-height:1.35;font-weight:800;">10% off + free samples + private promo support</p>
                      <p style="margin:10px 0 0;color:#6b5f55;font-size:14px;line-height:1.55;">${escapeHtml(offerLine)}</p>
                    </td>
                  </tr>
                </table>

                <p style="margin:22px 0 18px;color:#3b2a1e;font-size:18px;line-height:1.55;font-weight:700;">${escapeHtml(urgencyLine)}</p>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  ${benefitCards}
                </table>

                <p style="margin:18px 0 0;color:#4c3a2f;font-size:16px;line-height:1.6;">${escapeHtml(closing)}</p>
                <p style="margin:24px 0 0;">${button(catalogUrl, 'Claim Launch Offer')}</p>
                <p style="margin:18px 0 0;color:#9a8e82;font-size:12px;line-height:1.45;">The offer applies automatically when eligible. Reply to this email if you want help planning the launch.</p>
              </td>
            </tr>
          </table>
          <p style="max-width:660px;margin:14px auto 0;color:#9a8e82;font-size:11px;line-height:1.45;">Bare Naked Pet Co. wholesale portal email preview.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

const definitions: EmailTemplateDefinition[] = [
  {
    key: 'order_confirmation',
    name: 'Order confirmation',
    group: 'transactional',
    audience: 'retailer',
    description: 'Sent to a retailer after an order is placed or created by an admin.',
    render: ({ sampleItems }) => {
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
    group: 'transactional',
    audience: 'team',
    description: 'Sent internally when a wholesale order is submitted.',
    render: ({ sampleItems }) => {
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
    group: 'transactional',
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
    group: 'transactional',
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
    group: 'transactional',
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
    key: 'bare_launch_offer_day_1',
    name: 'Bare Launch Offer - Day 1',
    group: 'launch_offer',
    audience: 'retailer',
    description: 'Sent shortly after signup to make sure new retailers know their launch offer is active.',
    render: ({ launchOffer }) => renderBareLaunchOfferTemplate({
      subject: `${launchOffer.storeName}, your Bare Launch Offer is live`,
      title: 'Your Bare Launch Offer is live',
      preheader: `Start strong with 10% off, free samples, and private promo support for ${BARE_LAUNCH_OFFER_DAYS} days.`,
      intro: `Welcome to Bare, ${launchOffer.storeName}. We set aside a first-order launch package to help your team bring Bare in with momentum, not guesswork.`,
      bullets: [
        '10% off your first wholesale order, applied automatically at checkout.',
        'Free customer samples so shoppers can try Bare right away.',
        'Private promo support from our team to help you introduce Bare with confidence.',
      ],
      closing: 'This is the best window to stock the shelf, sample the product, and give customers a reason to notice Bare from day one.',
      daysRemaining: launchOffer.daysRemaining,
      expiresAtLabel: launchOffer.expiresAtLabel,
      catalogUrl: launchOffer.catalogUrl,
    }),
  },
  {
    key: 'bare_launch_offer_day_4',
    name: 'Bare Launch Offer - Sampling',
    group: 'launch_offer',
    audience: 'retailer',
    description: 'Sent a few days into the offer window with emphasis on free customer samples.',
    render: ({ launchOffer }) => renderBareLaunchOfferTemplate({
      subject: `Free samples are waiting in your Bare launch package`,
      title: 'Launch with samples in hand',
      preheader: `Your Bare Launch Offer is still active, including free samples for customers and staff.`,
      intro: `Hi ${launchOffer.storeName}, your launch package includes free samples because the easiest way to build confidence in Bare is to let people try it.`,
      bullets: [
        'Give customers a low-friction first taste of Bare in-store.',
        'Help your staff start better shelf conversations with something tangible.',
        'Pair sampling with 10% off your first wholesale order and promo support from Bare.',
      ],
      closing: 'If Bare is a fit for your assortment, this launch package gives your first order more energy the moment it arrives.',
      daysRemaining: launchOffer.daysRemaining,
      expiresAtLabel: launchOffer.expiresAtLabel,
      catalogUrl: launchOffer.catalogUrl,
    }),
  },
  {
    key: 'bare_launch_offer_day_9',
    name: 'Bare Launch Offer - Promo support',
    group: 'launch_offer',
    audience: 'retailer',
    description: 'Sent mid-window to remind new retailers that promo support is included.',
    render: ({ launchOffer }) => renderBareLaunchOfferTemplate({
      subject: `We will help you make your Bare launch stand out`,
      title: 'Promo support is part of your launch',
      preheader: `Your Bare Launch Offer includes support beyond the discount.`,
      intro: `Hi ${launchOffer.storeName}, the offer is not just a discount. It is a launch plan: savings on the first order, samples for customers, and promo support from our team.`,
      bullets: [
        'Create a clear customer-facing reason to try Bare.',
        'Use samples to turn curiosity into an easier first purchase.',
        'Start with no minimums, free shipping, and a stronger first shelf moment.',
      ],
      closing: 'If Bare is on your list to bring in, this is the moment where the most support is attached to that first order.',
      daysRemaining: launchOffer.daysRemaining,
      expiresAtLabel: launchOffer.expiresAtLabel,
      catalogUrl: launchOffer.catalogUrl,
    }),
  },
  {
    key: 'bare_launch_offer_final',
    name: 'Bare Launch Offer - Final reminder',
    group: 'launch_offer',
    audience: 'retailer',
    description: 'Sent near the end of the 14-day window before the launch offer expires.',
    render: ({ launchOffer }) => renderBareLaunchOfferTemplate({
      subject: `Last call for your Bare Launch Offer`,
      title: 'Last chance to claim your launch package',
      preheader: `Your first-order discount, samples, and promo support are almost gone.`,
      intro: `Hi ${launchOffer.storeName}, this is the final reminder before your Bare Launch Offer closes.`,
      bullets: [
        '10% off your first wholesale order.',
        'Free samples for your launch order.',
        'Private promo support from the Bare team.',
      ],
      closing: 'If you want the full launch package attached to your first order, now is the time to use it.',
      daysRemaining: Math.min(launchOffer.daysRemaining, 1),
      expiresAtLabel: launchOffer.expiresAtLabel,
      catalogUrl: launchOffer.catalogUrl,
    }),
  },
  {
    key: 'signup_team_notification',
    name: 'Signup team notification',
    group: 'transactional',
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
    group: 'transactional',
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
  group: template.group,
  audience: template.audience,
  description: template.description,
}));

export function renderEmailTemplate(
  key: EmailTemplateKey,
  sampleProducts: EmailTemplateSampleProduct[] = fallbackSampleProducts,
  launchOffer = defaultLaunchOfferContext(),
): RenderedEmailTemplate | null {
  const template = definitions.find((definition) => definition.key === key);
  if (!template) return null;

  const rendered = template.render({
    sampleItems: formatSampleItems(sampleProducts.length ? sampleProducts : fallbackSampleProducts),
    launchOffer,
  });

  return {
    key: template.key,
    name: template.name,
    group: template.group,
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
