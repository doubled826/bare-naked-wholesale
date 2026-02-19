import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { formatOrderItemsText, formatTeamOrderItemsText, sendRetailerEmail, sendTeamEmail } from '@/lib/email';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { items, deliveryDate, promotionCode, locationId } = await request.json();

    let shipToLocation: { id: string; location_name: string; business_address: string; phone: string | null } | null = null;
    if (locationId) {
      const { data: location, error: locationError } = await supabase
        .from('retailer_locations')
        .select('id, location_name, business_address, phone')
        .eq('id', locationId)
        .eq('retailer_id', user.id)
        .single();

      if (locationError || !location) {
        return NextResponse.json({ error: 'Invalid ship-to location' }, { status: 400 });
      }

      shipToLocation = location;
    }

    // Calculate totals
    const subtotal = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
    const total = subtotal; // Add tax/shipping logic if needed

    // Generate order number (avoid collisions with unique constraint)
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const { data: sampleRequest } = await supabase
      .from('sample_requests')
      .select('id')
      .eq('retailer_id', user.id)
      .eq('status', 'pending')
      .single();

    // Create the order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        retailer_id: user.id,
        location_id: shipToLocation?.id ?? null,
        status: 'pending',
        delivery_date: deliveryDate || null,
        promotion_code: promotionCode || null,
        subtotal,
        total,
        include_samples: !!sampleRequest?.id,
      })
      .select()
      .single();

    if (orderError) {
      console.error('Order error:', orderError);
      return NextResponse.json(
        {
          error: 'Failed to create order',
          details: orderError.message,
          code: orderError.code,
          hint: orderError.hint,
        },
        { status: 500 }
      );
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

    if (sampleRequest?.id) {
      const adminClient = createSupabaseAdminClient();
      const { error: sampleUpdateError } = await adminClient
        .from('sample_requests')
        .update({
          status: 'fulfilled',
          fulfilled_order_id: order.id,
          fulfilled_at: new Date().toISOString(),
        })
        .eq('retailer_id', user.id)
        .eq('status', 'pending');
      if (sampleUpdateError) {
        console.error('Sample request update error:', sampleUpdateError);
      }
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
    const shipToName = shipToLocation?.location_name || companyName;
    const shipToAddress = shipToLocation?.business_address || businessAddress;
    const shipToPhone = shipToLocation?.phone || phone;

      // Format order items for email
      const itemsList = formatOrderItemsText(
        items.map((item: any) => ({
          name: item.name,
          size: item.size,
          quantity: item.quantity,
          price: item.price,
        }))
      );

      const teamItemsList = formatTeamOrderItemsText(
        items.map((item: any) => ({
          name: item.name,
          size: item.size,
          quantity: item.quantity,
          price: item.price,
        }))
      );

      const samplesNote = order.include_samples
        ? '\nSamples: INCLUDE SAMPLES (requested by retailer)\n'
        : '';

      const emailText = `
New Wholesale Order Received!

Order Number: ${orderNumber}
${samplesNote}

Customer Information:
- Business Name: ${companyName}
- Contact Name: ${contactName}
- Email: ${user.email}
- Phone: ${phone}
- Address: ${businessAddress}

Ship-To Location:
- Name: ${shipToName}
- Address: ${shipToAddress}
- Phone: ${shipToPhone || 'Not provided'}

Order Details:
${teamItemsList}

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

Ship-To Location:
- Name: ${shipToName}
- Address: ${shipToAddress}
- Phone: ${shipToPhone || 'Not provided'}

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
      orderId: order.id,
      includeSamples: !!sampleRequest?.id,
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
        location:retailer_locations(id, location_name, business_address, phone),
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
