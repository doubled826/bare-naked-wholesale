import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { formatOrderItemsText, sendRetailerEmail, sendTeamEmail } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { items, deliveryDate, promotionCode } = await request.json();

    // Calculate totals
    const subtotal = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
    const total = subtotal; // Add tax/shipping logic if needed

    // Generate order number
    const orderNumber = `ORD-${Date.now().toString().slice(-8)}`;

    // Create the order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        retailer_id: user.id,
        status: 'pending',
        delivery_date: deliveryDate || null,
        promotion_code: promotionCode || null,
        subtotal,
        total,
      })
      .select()
      .single();

    if (orderError) {
      console.error('Order error:', orderError);
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
      console.error('Order items error:', itemsError);
    }

    // Get retailer info for email
    const { data: retailer } = await supabase
      .from('retailers')
      .select('company_name, business_address, phone')
      .eq('id', user.id)
      .single();

    // Send confirmation email
    try {
      const contactName = user.user_metadata?.display_name || 
                          user.user_metadata?.full_name || 
                          user.user_metadata?.name ||
                          'Valued Customer';

      const companyName = retailer?.company_name || 'Not provided';
      const businessAddress = retailer?.business_address || 'Not provided';
      const phone = retailer?.phone || 'Not provided';

      // Format order items for email
      const itemsList = formatOrderItemsText(
        items.map((item: any) => ({
          name: item.name,
          size: item.size,
          quantity: item.quantity,
          price: item.price,
        }))
      );

      const emailText = `
New Wholesale Order Received!

Order Number: ${orderNumber}

Customer Information:
- Business Name: ${companyName}
- Contact Name: ${contactName}
- Email: ${user.email}
- Phone: ${phone}
- Address: ${businessAddress}

Order Details:
${itemsList}

Subtotal: $${subtotal.toFixed(2)}
Total: $${total.toFixed(2)}

${deliveryDate ? `Requested Delivery Date: ${deliveryDate}` : ''}
${promotionCode ? `Promotion Code: ${promotionCode}` : ''}

---
This order was placed through the Bare Naked Pet Co. Wholesale Portal.
      `.trim();

      // Send to team
      await sendTeamEmail({
        subject: `New Wholesale Order: ${orderNumber}`,
        text: emailText,
      });

      // Send confirmation to customer
      if (user.email) {
        await sendRetailerEmail({
          to: user.email,
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
      console.error('Email error:', emailError);
      // Don't fail the order if email fails
    }

    return NextResponse.json({ 
      success: true, 
      orderNumber,
      orderId: order.id 
    });

  } catch (error) {
    console.error('Order error:', error);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          product:products (*)
        )
      `)
      .eq('retailer_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }

    return NextResponse.json({ orders });

  } catch (error) {
    console.error('Fetch orders error:', error);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}
