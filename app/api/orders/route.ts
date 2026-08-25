import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { formatOrderItemsText, formatTeamOrderItemsText, sendRetailerEmail, sendTeamEmail } from '@/lib/email';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { formatMarketingMaterialsLabel } from '@/lib/marketingMaterials';
import { formatShelfTalkerList, queueShelfTalkersForOrder } from '@/lib/shelfTalkers';
import { BARE_LAUNCH_OFFER_CODE, BARE_LAUNCH_OFFER_NAME } from '@/lib/bareLaunchOffer';
import { getOfferResolution, toPublicOfferBenefit } from '@/lib/offerResolver';
import { createOrderWithPromotions } from '@/lib/orderTransactions';
import { sendWholesalePurchaseEventForRetailer } from '@/lib/metaConversions';
import { setPrivatePromoDatesNeeded } from '@/lib/privateLaunchPromo';

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { items, deliveryDate, promotionCode, locationId, includeSamples, orderSubmissionKey } = await request.json();

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Your cart is empty.' }, { status: 400 });
    }

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

    const productIds = items.map((item: any) => item.id).filter(Boolean);
    const { data: products, error: productsError } = await adminClient
      .from('products')
      .select('id, name, size, price')
      .in('id', productIds);

    if (productsError || !products) {
      return NextResponse.json({ error: 'Unable to validate cart items.' }, { status: 500 });
    }

    const productMap = new Map(products.map((product: any) => [product.id, product]));
    const normalizedItems: Array<{ product: any; quantity: number }> = [];
    for (const item of items) {
      const product = productMap.get(item.id);
      if (!product) {
        return NextResponse.json({ error: 'One or more cart items are no longer available.' }, { status: 400 });
      }
      const quantity = Math.max(1, Number(item.quantity) || 1);
      normalizedItems.push({ product, quantity });
    }

    const subtotal = normalizedItems.reduce((sum: number, item: any) => sum + (Number(item.product.price || 0) * item.quantity), 0);
    const { data: retailerForOffer } = await supabase
      .from('retailers')
      .select('id, created_at')
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

    const offerResolution = await getOfferResolution({
      adminClient,
      retailer: { id: user.id, created_at: retailerForOffer?.created_at },
      activeOrderCount: activeOrderCount || 0,
      subtotal,
      promotionCode,
    });

    if (offerResolution.error) {
      return NextResponse.json({ error: offerResolution.error }, { status: 400 });
    }

    const appliedDiscountCodeBenefits = offerResolution.appliedBenefits.filter((benefit) => benefit.sourceType === 'discount_code');
    const launchOfferBenefit = offerResolution.appliedBenefits.find((benefit) => benefit.sourceType === 'welcome_offer');
    const welcomeOfferCandidate = offerResolution.candidates.find((benefit) => benefit.sourceType === 'welcome_offer');
    const promotionDiscount = offerResolution.totalDiscount;
    const launchOfferDiscount = launchOfferBenefit?.amount || 0;
    const totalDiscount = offerResolution.totalDiscount;
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

    const shouldIncludeSamples = Boolean(includeSamples) || Boolean(sampleRequest?.id) || Boolean(welcomeOfferCandidate);
    const shouldIncludeMarketingMaterials = Boolean(marketingMaterialsRequest?.id);
    const marketingMaterialsType = shouldIncludeMarketingMaterials
      ? marketingMaterialsRequest?.materials_type || 'both'
      : null;
    const orderPromotionCode = [
      ...appliedDiscountCodeBenefits.map((benefit) => benefit.code || null),
      launchOfferDiscount > 0 ? BARE_LAUNCH_OFFER_CODE : null,
    ].filter(Boolean).join(', ') || null;

    const transactionResult = await createOrderWithPromotions({
      adminClient,
      order: {
        orderNumber,
        retailerId: user.id,
        locationId: shipToLocation?.id ?? null,
        deliveryDate: deliveryDate || null,
        promotionCode: orderPromotionCode,
        subtotal,
        promotionDiscountApplied: totalDiscount,
        includeSamples: shouldIncludeSamples,
        includeMarketingMaterials: shouldIncludeMarketingMaterials,
        marketingMaterialsType,
        orderSubmissionKey: typeof orderSubmissionKey === 'string' ? orderSubmissionKey : null,
      },
      items: normalizedItems.map((item: any) => ({
        productId: item.product.id,
        quantity: item.quantity,
        unitPrice: Number(item.product.price || 0),
      })),
      appliedBenefits: offerResolution.appliedBenefits,
    });

    const order = {
      id: transactionResult.order_id,
      order_number: transactionResult.order_number,
      include_samples: shouldIncludeSamples,
      include_marketing_materials: shouldIncludeMarketingMaterials,
      marketing_materials_type: marketingMaterialsType,
    };
    const creditApplied = Number(transactionResult.credit_applied || 0);
    const finalTotal = Number(transactionResult.total || 0);

    await sendWholesalePurchaseEventForRetailer(adminClient, {
      retailerId: user.id,
      retailerEmail: user.email,
      orderId: order.id,
    }).catch((metaError) => {
      console.error('Meta purchase event send error:', metaError);
    });

    if (transactionResult.duplicate) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        orderNumber: transactionResult.order_number,
        orderId: transactionResult.order_id,
        includeSamples: shouldIncludeSamples,
        includeMarketingMaterials: shouldIncludeMarketingMaterials,
        creditApplied,
        launchOfferDiscountApplied: launchOfferDiscount,
        needsPrivatePromoScheduling: false,
        promotionDiscountApplied: promotionDiscount,
        appliedBenefits: offerResolution.appliedBenefits.map(toPublicOfferBenefit),
        enteredCodeStatus: offerResolution.enteredCodeStatus,
        enteredCodeMessage: offerResolution.enteredCodeMessage,
        total: finalTotal,
      });
    }

    let queuedShelfTalkers: Awaited<ReturnType<typeof queueShelfTalkersForOrder>> = [];
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

    let needsPrivatePromoScheduling = false;
    if (launchOfferDiscount > 0) {
      try {
        await setPrivatePromoDatesNeeded({
          adminClient,
          retailerId: user.id,
          source: 'welcome_offer',
        });
        needsPrivatePromoScheduling = true;
      } catch (promoError) {
        console.error('Private launch promo setup error:', promoError);
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
        normalizedItems.map((item: any) => ({
          name: item.product.name,
          size: item.product.size,
          quantity: item.quantity,
          price: Number(item.product.price || 0),
        }))
      );

      const teamItemsList = formatTeamOrderItemsText(
        normalizedItems.map((item: any) => ({
          name: item.product.name,
          size: item.product.size,
          quantity: item.quantity,
          price: Number(item.product.price || 0),
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
- First-order discount applied: $${launchOfferDiscount.toFixed(2)}
- Samples: INCLUDE SAMPLES
- Private promo support: FOLLOW UP WITH RETAILER\n`
        : '';
      const launchOfferRetailerNote = launchOfferDiscount > 0
        ? `Samples Added: Yes
Private Promo Support: Choose your dates in the portal. During the promo, mark Bare down 10%; after it ends, email us a POS sales screenshot or summary.
`
        : '';

      const creditSummary = creditApplied > 0
        ? `Promotion Discount: -$${totalDiscount.toFixed(2)}
Account Credit Applied: -$${creditApplied.toFixed(2)}
Total: $${finalTotal.toFixed(2)}`
        : totalDiscount > 0
          ? `Promotion Discount: -$${totalDiscount.toFixed(2)}
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
` : ''}${offerResolution.appliedBenefits.map((benefit) => `${benefit.name}${benefit.discountType === 'percent' ? ` (${benefit.discountValue}%)` : ` ($${benefit.discountValue} off)`}: -$${benefit.amount.toFixed(2)}
`).join('')}${creditApplied > 0 ? `Account Credit Applied: -$${creditApplied.toFixed(2)}
` : ''}Total: $${finalTotal.toFixed(2)}

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
      creditApplied,
      launchOfferDiscountApplied: launchOfferDiscount,
      needsPrivatePromoScheduling,
      promotionDiscountApplied: promotionDiscount,
      appliedBenefits: offerResolution.appliedBenefits.map(toPublicOfferBenefit),
      enteredCodeStatus: offerResolution.enteredCodeStatus,
      enteredCodeMessage: offerResolution.enteredCodeMessage,
      total: finalTotal,
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
