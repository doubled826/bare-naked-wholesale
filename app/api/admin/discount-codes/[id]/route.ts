import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';
import {
  DISCOUNT_CODE_SELECT,
  getDiscountValidationError,
  sanitizeDiscountPayload,
} from '@/lib/discountCodes';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { adminClient } = await requireAdminAccess();
    const body = await request.json().catch(() => ({}));
    const discount = sanitizeDiscountPayload(body);
    const validationError = getDiscountValidationError(discount);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const { data, error } = await adminClient
      .from('discount_codes')
      .update(discount)
      .eq('id', params.id)
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

    console.error('Discount code update error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update discount code.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const { adminClient } = await requireAdminAccess();
    const { error } = await adminClient
      .from('discount_codes')
      .delete()
      .eq('id', params.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Discount code delete error:', error);
    return NextResponse.json({ error: 'Unable to delete discount code.' }, { status: 500 });
  }
}
