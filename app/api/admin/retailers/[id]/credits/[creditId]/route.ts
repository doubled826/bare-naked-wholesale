import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

async function requireAdmin() {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('id')
    .eq('id', user.id)
    .single();

  if (!adminUser) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { user };
}

export async function DELETE(_: Request, { params }: { params: { id: string; creditId: string } }) {
  const adminCheck = await requireAdmin();
  if ('error' in adminCheck) {
    return adminCheck.error;
  }

  const { user } = adminCheck;
  const adminClient = createSupabaseAdminClient();

  try {
    const { data: credit, error: creditError } = await adminClient
      .from('retailer_credits')
      .select(`
        id,
        retailer_id,
        status,
        applications:retailer_credit_applications(id)
      `)
      .eq('id', params.creditId)
      .eq('retailer_id', params.id)
      .single();

    if (creditError || !credit) {
      return NextResponse.json({ error: 'Credit not found.' }, { status: 404 });
    }

    const hasApplications = Array.isArray(credit.applications) && credit.applications.length > 0;

    if (hasApplications) {
      const { error: voidError } = await adminClient
        .from('retailer_credits')
        .update({
          status: 'voided',
          remaining_amount: 0,
          voided_at: new Date().toISOString(),
          voided_by: user.id,
        })
        .eq('id', credit.id);

      if (voidError) {
        console.error('Retailer credit void error:', voidError);
        return NextResponse.json({ error: 'Failed to void credit.' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        action: 'voided',
        message: 'Credit was already applied to an order, so the remaining balance was voided.',
      });
    }

    const { error: deleteError } = await adminClient
      .from('retailer_credits')
      .delete()
      .eq('id', credit.id);

    if (deleteError) {
      console.error('Retailer credit delete error:', deleteError);
      return NextResponse.json({ error: 'Failed to remove credit.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      action: 'deleted',
      message: 'Credit removed.',
    });
  } catch (error) {
    console.error('Retailer credit delete error:', error);
    return NextResponse.json({ error: 'Failed to remove credit.' }, { status: 500 });
  }
}
