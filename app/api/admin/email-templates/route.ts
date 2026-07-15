import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';
import { getTeamEmailTo, sendEmail } from '@/lib/email';
import {
  type EmailTemplateSampleProduct,
  emailTemplateSummaries,
  isEmailTemplateKey,
  renderEmailTemplate,
} from '@/lib/emailTemplates';

export const dynamic = 'force-dynamic';

const getFromAddress = (audience: 'retailer' | 'team') => {
  if (audience === 'team') {
    return process.env.PORTAL_EMAIL_FROM || process.env.ORDER_EMAIL_FROM || process.env.SMTP_USER || getTeamEmailTo();
  }

  return process.env.ORDER_EMAIL_FROM || process.env.SMTP_USER || getTeamEmailTo();
};

const getReplyToEmail = () => process.env.REPLY_TO_EMAIL || getTeamEmailTo();

const isLikelyEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

async function loadSampleProducts(adminClient: Awaited<ReturnType<typeof requireAdminAccess>>['adminClient']) {
  const { data, error } = await adminClient
    .from('products')
    .select('name, size, price')
    .eq('is_active', true)
    .order('name')
    .order('size')
    .limit(3);

  if (error) {
    console.error('Email template sample product load error:', error);
    return [];
  }

  return (data || []) as EmailTemplateSampleProduct[];
}

export async function GET() {
  try {
    const { adminClient } = await requireAdminAccess();
    const sampleProducts = await loadSampleProducts(adminClient);

    const templates = emailTemplateSummaries
      .map((template) => renderEmailTemplate(template.key, sampleProducts))
      .filter(Boolean);

    return NextResponse.json({ templates });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Email template preview load error:', error);
    return NextResponse.json({ error: 'Unable to load email templates.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { adminClient } = await requireAdminAccess();
    const body = await request.json();
    const templateKey = body?.templateKey;
    const testEmail = typeof body?.testEmail === 'string' ? body.testEmail.trim().toLowerCase() : '';

    if (!isEmailTemplateKey(templateKey)) {
      return NextResponse.json({ error: 'Choose a valid email template.' }, { status: 400 });
    }

    if (!testEmail || !isLikelyEmail(testEmail)) {
      return NextResponse.json({ error: 'Enter a valid test recipient email.' }, { status: 400 });
    }

    const sampleProducts = await loadSampleProducts(adminClient);
    const template = renderEmailTemplate(templateKey, sampleProducts);

    if (!template) {
      return NextResponse.json({ error: 'Email template not found.' }, { status: 404 });
    }

    await sendEmail({
      from: getFromAddress(template.audience),
      to: testEmail,
      replyTo: getReplyToEmail(),
      subject: `[TEST] ${template.subject}`,
      text: template.text,
      html: template.html,
      tags: [
        { name: 'feature', value: 'email-preview' },
        { name: 'template', value: template.key },
      ],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Email template test send error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to send test email.' }, { status: 500 });
  }
}
