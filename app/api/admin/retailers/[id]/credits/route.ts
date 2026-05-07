import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

interface CreditItemInput {
  productId: string;
  quantity: number;
}

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

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const adminCheck = await requireAdmin();
  if ('error' in adminCheck) {
    return adminCheck.error;
  }

  const retailerId = params.id;
  const adminClient = createSupabaseAdminClient();

  const { data: credits, error } = await adminClient
    .from('retailer_credits')
    .select(`
      id,
      reason,
      notes,
      status,
      total_amount,
      remaining_amount,
      created_at,
      items:retailer_credit_items(
        id,
        product_id,
        product_name,
        product_size,
        quantity,
        unit_price,
        total_amount
      ),
      applications:retailer_credit_applications(
        id,
        applied_amount,
        created_at,
        order:orders(
          id,
          order_number,
          created_at
        )
      )
    `)
    .eq('retailer_id', retailerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Retailer credits load error:', error);
    return NextResponse.json({ error: 'Failed to load credits' }, { status: 500 });
  }

  const availableBalance = (credits || []).reduce(
    (sum: number, credit: { remaining_amount: number | string; status: string }) =>
      credit.status === 'voided' ? sum : sum + Number(credit.remaining_amount || 0),
    0
  );

  return NextResponse.json({
    success: true,
    availableBalance,
    credits: credits || [],
  });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const adminCheck = await requireAdmin();
  if ('error' in adminCheck) {
    return adminCheck.error;
  }

  const retailerId = params.id;
  const { user } = adminCheck;
  const adminClient = createSupabaseAdminClient();

  try {
    const { reason, notes, items, customAmount } = await request.json();

    const normalizedCustomAmount = Number(customAmount || 0);
    const hasCustomAmount = normalizedCustomAmount > 0;

    if (!retailerId) {
      return NextResponse.json({ error: 'Retailer is required.' }, { status: 400 });
    }

    const normalizedItems = (items as CreditItemInput[])
      .map((item) => ({
        productId: item.productId,
        quantity: Math.max(0, Number(item.quantity) || 0),
      }))
      .filter((item) => item.productId && item.quantity > 0);

    if (!hasCustomAmount && normalizedItems.length === 0) {
      return NextResponse.json({ error: 'Enter a custom amount or select at least one valid credited SKU.' }, { status: 400 });
    }

    let creditItems: Array<{
      product_id: string | null;
      product_name: string;
      product_size: string | null;
      quantity: number;
      unit_price: number;
      total_amount: number;
    }> = [];

    if (hasCustomAmount) {
      creditItems = [
        {
          product_id: null,
          product_name: 'Custom Credit',
          product_size: null,
          quantity: 1,
          unit_price: normalizedCustomAmount,
          total_amount: normalizedCustomAmount,
        },
      ];
    } else {
      const productIds = normalizedItems.map((item) => item.productId);
      const { data: products, error: productsError } = await adminClient
        .from('products')
        .select('id, name, size, price')
        .in('id', productIds);

      if (productsError || !products) {
        return NextResponse.json({ error: 'Failed to load credited products.' }, { status: 500 });
      }

      const productMap = new Map(products.map((product) => [product.id, product]));
      creditItems = normalizedItems.map((item) => {
        const product = productMap.get(item.productId);
        if (!product) {
          throw new Error('One or more credited products are invalid.');
        }

        const unitPrice = Number(product.price);
        const totalAmount = unitPrice * item.quantity;

        return {
          product_id: product.id,
          product_name: product.name,
          product_size: product.size,
          quantity: item.quantity,
          unit_price: unitPrice,
          total_amount: totalAmount,
        };
      });
    }

    const totalAmount = creditItems.reduce((sum, item) => sum + item.total_amount, 0);
    if (totalAmount <= 0) {
      return NextResponse.json({ error: 'Credit total must be greater than zero.' }, { status: 400 });
    }

    const { data: credit, error: creditError } = await adminClient
      .from('retailer_credits')
      .insert({
        retailer_id: retailerId,
        reason: reason?.trim() || 'Return credit',
        notes: notes?.trim() || null,
        total_amount: totalAmount,
        remaining_amount: totalAmount,
        created_by: user.id,
      })
      .select('id')
      .single();

    if (creditError || !credit) {
      console.error('Retailer credit create error:', creditError);
      return NextResponse.json({ error: 'Failed to create credit.' }, { status: 500 });
    }

    const { error: itemsError } = await adminClient
      .from('retailer_credit_items')
      .insert(
        creditItems.map((item) => ({
          ...item,
          credit_id: credit.id,
        }))
      );

    if (itemsError) {
      console.error('Retailer credit item create error:', itemsError);
      await adminClient.from('retailer_credits').delete().eq('id', credit.id);
      return NextResponse.json({ error: 'Failed to create credit items.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, creditId: credit.id });
  } catch (error) {
    console.error('Retailer credit create error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create credit.' }, { status: 500 });
  }
}
