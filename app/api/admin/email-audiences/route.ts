import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';
import { validateEmailAudienceConditions } from '@/lib/emailCampaigns';

export const dynamic = 'force-dynamic';

const isMissingAudienceTableError = (error: unknown) => {
  const maybeError = error as { code?: string; message?: string };
  return maybeError?.code === '42P01' || maybeError?.code === 'PGRST205' || Boolean(maybeError?.message?.includes('email_audiences'));
};

export async function GET() {
  try {
    const { adminClient } = await requireAdminAccess();
    const [audiencesResult, productsResult] = await Promise.all([
      adminClient
        .from('email_audiences')
        .select('id, name, conditions, created_at, updated_at')
        .order('name'),
      adminClient
        .from('products')
        .select('id, name, size, category, is_active')
        .order('name'),
    ]);

    if (audiencesResult.error && !isMissingAudienceTableError(audiencesResult.error)) throw audiencesResult.error;
    if (productsResult.error) throw productsResult.error;

    return NextResponse.json({
      audiences: audiencesResult.data || [],
      products: productsResult.data || [],
      setupRequired: Boolean(audiencesResult.error),
      setupMessage: audiencesResult.error ? 'Run the saved email audiences migration to create reusable audiences.' : null,
    });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Email audience load error:', error);
    return NextResponse.json({ error: 'Unable to load saved audiences.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, adminClient } = await requireAdminAccess();
    const body = await request.json().catch(() => ({}));
    const name = String(body?.name || '').trim();
    if (name.length < 2 || name.length > 80) {
      return NextResponse.json({ error: 'Enter an audience name between 2 and 80 characters.' }, { status: 400 });
    }
    const conditions = validateEmailAudienceConditions(body?.conditions);

    const { data, error } = await adminClient
      .from('email_audiences')
      .insert({ name, conditions, created_by: user.id })
      .select('id, name, conditions, created_at, updated_at')
      .single();
    if (error) throw error;

    return NextResponse.json({ audience: data });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Email audience create error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create audience.' }, { status: 500 });
  }
}
