import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { items, deliveryDate, promotionCode } = await request.json();

    // Calculate totals
    const subtotal = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
    const total = subtotal; // Add tax/discount logic here if needed

    // Generate order number
    const orderNumber = `ORD-${Date.now().toString().slice(-8)}`;

    // Create the order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        retailer_id: user.id,
        status: 'pending',
        delivery_date: deliveryDate,
        promotion_code: promotionCode,
        subtotal: subtotal,
        total: total,
      })
      .select()
      .single();

    if (orderError) {
      console.error('Order creation error:', orderError);
      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
    }

    // Create order items
    const orderItems = items.map((item: any) => ({
      order_id: order.id,
      product_id: item.id,
      quantity: item.quantity,
      unit_price: item.price,
      total_price: item.price * item.quantity,
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      console.error('Order items creation error:', itemsError);
      return NextResponse.json({ error: 'Failed to create order items' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      orderNumber: order.order_number,
      message: 'Order created successfully!'
    });

  } catch (error) {
    console.error('Order error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
