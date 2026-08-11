import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { formatOrderItemsText, formatTeamOrderItemsText, sendRetailerEmail, sendTeamEmail } from '@/lib/email';
import { formatMarketingMaterialsLabel } from '@/lib/marketingMaterials';
import { formatShelfTalkerList, queueShelfTalkersForOrder } from '@/lib/shelfTalkers';
import { getOfferResolution } from '@/lib/offerResolver';
import { createOrderWithPromotions } from '@/lib/orderTransactions';

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

    const { retailerId, items, deliveryDate, promotionCode, locationId, includeSamples, orderSubmissionKey } = await request.json();

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

    const normalizedItems: Array<{ product: any; quantity: number }> = [];
    for (const item of items as CreateOrderItemInput[]) {
      const product = productMap.get(item.productId);
      if (!product) {
        return NextResponse.json({ error: 'Invalid product selection' }, { status: 400 });
      }
      normalizedItems.push({
        product,
        quantity: Math.max(1, Number(item.quantity) || 1),
      });
    }

    const subtotal = normalizedItems.reduce(
      (sum, item) => sum + Number(item.product.price) * item.quantity,
      0
    );

    const { data: retailerForOffer } = await adminClient
      .from('retailers')
      .select('id, created_at')
      .eq('id', retailerId)
      .single();

    const { count: activeOrderCount, error: orderCountError } = await adminClient
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('retailer_id', retailerId)
      .neq('status', 'canceled');

    if (orderCountError) {
      console.error('Admin launch offer order count error:', orderCountError);
    }

    const offerResolution = await getOfferResolution({
      adminClient,
      retailer: { id: retailerId, created_at: retailerForOffer?.created_at },
      activeOrderCount: activeOrderCount || 0,
      subtotal,
      promotionCode,
    });

    if (offerResolution.error) {
      return NextResponse.json({ error: offerResolution.error }, { status: 400 });
    }

    const welcomeOfferCandidate = offerResolution.candidates.find((benefit) => benefit.sourceType === 'welcome_offer');
    const promotionDiscount = offerResolution.totalDiscount;
    const total = Math.max(0, subtotal - promotionDiscount);
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const { data: sampleRequest } = await adminClient
      .from('sample_requests')
      .select('id')
      .eq('retailer_id', retailerId)
      .eq('status', 'pending')
      .single();

    const { data: marketingMaterialsRequest } = await adminClient
      .from('marketing_material_requests')
      .select('id, materials_type')
      .eq('retailer_id', retailerId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    let shipToLocation: { id: string; location_name: string; business_address: string; phone: string | null } | null = null;
    if (locationId) {
      const { data: location, error: locationError } = await adminClient
        .from('retailer_locations')
        .select('id, location_name, business_address, phone')
        .eq('id', locationId)
        .eq('retailer_id', retailerId)
        .single();

      if (locationError || !location) {
        return NextResponse.json({ error: 'Invalid ship-to location' }, { status: 400 });
      }

      shipToLocation = location;
    }

    const shouldIncludeSamples = Boolean(includeSamples) || Boolean(sampleRequest?.id) || Boolean(welcomeOfferCandidate);
    const shouldIncludeMarketingMaterials = Boolean(marketingMaterialsRequest?.id);
    const marketingMaterialsType = shouldIncludeMarketingMaterials
      ? marketingMaterialsRequest?.materials_type || 'both'
      : null;

    const transactionResult = await createOrderWithPromotions({
      adminClient,
      order: {
        orderNumber,
        retailerId,
        locationId: shipToLocation?.id ?? null,
        deliveryDate: deliveryDate || null,
        promotionCode: offerResolution.appliedBenefits.map((benefit) => benefit.code).filter(Boolean).join(', ') || promotionCode || null,
        subtotal,
        promotionDiscountApplied: promotionDiscount,
        includeSamples: shouldIncludeSamples,
        includeMarketingMaterials: shouldIncludeMarketingMaterials,
        marketingMaterialsType,
        orderSubmissionKey: typeof orderSubmissionKey === 'string' ? orderSubmissionKey : null,
      },
      items: normalizedItems.map((item) => ({
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

    if (transactionResult.duplicate) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        orderId: transactionResult.order_id,
        orderNumber: transactionResult.order_number,
        creditApplied,
        promotionDiscountApplied: Number(transactionResult.promotion_discount_applied || 0),
        total: finalTotal,
      });
    }

    let queuedShelfTalkers: Awaited<ReturnType<typeof queueShelfTalkersForOrder>> = [];
    try {
      queuedShelfTalkers = await queueShelfTalkersForOrder({
        adminClient,
        retailerId,
        locationId: shipToLocation?.id ?? null,
        orderId: order.id,
      });
    } catch (shelfTalkerError) {
      console.error('Shelf talker queue error:', shelfTalkerError);
    }

    if (sampleRequest?.id && shouldIncludeSamples) {
      const { error: sampleUpdateError } = await adminClient
        .from('sample_requests')
        .update({
          status: 'fulfilled',
          fulfilled_order_id: order.id,
          fulfilled_at: new Date().toISOString(),
        })
        .eq('id', sampleRequest.id);
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

      const teamItemsList = formatTeamOrderItemsText(
        normalizedItems.map((item) => ({
          name: item.product.name,
          size: item.product.size,
          quantity: item.quantity,
          price: Number(item.product.price),
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

      const shipToName = shipToLocation?.location_name || retailer?.company_name || 'Not provided';
      const shipToAddress = shipToLocation?.business_address || retailer?.business_address || 'Not provided';
      const shipToPhone = shipToLocation?.phone || retailer?.phone || 'Not provided';

      const creditSummary = creditApplied > 0
        ? `Promotion Discount: -$${promotionDiscount.toFixed(2)}
Account Credit Applied: -$${creditApplied.toFixed(2)}
Total: $${finalTotal.toFixed(2)}`
        : promotionDiscount > 0
          ? `Promotion Discount: -$${promotionDiscount.toFixed(2)}
Total: $${total.toFixed(2)}`
        : `Total: $${total.toFixed(2)}`;

      const emailText = `
New Wholesale Order Received!

Order Number: ${orderNumber}
${samplesNote}
${materialsNote}
${shelfTalkerTeamNote}

Customer Information:
- Business Name: ${retailer?.company_name || 'Not provided'}
- Email: ${retailerEmail}
- Phone: ${retailer?.phone || 'Not provided'}
- Address: ${retailer?.business_address || 'Not provided'}

Ship-To Location:
- Name: ${shipToName}
- Address: ${shipToAddress}
- Phone: ${shipToPhone}

Order Details:
${teamItemsList}

Subtotal: $${subtotal.toFixed(2)}
${creditSummary}

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

${retailerSamplesNote}
${retailerMaterialsNote}
${shelfTalkerRetailerNote}
Subtotal: $${subtotal.toFixed(2)}
${offerResolution.appliedBenefits.map((benefit) => `${benefit.name}${benefit.discountType === 'percent' ? ` (${benefit.discountValue}%)` : ''}: -$${benefit.amount.toFixed(2)}
`).join('')}${creditApplied > 0 ? `Account Credit Applied: -$${creditApplied.toFixed(2)}
` : ''}Total: $${finalTotal.toFixed(2)}

Ship-To Location:
- Name: ${shipToName}
- Address: ${shipToAddress}
- Phone: ${shipToPhone}

We'll notify you when your order ships.

Thank you for choosing Bare Naked Pet Co.!
          `.trim(),
        });
      }
    } catch (emailError) {
      console.error('Order email error:', emailError);
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: transactionResult.order_number,
      shelfTalkersAdded: queuedShelfTalkers.map((talker) => talker.flavor),
      creditApplied,
      promotionDiscountApplied: promotionDiscount,
      total: finalTotal,
    });
  } catch (error) {
    console.error('Admin create order error:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
