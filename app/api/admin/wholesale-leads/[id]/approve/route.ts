import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    id: string;
  };
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const getPortalUrl = (leadId: string) => {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://wholesale.barenakedpet.com';
  return `${baseUrl.replace(/\/$/, '')}/admin/wholesale-pipeline?lead=${encodeURIComponent(leadId)}`;
};

const formatAddress = (lead: any) =>
  [
    lead.shipping_address_1,
    lead.shipping_address_2,
    `${lead.shipping_city}, ${lead.shipping_state} ${lead.shipping_postal_code}`,
  ]
    .filter(Boolean)
    .join('\n');

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { user, adminClient } = await requireAdminAccess();
    const leadId = context.params.id;

    if (!leadId) {
      return NextResponse.json({ error: 'Missing lead id.' }, { status: 400 });
    }

    const { data: lead, error: leadError } = await adminClient
      .from('wholesale_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Wholesale lead not found.' }, { status: 404 });
    }

    const currentLeadStatus = lead.lead_status || (lead.status === 'converted' ? 'wholesale_customer' : lead.status === 'closed' ? 'disqualified' : 'new');
    if (currentLeadStatus === 'disqualified' || currentLeadStatus === 'wholesale_customer') {
      return NextResponse.json({ error: 'Closed or converted leads cannot be approved.' }, { status: 400 });
    }

    const approvedAt = new Date().toISOString();
    const { data: updatedLead, error: updateError } = await adminClient
      .from('wholesale_leads')
      .update({
        lead_status: lead.lead_status || 'new',
        sample_status: 'not_sent',
        status: 'sample_pack_pending',
        approved_at: approvedAt,
        approved_by: user.id,
        disqualified_reason: null,
        disqualified_notes: null,
        updated_at: approvedAt,
      })
      .eq('id', leadId)
      .select('*')
      .single();

    if (updateError || !updatedLead) {
      return NextResponse.json({ error: updateError?.message || 'Unable to approve sample request.' }, { status: 400 });
    }

    const address = formatAddress(updatedLead);
    const portalUrl = getPortalUrl(leadId);
    const text = `
New wholesale sample request approved.

Store: ${updatedLead.store_name}
Contact: ${updatedLead.contact_name}
Email: ${updatedLead.email}
Phone: ${updatedLead.phone || 'Not provided'}
Store Type: ${updatedLead.store_type || 'Not provided'}
Website/Instagram: ${updatedLead.store_url || 'Not provided'}

Ship sample pack to:
${address}

Source: ${updatedLead.source || 'landing_page'}
Campaign: ${updatedLead.utm_campaign || 'Not captured'}

Open in portal:
${portalUrl}
    `.trim();

    const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8f4ec;font-family:Arial,Helvetica,sans-serif;color:#3b2a1e;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f4ec;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #eadfce;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:26px 28px 8px;">
                <p style="margin:0;color:#7a4f2a;font-weight:700;font-size:13px;letter-spacing:.04em;text-transform:uppercase;">Bare Naked Pet Co.</p>
                <h1 style="margin:12px 0 8px;font-size:24px;line-height:1.25;color:#3b2a1e;">Sample pack approved</h1>
                <p style="margin:0 0 20px;color:#6b5f55;font-size:15px;line-height:1.55;">Please send a wholesale sample pack to the retailer below.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 24px;">
                <div style="border:1px solid #eadfce;border-radius:12px;padding:18px;background:#fbf7ed;">
                  <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#3b2a1e;">${escapeHtml(updatedLead.store_name)}</p>
                  <p style="margin:0;color:#6b5f55;font-size:14px;line-height:1.55;">
                    ${escapeHtml(updatedLead.contact_name)}<br />
                    ${escapeHtml(updatedLead.email)}<br />
                    ${escapeHtml(updatedLead.phone || 'Phone not provided')}
                  </p>
                </div>
                <h2 style="margin:22px 0 8px;font-size:16px;color:#3b2a1e;">Shipping address</h2>
                <p style="margin:0;color:#6b5f55;font-size:15px;line-height:1.6;white-space:pre-line;">${escapeHtml(address)}</p>
                <h2 style="margin:22px 0 8px;font-size:16px;color:#3b2a1e;">Retailer details</h2>
                <p style="margin:0;color:#6b5f55;font-size:14px;line-height:1.6;">
                  Store type: ${escapeHtml(updatedLead.store_type || 'Not provided')}<br />
                  Website/Instagram: ${escapeHtml(updatedLead.store_url || 'Not provided')}<br />
                  Source: ${escapeHtml(updatedLead.source || 'landing_page')}<br />
                  Campaign: ${escapeHtml(updatedLead.utm_campaign || 'Not captured')}
                </p>
                <p style="margin:24px 0 0;">
                  <a href="${escapeHtml(portalUrl)}" style="display:inline-block;background:#3b2a1e;color:#ffffff;text-decoration:none;font-weight:700;border-radius:8px;padding:12px 16px;">Open lead in portal</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

    await sendEmail({
      from: process.env.PORTAL_EMAIL_FROM || process.env.ORDER_EMAIL_FROM || process.env.SMTP_USER || 'info@barenakedpet.com',
      to: 'info@barenakedpet.com',
      replyTo: updatedLead.email,
      subject: `Approved sample request: ${updatedLead.store_name}`,
      text,
      html,
      tags: [{ name: 'feature', value: 'wholesale-leads' }],
    });

    const retailerText = `
Hi ${updatedLead.contact_name},

Good news - your Bare Naked Pet Co. sample pack has been approved and is being sent to your store.

It should arrive within about a week.

Shipping to:
${address}

Once you have a chance to try the samples, our team will follow up with wholesale next steps and your first-order offer.

In the meantime, you can review wholesale pricing, minimums, shipping, sourcing, retailer perks, and account setup here:
https://retail.barenakedpet.com

Thanks,
Bare Naked Pet Co.
    `.trim();

    const retailerHtml = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8f4ec;font-family:Arial,Helvetica,sans-serif;color:#3b2a1e;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f4ec;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #eadfce;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:28px;">
                <p style="margin:0;color:#7a4f2a;font-weight:700;font-size:13px;letter-spacing:.04em;text-transform:uppercase;">Bare Naked Pet Co.</p>
                <h1 style="margin:12px 0 10px;font-size:25px;line-height:1.25;color:#3b2a1e;">Your samples are on the way</h1>
                <p style="margin:0 0 18px;color:#6b5f55;font-size:15px;line-height:1.6;">Hi ${escapeHtml(updatedLead.contact_name)}, your wholesale sample pack has been approved and is being sent to your store. It should arrive within about a week.</p>
                <div style="border:1px solid #eadfce;border-radius:12px;padding:18px;background:#fbf7ed;">
                  <p style="margin:0 0 8px;font-size:16px;font-weight:700;color:#3b2a1e;">Shipping to</p>
                  <p style="margin:0;color:#6b5f55;font-size:15px;line-height:1.6;white-space:pre-line;">${escapeHtml(address)}</p>
                </div>
                <p style="margin:20px 0 0;color:#6b5f55;font-size:15px;line-height:1.6;">Once you have a chance to try the samples, our team will follow up with wholesale next steps and your first-order offer.</p>
                <p style="margin:22px 0 0;">
                  <a href="https://retail.barenakedpet.com" style="display:inline-block;background:#3b2a1e;color:#ffffff;text-decoration:none;font-weight:700;border-radius:8px;padding:12px 16px;">Review wholesale details</a>
                </p>
                <p style="margin:14px 0 0;color:#6b5f55;font-size:13px;line-height:1.6;">Pricing, minimums, shipping, sourcing, retailer perks, and account setup are all covered there.</p>
                <p style="margin:22px 0 0;color:#3b2a1e;font-size:15px;line-height:1.6;">Thanks,<br />Bare Naked Pet Co.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

    await sendEmail({
      from: process.env.PORTAL_EMAIL_FROM || process.env.ORDER_EMAIL_FROM || process.env.SMTP_USER || 'info@barenakedpet.com',
      to: updatedLead.email,
      replyTo: 'info@barenakedpet.com',
      subject: 'Your Bare Naked Pet Co. samples are on the way',
      text: retailerText,
      html: retailerHtml,
      tags: [{ name: 'feature', value: 'wholesale-leads' }],
    });

    return NextResponse.json({ success: true, lead: updatedLead });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Wholesale lead approval error:', error);
    return NextResponse.json({ error: 'Unable to approve sample request.' }, { status: 500 });
  }
}
