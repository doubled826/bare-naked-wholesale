import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const { items, deliveryDate, promotionCode } = await request.json();

    // Get retailer info
    const { data: retailer, error: retailerError } = await supabase
      .from('retailers')
      .select('*')
      .eq('id', user.id)
      .single();

    if (retailerError) {
      return NextResponse.json({ error: 'Retailer not found' }, { status: 404 });
    }

    // Calculate totals
    const subtotal = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
    const total = subtotal; // No additional fees for now

    // Generate order number
    const { data: orderNumberData } = await supabase.rpc('generate_order_number');
    const orderNumber = orderNumberData || `ORD-${Date.now()}`;

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        retailer_id: user.id,
        status: 'pending',
        delivery_date: deliveryDate || null,
        promotion_code: promotionCode || null,
        subtotal,
        total
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
      total_price: item.price * item.quantity
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      console.error('Order items error:', itemsError);
      return NextResponse.json({ error: 'Failed to create order items' }, { status: 500 });
    }

    // Send email notifications
    await sendOrderEmails(order, orderItems, retailer, items);

    return NextResponse.json({ 
      success: true, 
      orderNumber: order.order_number,
      orderId: order.id 
    });

  } catch (error) {
    console.error('Order submission error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function sendOrderEmails(order: any, orderItems: any[], retailer: any, products: any[]) {
  // Configure email transporter
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  // Build order details for email
  const orderDetailsText = products.map((product: any) => {
    const item = orderItems.find(i => i.product_id === product.id);
    return `${product.size} ${product.name}: ${item?.quantity || 0}`;
  }).filter(line => !line.endsWith(': 0')).join('\n');

  // Email to info@barenakedpet.com (internal notification)
  const internalEmailText = `
You received a new wholesale order.

Country Code: US

Subject: Wholesale Order Form

Business Name: ${retailer.business_name}

Business Address: ${retailer.business_address}

Name: ${retailer.business_name}

Email: ${retailer.email || 'Not provided'}

Phone: ${retailer.phone}

Requested Delivery Date: ${order.delivery_date || 'Not specified'}

${orderDetailsText}

Promotion Code: ${order.promotion_code || ''}

Order Number: ${order.order_number}
Total: $${order.total.toFixed(2)}
  `.trim();

  try {
    // Send to info@barenakedpet.com
    await transporter.sendMail({
      from: `"Bare Naked Pet Co." <${process.env.SMTP_USER}>`,
      to: process.env.ORDER_EMAIL_TO,
      subject: 'New Wholesale Order',
      text: internalEmailText,
    });

    // Send confirmation to customer
    await transporter.sendMail({
      from: `"Bare Naked Pet Co." <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: `Order Confirmation - ${order.order_number}`,
      text: `
Thank you for your order!

Order Number: ${order.order_number}
Order Date: ${new Date().toLocaleDateString()}

Order Details:
${orderDetailsText}

Requested Delivery: ${order.delivery_date || 'Not specified'}

Total: $${order.total.toFixed(2)}

We'll send you an invoice within 24 hours.

Questions? Reply to this email or contact us at info@barenakedpet.com

Thank you,
Bare Naked Pet Co.
      `.trim(),
    });

    console.log('Order emails sent successfully');
  } catch (error) {
    console.error('Failed to send order emails:', error);
    // Don't fail the order if email fails
  }
}
