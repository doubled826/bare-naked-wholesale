import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';
import {
  DISCOUNT_CODE_SELECT,
  getDiscountValidationError,
  sanitizeDiscountPayload,
} from '@/lib/discountCodes';

export const dynamic = 'force-dynamic';

const isMissingDiscountTableError = (error: unknown) => {
  const maybeError = error as { code?: string; message?: string };
  return (
    maybeError?.code === '42P01' ||
    maybeError?.code === 'PGRST205' ||
    (typeof maybeError?.message === 'string' && maybeError.message.includes('discount_codes'))
  );
};

export async function GET() {
  try {
    const { adminClient } = await requireAdminAccess();
    const { data, error } = await adminClient
      .from('discount_codes')
      .select(DISCOUNT_CODE_SELECT)
      .order('created_at', { ascending: false });

    if (error) {
      if (isMissingDiscountTableError(error)) {
        return NextResponse.json({
          discounts: [],
          setupRequired: true,
          setupMessage: 'Run the discount codes Supabase migration before saving discounts.',
        });
      }

      throw error;
    }

    return NextResponse.json({ discounts: data || [] });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Discount code load error:', error);
    return NextResponse.json({ error: 'Unable to load discount codes.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, adminClient } = await requireAdminAccess();
    const body = await request.json().catch(() => ({}));
    const discount = sanitizeDiscountPayload(body);
    const validationError = getDiscountValidationError(discount);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const { data, error } = await adminClient
      .from('discount_codes')
      .insert({
        ...discount,
        created_by: user.id,
      })
      .select(DISCOUNT_CODE_SELECT)
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A discount with that code already exists.' }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ discount: data });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Discount code create error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create discount code.' }, { status: 500 });
  }
}
