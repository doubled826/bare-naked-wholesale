import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

function createSupabaseRecoveryClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error('Missing Supabase recovery credentials');
  }

  return createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function findAuthUserByEmail(email: string) {
  const supabaseAdmin = createSupabaseAdminClient();
  let page = 1;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw error;
    }

    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);

    if (user) {
      return user;
    }

    if (!data.nextPage || data.users.length === 0) {
      return null;
    }

    page += 1;
  }
}

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!normalizedEmail) {
      return NextResponse.json({ error: 'Please enter your email address.' }, { status: 400 });
    }

    const user = await findAuthUserByEmail(normalizedEmail);

    if (!user) {
      const params = new URLSearchParams({
        email: normalizedEmail,
        welcome: 'new-portal',
      });

      return NextResponse.json({
        action: 'signup',
        redirectTo: `/signup?${params.toString()}`,
      });
    }

    const recoveryClient = createSupabaseRecoveryClient();
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL;
    const redirectBase = origin?.replace(/\/$/, '');
    const redirectTo = redirectBase ? `${redirectBase}/reset-password` : undefined;
    const { error } = await recoveryClient.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo,
    });

    if (error) {
      console.error('Forgot password recovery error:', error);
      return NextResponse.json({ error: 'Unable to send reset instructions right now.' }, { status: 400 });
    }

    return NextResponse.json({
      action: 'reset',
      message: 'Password reset instructions sent.',
    });
  } catch (error) {
    console.error('Forgot password route error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred. Please try again.' }, { status: 500 });
  }
}
