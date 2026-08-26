import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const ADMIN_EMAIL = 'info@barenakedpet.com';

const getString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

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

export async function POST(request: Request) {
  const adminClient = createSupabaseAdminClient();

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Send a valid JSON request body.' }, { status: 400 });
    }

    const token = getString((body as Record<string, unknown>).token);
    const storeUrl = getString((body as Record<string, unknown>).storeUrl || (body as Record<string, unknown>).store_url);
    const socialUrl = getString((body as Record<string, unknown>).socialUrl || (body as Record<string, unknown>).social_url);
    const googleProfileUrl = getString((body as Record<string, unknown>).googleProfileUrl || (body as Record<string, unknown>).google_profile_url);
    const notes = getString((body as Record<string, unknown>).notes);

    if (!token) {
      return NextResponse.json({ error: 'This verification link is missing a token.' }, { status: 400 });
    }

    if (!storeUrl && !socialUrl && !googleProfileUrl && !notes) {
      return NextResponse.json({ error: 'Add at least one verification detail before submitting.' }, { status: 400 });
    }

    const { data: lead, error: leadError } = await adminClient
      .from('wholesale_leads')
      .select('*')
      .eq('verification_token', token)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Verification link not found.' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const submittedNotes = [
      notes,
      `Verification submitted at ${now}.`,
      storeUrl ? `Store website: ${storeUrl}` : '',
      socialUrl ? `Social profile: ${socialUrl}` : '',
      googleProfileUrl ? `Google Business Profile: ${googleProfileUrl}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const { data: updatedLead, error: updateError } = await adminClient
      .from('wholesale_leads')
      .update({
        verification_status: 'submitted',
        verification_submitted_at: now,
        verification_store_url: storeUrl || null,
        verification_social_url: socialUrl || null,
        verification_google_profile_url: googleProfileUrl || null,
        verification_notes: notes || null,
        admin_notes: [lead.admin_notes, submittedNotes].filter(Boolean).join('\n\n') || null,
        updated_at: now,
      })
      .eq('id', lead.id)
      .select('*')
      .single();

    if (updateError || !updatedLead) {
      return NextResponse.json({ error: updateError?.message || 'Unable to save verification.' }, { status: 400 });
    }

    const portalUrl = getPortalUrl(updatedLead.id);
    const text = `
Retailer verification submitted.

Store: ${updatedLead.store_name}
Contact: ${updatedLead.contact_name}
Email: ${updatedLead.email}
Phone: ${updatedLead.phone || 'Not provided'}

Store website: ${storeUrl || 'Not provided'}
Social profile: ${socialUrl || 'Not provided'}
Google Business Profile: ${googleProfileUrl || 'Not provided'}
Notes: ${notes || 'Not provided'}

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
                <h1 style="margin:12px 0 10px;font-size:24px;line-height:1.25;color:#3b2a1e;">Retailer verification submitted</h1>
                <p style="margin:0 0 18px;color:#6b5f55;font-size:15px;line-height:1.6;">A wholesale lead submitted additional store verification details.</p>
                <div style="border:1px solid #eadfce;border-radius:12px;padding:18px;background:#fbf7ed;">
                  <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#3b2a1e;">${escapeHtml(updatedLead.store_name)}</p>
                  <p style="margin:0;color:#6b5f55;font-size:14px;line-height:1.65;">
                    ${escapeHtml(updatedLead.contact_name)}<br />
                    <a href="mailto:${escapeHtml(updatedLead.email)}" style="color:#3b2a1e;font-weight:700;">${escapeHtml(updatedLead.email)}</a><br />
                    ${escapeHtml(updatedLead.phone || 'Phone not provided')}
                  </p>
                </div>
                <h2 style="margin:22px 0 8px;font-size:16px;color:#3b2a1e;">Verification details</h2>
                <p style="margin:0;color:#6b5f55;font-size:14px;line-height:1.7;">
                  Store website: ${escapeHtml(storeUrl || 'Not provided')}<br />
                  Social profile: ${escapeHtml(socialUrl || 'Not provided')}<br />
                  Google Business Profile: ${escapeHtml(googleProfileUrl || 'Not provided')}<br />
                  Notes: ${escapeHtml(notes || 'Not provided')}
                </p>
                <p style="margin:24px 0 0;">
                  <a href="${escapeHtml(portalUrl)}" style="display:inline-block;background:#3b2a1e;color:#ffffff;text-decoration:none;font-weight:700;border-radius:8px;padding:12px 16px;">Review lead in portal</a>
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
      from: process.env.PORTAL_EMAIL_FROM || process.env.ORDER_EMAIL_FROM || process.env.SMTP_USER || ADMIN_EMAIL,
      to: ADMIN_EMAIL,
      replyTo: updatedLead.email,
      subject: `Retailer verification submitted: ${updatedLead.store_name}`,
      text,
      html,
      tags: [{ name: 'feature', value: 'wholesale-lead-verification' }],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Wholesale lead verification submit error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to submit verification.' }, { status: 500 });
  }
}
