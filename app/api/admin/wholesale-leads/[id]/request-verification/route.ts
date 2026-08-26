import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    id: string;
  };
};

const ADMIN_EMAIL = 'info@barenakedpet.com';

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const getAppUrl = () =>
  (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://wholesale.barenakedpet.com').replace(/\/$/, '');

const getVerificationUrl = (token: string) =>
  `${getAppUrl()}/wholesale-leads/verify?token=${encodeURIComponent(token)}`;

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
    const { adminClient } = await requireAdminAccess();
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

    if (!lead.email) {
      return NextResponse.json({ error: 'This lead does not have an email address.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { data: updatedLead, error: updateError } = await adminClient
      .from('wholesale_leads')
      .update({
        verification_status: 'requested',
        verification_requested_at: lead.verification_requested_at || now,
        verification_failed_at: null,
        updated_at: now,
      })
      .eq('id', leadId)
      .select('*')
      .single();

    if (updateError || !updatedLead) {
      return NextResponse.json({ error: updateError?.message || 'Unable to request retailer verification.' }, { status: 400 });
    }

    const verificationToken = updatedLead.verification_token || updatedLead.id;
    const verificationUrl = getVerificationUrl(verificationToken);
    const address = formatAddress(updatedLead);

    const text = `
Thanks for requesting Bare Naked Pet Co. retailer samples.

Before we send wholesale samples, we verify that each request is connected to an active retail store. We were not able to verify your store from the information submitted.

If you are a retailer, please verify your store here:
${verificationUrl}

You can share a store website, Instagram/Facebook page, Google Business Profile, storefront details, or anything else that helps confirm the request.

Original request:
Store: ${updatedLead.store_name}
Contact: ${updatedLead.contact_name}
Email: ${updatedLead.email}
Phone: ${updatedLead.phone || 'Not provided'}
Store type: ${updatedLead.store_type || 'Not provided'}
Website/social submitted: ${updatedLead.store_url || 'Not provided'}
Shipping address:
${address}

Thanks,
Bare Naked Pet Co.
    `.trim();

    const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8f4ec;font-family:Arial,Helvetica,sans-serif;color:#3b2a1e;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f4ec;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #eadfce;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:28px;">
                <p style="margin:0;color:#7a4f2a;font-weight:700;font-size:13px;letter-spacing:.04em;text-transform:uppercase;">Bare Naked Pet Co.</p>
                <h1 style="margin:12px 0 10px;font-size:25px;line-height:1.25;color:#3b2a1e;">Store verification needed</h1>
                <p style="margin:0 0 18px;color:#6b5f55;font-size:15px;line-height:1.6;">Thanks for requesting retailer samples. Before we send wholesale samples, we verify that each request is connected to an active retail store.</p>
                <div style="border:1px solid #eadfce;border-radius:12px;padding:18px;background:#fbf7ed;">
                  <p style="margin:0;color:#6b5f55;font-size:15px;line-height:1.6;">We were not able to verify your store from the information submitted. If you are a retailer, please send a little more information and we will review the sample request again.</p>
                </div>
                <p style="margin:22px 0 0;">
                  <a href="${escapeHtml(verificationUrl)}" style="display:inline-block;background:#3b2a1e;color:#ffffff;text-decoration:none;font-weight:700;border-radius:8px;padding:12px 16px;">Verify my store</a>
                </p>
                <h2 style="margin:24px 0 8px;font-size:16px;color:#3b2a1e;">What helps</h2>
                <p style="margin:0;color:#6b5f55;font-size:14px;line-height:1.65;">Store website, Instagram/Facebook page, Google Business Profile, storefront details, or anything else that confirms the request is connected to an active retail store.</p>
                <h2 style="margin:24px 0 8px;font-size:16px;color:#3b2a1e;">Request details</h2>
                <p style="margin:0;color:#6b5f55;font-size:14px;line-height:1.65;">
                  Store: ${escapeHtml(updatedLead.store_name)}<br />
                  Contact: ${escapeHtml(updatedLead.contact_name)}<br />
                  Store type: ${escapeHtml(updatedLead.store_type || 'Not provided')}<br />
                  Website/social submitted: ${escapeHtml(updatedLead.store_url || 'Not provided')}
                </p>
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
      from: process.env.PORTAL_EMAIL_FROM || process.env.ORDER_EMAIL_FROM || process.env.SMTP_USER || ADMIN_EMAIL,
      to: updatedLead.email,
      replyTo: ADMIN_EMAIL,
      subject: 'Store verification needed for your sample request',
      text,
      html,
      tags: [{ name: 'feature', value: 'wholesale-lead-verification' }],
    });

    return NextResponse.json({ success: true, lead: updatedLead });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Wholesale lead verification request error:', error);
    return NextResponse.json({ error: 'Unable to request retailer verification.' }, { status: 500 });
  }
}
