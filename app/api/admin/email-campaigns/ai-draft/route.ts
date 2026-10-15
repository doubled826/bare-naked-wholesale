import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';

export const dynamic = 'force-dynamic';

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

type OpenAIContentItem =
  | { type: 'output_text'; text?: string }
  | { type: 'refusal'; refusal?: string };

type OpenAIOutputItem = {
  type?: string;
  content?: OpenAIContentItem[];
};

type GeneratedCampaignDraft = {
  name?: string;
  subject?: string;
  preheader?: string;
  headline?: string;
  body?: string;
  cta_label?: string;
  cta_url?: string;
};

const systemPrompt = `You write retailer-facing bulk email campaign drafts for Bare Naked Pet Co., a premium pet product brand selling to independent retailers.

Return only valid JSON with these string fields:
name, subject, preheader, headline, body, cta_label, cta_url.

Guidelines:
- Write to wholesale retailers, not end consumers.
- Keep the email practical, warm, specific, and easy to edit.
- Use {{first_name}} for the greeting.
- Keep subject under 60 characters when possible.
- Keep preheader under 100 characters.
- Body should be plain text with short paragraphs, no markdown tables, and no HTML.
- Do not invent discounts, dates, events, product claims, or URLs unless the user provided them.
- If no CTA is provided, use "Shop wholesale catalog" and the existing catalog URL supplied in the request.`;

const extractText = (data: { output_text?: string; output?: OpenAIOutputItem[] }) => {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const content = Array.isArray(data?.output)
    ? data.output.flatMap((item) => (item.type === 'message' && Array.isArray(item.content) ? item.content : []))
    : [];

  const text = content
    .filter((item): item is { type: 'output_text'; text?: string } => item.type === 'output_text')
    .map((item) => item.text?.trim() || '')
    .filter(Boolean)
    .join('\n');

  if (text) return text;

  return content
    .filter((item): item is { type: 'refusal'; refusal?: string } => item.type === 'refusal')
    .map((item) => item.refusal?.trim() || '')
    .find(Boolean) || '';
};

const parseGeneratedDraft = (text: string): GeneratedCampaignDraft => {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');
  const parsed = JSON.parse(cleaned) as GeneratedCampaignDraft;

  return {
    name: typeof parsed.name === 'string' ? parsed.name.trim() : '',
    subject: typeof parsed.subject === 'string' ? parsed.subject.trim() : '',
    preheader: typeof parsed.preheader === 'string' ? parsed.preheader.trim() : '',
    headline: typeof parsed.headline === 'string' ? parsed.headline.trim() : '',
    body: typeof parsed.body === 'string' ? parsed.body.trim() : '',
    cta_label: typeof parsed.cta_label === 'string' ? parsed.cta_label.trim() : '',
    cta_url: typeof parsed.cta_url === 'string' ? parsed.cta_url.trim() : '',
  };
};

export async function POST(request: Request) {
  try {
    await requireAdminAccess();

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI is not configured yet. Add OPENAI_API_KEY to the server environment.' },
        { status: 500 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const context = typeof body?.context === 'string' ? body.context.trim() : '';
    const currentCampaign = body?.campaign && typeof body.campaign === 'object' ? body.campaign : {};
    const catalogUrl = typeof currentCampaign?.cta_url === 'string' && currentCampaign.cta_url.trim()
      ? currentCampaign.cta_url.trim()
      : `${process.env.NEXT_PUBLIC_APP_URL || 'https://wholesale.barenakedpet.com'}/catalog`;

    if (!context) {
      return NextResponse.json({ error: 'Describe what this campaign should say first.' }, { status: 400 });
    }

    const userPrompt = `Create an editable email campaign draft from this context:
${context}

Current campaign values, if useful:
${JSON.stringify({
  name: currentCampaign?.name || '',
  subject: currentCampaign?.subject || '',
  preheader: currentCampaign?.preheader || '',
  headline: currentCampaign?.headline || '',
  body: currentCampaign?.body || '',
  cta_label: currentCampaign?.cta_label || '',
  cta_url: catalogUrl,
})}`;

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        instructions: systemPrompt,
        input: [{ role: 'user', content: [{ type: 'input_text', text: userPrompt }] }],
        max_output_tokens: 900,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const apiError = data?.error?.message as string | undefined;
      const friendlyError =
        response.status === 429
          ? 'OpenAI rate limit reached. Please wait a moment and try again.'
          : apiError || 'OpenAI request failed.';

      return NextResponse.json({ error: friendlyError }, { status: response.status });
    }

    const text = extractText(data);
    if (!text) {
      return NextResponse.json({ error: 'OpenAI returned an empty response.' }, { status: 502 });
    }

    try {
      const draft = parseGeneratedDraft(text);
      if (!draft.subject || !draft.headline || !draft.body) {
        return NextResponse.json({ error: 'OpenAI returned an incomplete campaign draft.' }, { status: 502 });
      }

      return NextResponse.json({ draft });
    } catch (error) {
      console.error('Email campaign AI draft parse error:', error, text);
      return NextResponse.json({ error: 'OpenAI returned a draft in an unexpected format.' }, { status: 502 });
    }
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Email campaign AI draft error:', error);
    return NextResponse.json({ error: 'Unable to generate email campaign draft right now.' }, { status: 500 });
  }
}
