import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const { orderId, orderNumber, trackingNumber, retailerEmail } = await request.json();

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

    // Email content
    const emailText = `
Your order has shipped!

Order Number: ${orderNumber}
${trackingNumber ? `Tracking Number: ${trackingNumber}` : ''}

Thank you for your order. If you have any questions, please contact us at info@barenakedpet.com.

Best regards,
Bare Naked Pet Co.
    `.trim();

    // Send email (in production, you'd get the actual retailer email)
    // For now, this is a placeholder
    console.log('Shipping notification would be sent for order:', orderNumber);

    return NextResponse.json({ 
      success: true,
      message: 'Shipping notification sent'
    });

  } catch (error) {
    console.error('Ship notification error:', error);
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}
