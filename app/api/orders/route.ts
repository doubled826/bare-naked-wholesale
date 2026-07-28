import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { formatOrderItemsText, formatTeamOrderItemsText, sendRetailerEmail, sendTeamEmail } from '@/lib/email';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { applyRetailerCredits } from '@/lib/retailerCredits';
import { formatMarketingMaterialsLabel } from '@/lib/marketingMaterials';
import { formatShelfTalkerList, queueShelfTalkersForOrder } from '@/lib/shelfTalkers';
import {
  BARE_LAUNCH_OFFER_CODE,
  BARE_LAUNCH_OFFER_NAME,
  calculateBareLaunchOfferDiscount,
  getBareLaunchOfferStatus,
} from '@/lib/bareLaunchOffer';
import { findApplicableDiscount, recordDiscountRedemption } from '@/lib/discountCodes';

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { items, deliveryDate, promotionCode, locationId, includeSamples } = await request.json();

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

    const adminClient = createSupabaseAdminClient();

    // Calculate totals
    const subtotal = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
    const { data: retailerForOffer } = await supabase
      .from('retailers')
      .select('created_at')
      .eq('id', user.id)
      .single();

    const { count: activeOrderCount, error: orderCountError } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('retailer_id', user.id)
      .neq('status', 'canceled');

    if (orderCountError) {
      console.error('Launch offer order count error:', orderCountError);
    }

    const launchOfferStatus = getBareLaunchOfferStatus({
      accountCreatedAt: retailerForOffer?.created_at,
      activeOrderCount: activeOrderCount || 0,
    });
    const launchOfferDiscount = launchOfferStatus.eligible
      ? calculateBareLaunchOfferDiscount(subtotal)
      : 0;
    const discountResult = await findApplicableDiscount({
      adminClient,
      code: promotionCode,
      retailerId: user.id,
      subtotal,
    });

    if (discountResult.error) {
      return NextResponse.json({ error: discountResult.error }, { status: 400 });
    }

    const promotionDiscount = discountResult.amount;
    const totalDiscount = launchOfferDiscount + promotionDiscount;
    const total = Math.max(0, subtotal - totalDiscount); // Add tax/shipping logic if needed

    // Generate order number (avoid collisions with unique constraint)
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const { data: sampleRequest } = await supabase
      .from('sample_requests')
      .select('id')
      .eq('retailer_id', user.id)
      .eq('status', 'pending')
      .single();

    const { data: marketingMaterialsRequest } = await supabase
      .from('marketing_material_requests')
      .select('id, materials_type')
      .eq('retailer_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const shouldIncludeSamples = Boolean(includeSamples) || Boolean(sampleRequest?.id) || launchOfferDiscount > 0;
    const shouldIncludeMarketingMaterials = Boolean(marketingMaterialsRequest?.id);
    const marketingMaterialsType = shouldIncludeMarketingMaterials
      ? marketingMaterialsRequest?.materials_type || 'both'
      : null;
    const orderPromotionCode = [
      discountResult.discount?.code || promotionCode || null,
      launchOfferDiscount > 0 ? BARE_LAUNCH_OFFER_CODE : null,
    ].filter(Boolean).join(', ') || null;

    // Create the order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        retailer_id: user.id,
        location_id: shipToLocation?.id ?? null,
        status: 'pending',
        delivery_date: deliveryDate || null,
        promotion_code: orderPromotionCode,
        subtotal,
        total,
        include_samples: shouldIncludeSamples,
        include_marketing_materials: shouldIncludeMarketingMaterials,
        marketing_materials_type: marketingMaterialsType,
        credit_applied: totalDiscount,
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

    let queuedShelfTalkers: Awaited<ReturnType<typeof queueShelfTalkersForOrder>> = [];
    if (!itemsError) {
      try {
        queuedShelfTalkers = await queueShelfTalkersForOrder({
          adminClient,
          retailerId: user.id,
          locationId: shipToLocation?.id ?? null,
          orderId: order.id,
        });
      } catch (shelfTalkerError) {
        console.error('Shelf talker queue error:', shelfTalkerError);
      }
    }

    try {
      await recordDiscountRedemption({
        adminClient,
        discount: discountResult.discount,
        retailerId: user.id,
        orderId: order.id,
        discountAmount: promotionDiscount,
      });
    } catch (redemptionError) {
      console.error('Discount redemption tracking error:', redemptionError);
    }

    const creditResult = await applyRetailerCredits({
      adminClient,
      retailerId: user.id,
      orderId: order.id,
      subtotal,
      currentCreditApplied: totalDiscount,
      maxApplyAmount: Math.max(0, subtotal - totalDiscount),
    });

    if (sampleRequest?.id) {
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

    if (marketingMaterialsRequest?.id && shouldIncludeMarketingMaterials) {
      const { error: materialsUpdateError } = await adminClient
        .from('marketing_material_requests')
        .update({
          status: 'fulfilled',
          fulfilled_order_id: order.id,
          fulfilled_at: new Date().toISOString(),
        })
        .eq('id', marketingMaterialsRequest.id);
      if (materialsUpdateError) {
        console.error('Marketing materials request update error:', materialsUpdateError);
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
      const retailerSamplesNote = order.include_samples
        ? 'Samples Added: Yes\n'
        : '';
      const materialsLabel = order.include_marketing_materials
        ? formatMarketingMaterialsLabel(order.marketing_materials_type)
        : '';
      const materialsNote = order.include_marketing_materials
        ? `\nMarketing Materials: INCLUDE ${materialsLabel.toUpperCase()} (requested by retailer)\n`
        : '';
      const retailerMaterialsNote = order.include_marketing_materials
        ? `Marketing Materials Added: ${materialsLabel}\n`
        : '';
      const shelfTalkerLabel = formatShelfTalkerList(queuedShelfTalkers.map((talker) => talker.flavor));
      const shelfTalkerTeamNote = queuedShelfTalkers.length > 0
        ? `\nShelf Talkers: INCLUDE ${shelfTalkerLabel.toUpperCase()}\n`
        : '';
      const shelfTalkerRetailerNote = queuedShelfTalkers.length > 0
        ? `Shelf Talkers Added: ${shelfTalkerLabel}\n`
        : '';
      const launchOfferTeamNote = launchOfferDiscount > 0
        ? `\nWelcome Offer: CLAIMED
- 10% off your first order applied: $${launchOfferDiscount.toFixed(2)}
- Samples: INCLUDE SAMPLES
- Private promo support: FOLLOW UP WITH RETAILER\n`
        : '';
      const launchOfferRetailerNote = launchOfferDiscount > 0
        ? `${BARE_LAUNCH_OFFER_NAME}: -$${launchOfferDiscount.toFixed(2)}
Samples Added: Yes
Private Promo Support: Our team will follow up with next steps.
`
        : '';

      const creditSummary = creditResult.creditApplied > 0
        ? `Discounts/Credits Applied: -$${(totalDiscount + creditResult.creditApplied).toFixed(2)}
Total: $${creditResult.totalAfterCredit.toFixed(2)}`
        : totalDiscount > 0
          ? `Discounts/Credits Applied: -$${totalDiscount.toFixed(2)}
Total: $${total.toFixed(2)}`
          : `Total: $${total.toFixed(2)}`;

      const emailText = `
New Wholesale Order Received!

Order Number: ${orderNumber}
${samplesNote}
${materialsNote}
${shelfTalkerTeamNote}
${launchOfferTeamNote}

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
${creditSummary}

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

${retailerSamplesNote}
${retailerMaterialsNote}
${shelfTalkerRetailerNote}
${launchOfferRetailerNote}
Subtotal: $${subtotal.toFixed(2)}
${launchOfferDiscount > 0 ? `${BARE_LAUNCH_OFFER_NAME}: -$${launchOfferDiscount.toFixed(2)}
` : ''}${promotionDiscount > 0 ? `Promotion Discount (${discountResult.discount?.code || promotionCode}): -$${promotionDiscount.toFixed(2)}
` : ''}${creditResult.creditApplied > 0 ? `Account Credit Applied: -$${creditResult.creditApplied.toFixed(2)}
` : ''}Total: $${creditResult.totalAfterCredit.toFixed(2)}

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
      includeSamples: shouldIncludeSamples,
      includeMarketingMaterials: shouldIncludeMarketingMaterials,
      shelfTalkersAdded: queuedShelfTalkers.map((talker) => talker.flavor),
      creditApplied: creditResult.creditApplied,
      launchOfferDiscountApplied: launchOfferDiscount,
      promotionDiscountApplied: promotionDiscount,
      total: creditResult.totalAfterCredit,
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
