import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { formatOrderItemsText, sendRetailerEmail, sendTeamEmail } from '@/lib/email';

interface CreateOrderItemInput {
  productId: string;
  quantity: number;
}

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!adminUser) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { retailerId, items, deliveryDate, promotionCode } = await request.json();

    if (!retailerId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Invalid order payload' }, { status: 400 });
    }

    const adminClient = createSupabaseAdminClient();

    const productIds = (items as CreateOrderItemInput[]).map((item) => item.productId);
    const { data: products, error: productsError } = await adminClient
      .from('products')
      .select('id, name, size, price')
      .in('id', productIds);

    if (productsError || !products) {
      return NextResponse.json({ error: 'Failed to load products' }, { status: 500 });
    }

    const productMap = new Map(products.map((product) => [product.id, product]));

    const normalizedItems = (items as CreateOrderItemInput[]).map((item) => {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new Error('Invalid product selection');
      }
      return {
        product,
        quantity: Math.max(1, Number(item.quantity) || 1),
      };
    });

    const subtotal = normalizedItems.reduce(
      (sum, item) => sum + Number(item.product.price) * item.quantity,
      0
    );
    const total = subtotal;
    const orderNumber = `ORD-${Date.now().toString().slice(-8)}`;

    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .insert({
        order_number: orderNumber,
        retailer_id: retailerId,
        status: 'pending',
        delivery_date: deliveryDate || null,
        promotion_code: promotionCode || null,
        subtotal,
        total,
      })
      .select()
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
    }

    const orderItems = normalizedItems.map((item) => ({
      order_id: order.id,
      product_id: item.product.id,
      quantity: item.quantity,
      unit_price: item.product.price,
      total_price: Number(item.product.price) * item.quantity,
    }));

    const { error: itemsError } = await adminClient
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      console.error('Order items error:', itemsError);
    }

    const { data: retailer } = await adminClient
      .from('retailers')
      .select('company_name, business_address, phone')
      .eq('id', retailerId)
      .single();

    try {
      const { data: retailerUser } = await adminClient.auth.admin.getUserById(retailerId);
      const retailerEmail = retailerUser?.user?.email || 'Not provided';

      const itemsList = formatOrderItemsText(
        normalizedItems.map((item) => ({
          name: item.product.name,
          size: item.product.size,
          quantity: item.quantity,
          price: Number(item.product.price),
        }))
      );

      const emailText = `
New Wholesale Order Received!

Order Number: ${orderNumber}

Customer Information:
- Business Name: ${retailer?.company_name || 'Not provided'}
- Email: ${retailerEmail}
- Phone: ${retailer?.phone || 'Not provided'}
- Address: ${retailer?.business_address || 'Not provided'}

Order Details:
${itemsList}

Subtotal: $${subtotal.toFixed(2)}
Total: $${total.toFixed(2)}

${deliveryDate ? `Requested Delivery Date: ${deliveryDate}` : ''}
${promotionCode ? `Promotion Code: ${promotionCode}` : ''}

---
This order was placed through the Bare Naked Pet Co. Wholesale Portal.
      `.trim();

      await sendTeamEmail({
        subject: `New Wholesale Order: ${orderNumber}`,
        text: emailText,
      });

      if (retailerUser?.user?.email) {
        await sendRetailerEmail({
          to: retailerUser.user.email,
          subject: `Order Confirmation: ${orderNumber}`,
          text: `
Thank you for your order!

Your order ${orderNumber} has been received and is being processed.

Order Details:
${itemsList}

Total: $${total.toFixed(2)}

We'll notify you when your order ships.

Thank you for choosing Bare Naked Pet Co.!
          `.trim(),
        });
      }
    } catch (emailError) {
      console.error('Order email error:', emailError);
    }

    return NextResponse.json({ success: true, orderId: order.id, orderNumber });
  } catch (error) {
    console.error('Admin create order error:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
