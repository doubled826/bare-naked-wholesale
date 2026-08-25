import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const CONTACT_METHODS = new Set(['call', 'text', 'email']);
const BEST_TIMES = new Set(['morning', 'afternoon', 'evening', 'anytime']);
const ADMIN_EMAIL = 'info@barenakedpet.com';

const contactMethodLabels: Record<string, string> = {
  call: 'Call',
  text: 'Text',
  email: 'Email',
};

const bestTimeLabels: Record<string, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  anytime: 'Anytime',
};

const getString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const getPortalUrl = (leadId: string) => {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://wholesale.barenakedpet.com';
  return `${baseUrl.replace(/\/$/, '')}/admin/wholesale-pipeline?lead=${encodeURIComponent(leadId)}`;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const formatAddress = (lead: any) =>
  [
    lead.shipping_address_1,
    lead.shipping_address_2,
    `${lead.shipping_city}, ${lead.shipping_state} ${lead.shipping_postal_code}`,
  ]
    .filter(Boolean)
    .join('\n');

export async function POST(request: Request) {
  const adminClient = createSupabaseAdminClient();

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Send a valid JSON request body.' }, { status: 400 });
    }

    const leadId = getString((body as Record<string, unknown>).leadId || (body as Record<string, unknown>).lead_id);
    const contactMethod = getString((body as Record<string, unknown>).contactMethod || (body as Record<string, unknown>).contact_method).toLowerCase();
    const bestTimeOfDay = getString((body as Record<string, unknown>).bestTimeOfDay || (body as Record<string, unknown>).best_time_of_day).toLowerCase();
    const notes = getString((body as Record<string, unknown>).notes);

    if (!leadId) {
      return NextResponse.json({ error: 'Missing lead id.' }, { status: 400 });
    }

    if (!CONTACT_METHODS.has(contactMethod)) {
      return NextResponse.json({ error: 'Choose a contact method.' }, { status: 400 });
    }

    if (!BEST_TIMES.has(bestTimeOfDay)) {
      return NextResponse.json({ error: 'Choose the best time of day.' }, { status: 400 });
    }

    const { data: lead, error: leadError } = await adminClient
      .from('wholesale_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Wholesale lead not found.' }, { status: 404 });
    }

    const { data: repRequest, error: insertError } = await adminClient
      .from('wholesale_lead_rep_requests')
      .insert({
        lead_id: leadId,
        contact_method: contactMethod,
        best_time_of_day: bestTimeOfDay,
        notes: notes || null,
      })
      .select('id')
      .single();

    if (insertError || !repRequest) {
      return NextResponse.json({ error: insertError?.message || 'Unable to save rep request.' }, { status: 400 });
    }

    const portalUrl = getPortalUrl(leadId);
    const address = formatAddress(lead);
    const methodLabel = contactMethodLabels[contactMethod];
    const timeLabel = bestTimeLabels[bestTimeOfDay];
    const text = `
Rep outreach requested from a wholesale lead.

Store: ${lead.store_name}
Contact: ${lead.contact_name}
Email: ${lead.email}
Phone: ${lead.phone || 'Not provided'}
Preferred contact method: ${methodLabel}
Best time of day: ${timeLabel}
Notes: ${notes || 'Not provided'}

Store type: ${lead.store_type || 'Not provided'}
Website/Instagram: ${lead.store_url || 'Not provided'}

Shipping address:
${address}

Source: ${lead.source || 'landing_page'}
Campaign: ${lead.utm_campaign || 'Not captured'}
Lead ID: ${lead.id}

Open in portal:
${portalUrl}
    `.trim();

    const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8f4ec;font-family:Arial,Helvetica,sans-serif;color:#3b2a1e;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f4ec;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #eadfce;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:28px;">
                <p style="margin:0;color:#7a4f2a;font-weight:700;font-size:13px;letter-spacing:.04em;text-transform:uppercase;">Bare Naked Pet Co.</p>
                <h1 style="margin:12px 0 10px;font-size:24px;line-height:1.25;color:#3b2a1e;">Rep outreach requested</h1>
                <p style="margin:0 0 18px;color:#6b5f55;font-size:15px;line-height:1.6;">A wholesale sample lead asked for someone from Bare to reach out.</p>
                <div style="border:1px solid #eadfce;border-radius:12px;padding:18px;background:#fbf7ed;">
                  <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#3b2a1e;">${escapeHtml(lead.store_name)}</p>
                  <p style="margin:0;color:#6b5f55;font-size:14px;line-height:1.65;">
                    ${escapeHtml(lead.contact_name)}<br />
                    <a href="mailto:${escapeHtml(lead.email)}" style="color:#3b2a1e;font-weight:700;">${escapeHtml(lead.email)}</a><br />
                    ${escapeHtml(lead.phone || 'Phone not provided')}
                  </p>
                </div>
                <h2 style="margin:22px 0 8px;font-size:16px;color:#3b2a1e;">Outreach preference</h2>
                <p style="margin:0;color:#6b5f55;font-size:14px;line-height:1.6;">
                  Preferred contact method: <strong>${escapeHtml(methodLabel)}</strong><br />
                  Best time of day: <strong>${escapeHtml(timeLabel)}</strong><br />
                  Notes: ${escapeHtml(notes || 'Not provided')}
                </p>
                <h2 style="margin:22px 0 8px;font-size:16px;color:#3b2a1e;">Retailer details</h2>
                <p style="margin:0;color:#6b5f55;font-size:14px;line-height:1.6;">
                  Store type: ${escapeHtml(lead.store_type || 'Not provided')}<br />
                  Website/Instagram: ${escapeHtml(lead.store_url || 'Not provided')}<br />
                  Source: ${escapeHtml(lead.source || 'landing_page')}<br />
                  Campaign: ${escapeHtml(lead.utm_campaign || 'Not captured')}<br />
                  Lead ID: ${escapeHtml(lead.id)}
                </p>
                <h2 style="margin:22px 0 8px;font-size:16px;color:#3b2a1e;">Shipping address</h2>
                <p style="margin:0;color:#6b5f55;font-size:15px;line-height:1.6;white-space:pre-line;">${escapeHtml(address)}</p>
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

    try {
      await sendEmail({
        from: process.env.PORTAL_EMAIL_FROM || process.env.ORDER_EMAIL_FROM || process.env.SMTP_USER || ADMIN_EMAIL,
        to: ADMIN_EMAIL,
        replyTo: lead.email,
        subject: `Rep outreach requested: ${lead.store_name}`,
        text,
        html,
        tags: [{ name: 'feature', value: 'wholesale-lead-rep-request' }],
      });

      await adminClient
        .from('wholesale_lead_rep_requests')
        .update({
          notification_sent_at: new Date().toISOString(),
          notification_error: null,
        })
        .eq('id', repRequest.id);
    } catch (emailError) {
      const message = emailError instanceof Error ? emailError.message : 'Unable to send rep request notification.';
      await adminClient
        .from('wholesale_lead_rep_requests')
        .update({ notification_error: message })
        .eq('id', repRequest.id);

      throw emailError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Wholesale lead rep request error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to request rep outreach.' }, { status: 500 });
  }
}
