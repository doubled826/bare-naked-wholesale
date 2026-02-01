import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// Create email transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Format currency helper
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

// Generate order confirmation email HTML
const generateOrderEmailHTML = (
  orderNumber: string,
  items: any[],
  subtotal: number,
  total: number,
  businessName: string,
  deliveryDate?: string
) => {
  const itemsHTML = items
    .map(
      (item) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e5e5;">
          ${item.name} (${item.size})
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e5e5; text-align: center;">
          ${item.quantity}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e5e5; text-align: right;">
          ${formatCurrency(item.price * item.quantity)}
        </td>
      </tr>
    `
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #3d2314; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Bare Naked Pet Co.</h1>
        <p style="color: #ffffff; opacity: 0.8; margin: 5px 0 0 0;">Wholesale Order Confirmation</p>
      </div>
      
      <div style="background-color: #f9f6f1; padding: 30px; border-radius: 0 0 8px 8px;">
        <h2 style="color: #3d2314; margin-top: 0;">Thank you for your order!</h2>
        
        <p>Hi ${businessName},</p>
        
        <p>We've received your wholesale order and it's being processed. Here are your order details:</p>
        
        <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Order Number:</strong> ${orderNumber}</p>
          ${deliveryDate ? `<p style="margin: 0;"><strong>Requested Delivery:</strong> ${new Date(deliveryDate).toLocaleDateString()}</p>` : ''}
        </div>
        
        <table style="width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background-color: #3d2314; color: #ffffff;">
              <th style="padding: 12px; text-align: left;">Product</th>
              <th style="padding: 12px; text-align: center;">Qty</th>
              <th style="padding: 12px; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2" style="padding: 12px; text-align: right;"><strong>Subtotal:</strong></td>
              <td style="padding: 12px; text-align: right;">${formatCurrency(subtotal)}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding: 12px; text-align: right;"><strong>Shipping:</strong></td>
              <td style="padding: 12px; text-align: right;">FREE</td>
            </tr>
            <tr style="background-color: #f0ebe4;">
              <td colspan="2" style="padding: 12px; text-align: right;"><strong>Total:</strong></td>
              <td style="padding: 12px; text-align: right;"><strong>${formatCurrency(total)}</strong></td>
            </tr>
          </tfoot>
        </table>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5;">
          <p style="margin: 0; color: #666;">Questions about your order? Contact us at <a href="mailto:info@barenakedpet.com" style="color: #3d2314;">info@barenakedpet.com</a></p>
        </div>
      </div>
      
      <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
        <p>© ${new Date().getFullYear()} Bare Naked Pet Co. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
};

// Generate internal notification email HTML
const generateInternalEmailHTML = (
  orderNumber: string,
  items: any[],
  subtotal: number,
  total: number,
  businessName: string,
  customerEmail: string,
  deliveryDate?: string
) => {
  const itemsList = items
    .map((item) => `• ${item.name} (${item.size}) x ${item.quantity} = ${formatCurrency(item.price * item.quantity)}`)
    .join('\n');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #22c55e; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">🎉 New Wholesale Order!</h1>
      </div>
      
      <div style="background-color: #f0fdf4; padding: 30px; border-radius: 0 0 8px 8px;">
        <h2 style="color: #166534; margin-top: 0;">Order ${orderNumber}</h2>
        
        <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Customer:</strong> ${businessName}</p>
          <p style="margin: 0 0 10px 0;"><strong>Email:</strong> ${customerEmail}</p>
          ${deliveryDate ? `<p style="margin: 0;"><strong>Requested Delivery:</strong> ${new Date(deliveryDate).toLocaleDateString()}</p>` : ''}
        </div>
        
        <div style="background-color: #ffffff; padding: 20px; border-radius: 8px;">
          <h3 style="margin-top: 0; color: #166534;">Order Items:</h3>
          <pre style="white-space: pre-wrap; font-family: Arial, sans-serif;">${itemsList}</pre>
          <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 15px 0;">
          <p style="margin: 5px 0;"><strong>Subtotal:</strong> ${formatCurrency(subtotal)}</p>
          <p style="margin: 5px 0;"><strong>Shipping:</strong> FREE</p>
          <p style="margin: 5px 0; font-size: 18px;"><strong>Total: ${formatCurrency(total)}</strong></p>
        </div>
      </div>
    </body>
    </html>
  `;
};

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { items, deliveryDate, promotionCode } = await request.json();

    // Get retailer info for email
    const { data: retailer } = await supabase
      .from('retailers')
      .select('*')
      .eq('id', user.id)
      .single();

    const businessName = retailer?.company_name || retailer?.business_name || 'Valued Customer';
    const customerEmail = user.email || '';

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

    // Send confirmation emails
    try {
      // Email to customer
      await transporter.sendMail({
        from: `"Bare Naked Pet Co." <${process.env.SMTP_USER}>`,
        to: customerEmail,
        subject: `Order Confirmation - ${orderNumber}`,
        html: generateOrderEmailHTML(orderNumber, items, subtotal, total, businessName, deliveryDate),
      });

      // Email to Bare Naked Pet Co.
      await transporter.sendMail({
        from: `"Wholesale Portal" <${process.env.SMTP_USER}>`,
        to: 'info@barenakedpet.com',
        subject: `🎉 New Wholesale Order - ${orderNumber} from ${businessName}`,
        html: generateInternalEmailHTML(orderNumber, items, subtotal, total, businessName, customerEmail, deliveryDate),
      });

      console.log('Order confirmation emails sent successfully');
    } catch (emailError) {
      // Log email error but don't fail the order
      console.error('Email sending error:', emailError);
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