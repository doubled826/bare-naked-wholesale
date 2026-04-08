import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

type SalesHubMessage = {
  role: 'user' | 'assistant';
  content: string;
};

async function requireAdmin() {
  const supabase = createRouteHandlerClient({ cookies });
  const adminClient = createSupabaseAdminClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  const { data: adminById } = await adminClient
    .from('admin_users')
    .select('id')
    .eq('id', user.id)
    .single();

  if (adminById) {
    return true;
  }

  if (!user.email) {
    return false;
  }

  const { data: adminByEmail } = await adminClient
    .from('admin_users')
    .select('id')
    .eq('email', user.email)
    .single();

  return !!adminByEmail;
}

function toOpenAIInput(system: string, messages: SalesHubMessage[]) {
  return [
    {
      role: 'system',
      content: [{ type: 'input_text', text: system }],
    },
    ...messages.map(message => ({
      role: message.role,
      content: [{ type: 'input_text', text: message.content }],
    })),
  ];
}

export async function POST(request: Request) {
  try {
    const isAdmin = await requireAdmin();

    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI is not configured yet. Add OPENAI_API_KEY to the server environment.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const system = typeof body?.system === 'string' ? body.system : '';
    const messages = Array.isArray(body?.messages) ? body.messages : [];

    if (!system || messages.length === 0) {
      return NextResponse.json({ error: 'Missing prompt data.' }, { status: 400 });
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: toOpenAIInput(system, messages),
        max_output_tokens: 600,
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

    const text =
      typeof data?.output_text === 'string'
        ? data.output_text
        : '';

    if (!text) {
      return NextResponse.json({ error: 'OpenAI returned an empty response.' }, { status: 502 });
    }

    return NextResponse.json({ text });
  } catch (error) {
    console.error('Sales Hub AI error:', error);
    return NextResponse.json({ error: 'Unable to generate content right now. Please try again.' }, { status: 500 });
  }
}
