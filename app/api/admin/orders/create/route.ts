import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { formatOrderItemsText, formatTeamOrderItemsText, sendRetailerEmail, sendTeamEmail } from '@/lib/email';
import { applyRetailerCredits } from '@/lib/retailerCredits';
import { formatMarketingMaterialsLabel } from '@/lib/marketingMaterials';
import { formatShelfTalkerList, queueShelfTalkersForOrder } from '@/lib/shelfTalkers';
import { findApplicableDiscount, recordDiscountRedemption } from '@/lib/discountCodes';

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

    const { retailerId, items, deliveryDate, promotionCode, locationId, includeSamples } = await request.json();

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
    const discountResult = await findApplicableDiscount({
      adminClient,
      code: promotionCode,
      retailerId,
      subtotal,
    });

    if (discountResult.error) {
      return NextResponse.json({ error: discountResult.error }, { status: 400 });
    }

    const promotionDiscount = discountResult.amount;
    const total = Math.max(0, subtotal - promotionDiscount);
    const orderNumber = `ORD-${Date.now().toString().slice(-8)}`;

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

    const shouldIncludeSamples = Boolean(includeSamples) || Boolean(sampleRequest?.id);
    const shouldIncludeMarketingMaterials = Boolean(marketingMaterialsRequest?.id);
    const marketingMaterialsType = shouldIncludeMarketingMaterials
      ? marketingMaterialsRequest?.materials_type || 'both'
      : null;

    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .insert({
        order_number: orderNumber,
        retailer_id: retailerId,
        location_id: shipToLocation?.id ?? null,
        status: 'pending',
        delivery_date: deliveryDate || null,
        promotion_code: discountResult.discount?.code || promotionCode || null,
        subtotal,
        total,
        include_samples: shouldIncludeSamples,
        include_marketing_materials: shouldIncludeMarketingMaterials,
        marketing_materials_type: marketingMaterialsType,
        credit_applied: promotionDiscount,
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

    let queuedShelfTalkers: Awaited<ReturnType<typeof queueShelfTalkersForOrder>> = [];
    if (!itemsError) {
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
    }

    try {
      await recordDiscountRedemption({
        adminClient,
        discount: discountResult.discount,
        retailerId,
        orderId: order.id,
        discountAmount: promotionDiscount,
      });
    } catch (redemptionError) {
      console.error('Discount redemption tracking error:', redemptionError);
    }

    const creditResult = await applyRetailerCredits({
      adminClient,
      retailerId,
      orderId: order.id,
      subtotal,
      currentCreditApplied: promotionDiscount,
      maxApplyAmount: Math.max(0, subtotal - promotionDiscount),
    });

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

      const creditSummary = creditResult.creditApplied > 0
        ? `Discounts/Credits Applied: -$${(promotionDiscount + creditResult.creditApplied).toFixed(2)}
Total: $${creditResult.totalAfterCredit.toFixed(2)}`
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
${promotionDiscount > 0 ? `Promotion Discount (${discountResult.discount?.code || promotionCode}): -$${promotionDiscount.toFixed(2)}
` : ''}${creditResult.creditApplied > 0 ? `Account Credit Applied: -$${creditResult.creditApplied.toFixed(2)}
` : ''}Total: $${creditResult.totalAfterCredit.toFixed(2)}

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
      orderNumber,
      shelfTalkersAdded: queuedShelfTalkers.map((talker) => talker.flavor),
      creditApplied: creditResult.creditApplied,
      promotionDiscountApplied: promotionDiscount,
      total: creditResult.totalAfterCredit,
    });
  } catch (error) {
    console.error('Admin create order error:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
