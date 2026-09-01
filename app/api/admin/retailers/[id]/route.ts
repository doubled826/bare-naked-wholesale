import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';
import { isValidEmail } from '@/lib/utils';

type RouteContext = {
  params: {
    id: string;
  };
};

const ORDERS_SELECT_WITH_SHELF_TALKERS = 'id, order_number, status, total, subtotal, promotion_discount_applied, credit_applied, include_samples, include_marketing_materials, marketing_materials_type, created_at, order_items(id, quantity, total_price, product_id, product:products(name, size, category)), shelf_talker_fulfillments(id, retailer_id, location_id, flavor, status, fulfilled_order_id, qualified_at, fulfilled_at)';
const ORDERS_SELECT = 'id, order_number, status, total, subtotal, promotion_discount_applied, credit_applied, include_samples, include_marketing_materials, marketing_materials_type, created_at, order_items(id, quantity, total_price, product_id, product:products(name, size, category))';

function isMissingOptionalRelationError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const message = error.message || '';
  return (
    error.code === 'PGRST205' ||
    error.code === 'PGRST200' ||
    error.code === '42P01' ||
    message.includes('shelf_talker_fulfillments')
  );
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { adminClient } = await requireAdminAccess();
    const retailerId = params.id;

    if (!retailerId) {
      return NextResponse.json({ error: 'Missing retailerId' }, { status: 400 });
    }

    const { data: retailer, error: retailerError } = await adminClient
      .from('retailers')
      .select('id, company_name, business_address, phone, account_number, status, created_at')
      .eq('id', retailerId)
      .single();

    if (retailerError || !retailer) {
      return NextResponse.json({ error: 'Retailer not found' }, { status: 404 });
    }

    const [
      onboardingResult,
      retailerUserResult,
      ordersResult,
      locationsResult,
      successProfileResult,
      currentPromoResult,
      shelfTalkerResult,
      sourceResult,
    ] = await Promise.all([
      adminClient
        .from('retailer_onboarding')
        .select('pipedrive_deal_id, pipedrive_stage_name')
        .eq('retailer_id', retailerId)
        .maybeSingle(),
      adminClient.auth.admin.getUserById(retailerId),
      adminClient
        .from('orders')
        .select(ORDERS_SELECT_WITH_SHELF_TALKERS)
        .eq('retailer_id', retailerId)
        .order('created_at', { ascending: false }),
      adminClient
        .from('retailer_locations')
        .select('id, location_name, business_address, phone, is_default, is_public, public_display_name, public_address, public_phone, website_url, instagram_url, latitude, longitude, public_hours, public_notes, locator_updated_at, locator_verified_at, geocoded_at, geocoding_error, google_place_id, google_place_url, google_place_autofilled_at, google_place_match_confidence, google_place_matched_at, google_place_match_error, created_at')
        .eq('retailer_id', retailerId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true }),
      adminClient
        .from('retailer_success_profiles')
        .select('*')
        .eq('retailer_id', retailerId)
        .maybeSingle(),
      adminClient
        .from('retailer_success_promo_settings')
        .select('*')
        .eq('id', 'current')
        .maybeSingle(),
      adminClient
        .from('shelf_talker_fulfillments')
        .select('*')
        .eq('retailer_id', retailerId)
        .order('created_at', { ascending: false }),
      adminClient
        .from('retailers')
        .select('how_heard_about_us, how_heard_about_us_other')
        .eq('id', retailerId)
        .maybeSingle(),
    ]);

    let orders = ordersResult.data || [];
    if (ordersResult.error) {
      if (!isMissingOptionalRelationError(ordersResult.error)) {
        console.warn(`Retailer ${retailerId} orders failed to load:`, ordersResult.error);
      } else {
        const fallbackOrdersResult = await adminClient
          .from('orders')
          .select(ORDERS_SELECT)
          .eq('retailer_id', retailerId)
          .order('created_at', { ascending: false });

        if (fallbackOrdersResult.error) {
          console.warn(`Retailer ${retailerId} fallback orders failed to load:`, fallbackOrdersResult.error);
        } else {
          orders = (fallbackOrdersResult.data || []).map((order) => ({
            ...order,
            shelf_talker_fulfillments: [],
          }));
        }
      }
    }

    if (locationsResult.error) {
      console.warn(`Retailer ${retailerId} locations failed to load:`, locationsResult.error);
    }

    if (successProfileResult.error) {
      console.warn(`Retailer ${retailerId} success profile failed to load:`, successProfileResult.error);
    }

    if (currentPromoResult.error) {
      console.warn(`Retailer ${retailerId} current promo failed to load:`, currentPromoResult.error);
    }

    if (onboardingResult.error) {
      console.warn(`Retailer ${retailerId} onboarding failed to load:`, onboardingResult.error);
    }

    if (sourceResult.error) {
      console.warn(`Retailer ${retailerId} source fields failed to load:`, sourceResult.error);
    }

    if (shelfTalkerResult.error && !isMissingOptionalRelationError(shelfTalkerResult.error)) {
      console.warn(`Retailer ${retailerId} shelf talkers failed to load:`, shelfTalkerResult.error);
    }

    if (retailerUserResult.error || !retailerUserResult.data?.user) {
      console.warn(`Retailer ${retailerId} loaded without a matching auth user record.`);
    }

    return NextResponse.json({
      retailer: {
        ...retailer,
        how_heard_about_us: sourceResult.data?.how_heard_about_us || null,
        how_heard_about_us_other: sourceResult.data?.how_heard_about_us_other || null,
        email: retailerUserResult.data?.user?.email || '',
        pipedrive_deal_id: onboardingResult.data?.pipedrive_deal_id || null,
        pipedrive_stage_name: onboardingResult.data?.pipedrive_stage_name || null,
      },
      orders,
      locations: locationsResult.data || [],
      successProfile: successProfileResult.data || null,
      currentPromo: currentPromoResult.data || null,
      shelfTalkerFulfillments: shelfTalkerResult.data || [],
    });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Get retailer error:', error);
    return NextResponse.json({ error: 'An error occurred while fetching the retailer' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { adminClient } = await requireAdminAccess();
    const retailerId = params.id;

    if (!retailerId) {
      return NextResponse.json({ error: 'Missing retailerId' }, { status: 400 });
    }

    const body = await request.json();
    const companyName = typeof body.company_name === 'string' ? body.company_name.trim() : '';
    const businessAddress = typeof body.business_address === 'string' ? body.business_address.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!companyName) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
    }

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });
    }

    const { data: retailerUser, error: retailerUserError } = await adminClient.auth.admin.getUserById(retailerId);

    if (retailerUserError || !retailerUser?.user) {
      return NextResponse.json({ error: 'Retailer auth record not found' }, { status: 404 });
    }

    const existingMetadata = retailerUser.user.user_metadata || {};
    const nextMetadata = {
      ...existingMetadata,
      company_name: companyName,
      business_address: businessAddress,
      phone,
      email,
    };

    const emailChanged = (retailerUser.user.email || '').toLowerCase() !== email;

    const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(retailerId, {
      email,
      email_confirm: emailChanged ? true : undefined,
      user_metadata: nextMetadata,
    });

    if (authUpdateError) {
      return NextResponse.json({ error: authUpdateError.message || 'Failed to update retailer email' }, { status: 400 });
    }

    const { error: retailerUpdateError } = await adminClient
      .from('retailers')
      .update({
        company_name: companyName,
        business_address: businessAddress,
        phone,
      })
      .eq('id', retailerId);

    if (retailerUpdateError) {
      return NextResponse.json({ error: retailerUpdateError.message || 'Failed to update retailer profile' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      retailer: {
        id: retailerId,
        company_name: companyName,
        business_address: businessAddress,
        phone,
        email,
      },
    });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Update retailer error:', error);
    return NextResponse.json({ error: 'An error occurred while updating the retailer' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { adminClient } = await requireAdminAccess();
    const retailerId = params.id;

    if (!retailerId) {
      return NextResponse.json({ error: 'Missing retailerId' }, { status: 400 });
    }

    const { data: retailer, error: retailerError } = await adminClient
      .from('retailers')
      .select('id, company_name')
      .eq('id', retailerId)
      .single();

    if (retailerError || !retailer) {
      return NextResponse.json({ error: 'Retailer not found' }, { status: 404 });
    }

    const { count: orderCount, error: orderCountError } = await adminClient
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('retailer_id', retailerId);

    if (orderCountError) {
      throw orderCountError;
    }

    if ((orderCount || 0) > 0) {
      return NextResponse.json(
        { error: 'Retailers with order history cannot be deleted.' },
        { status: 409 },
      );
    }

    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(retailerId);

    if (deleteUserError) {
      return NextResponse.json({ error: deleteUserError.message || 'Failed to delete retailer auth account' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Delete retailer error:', error);
    return NextResponse.json({ error: 'An error occurred while deleting the retailer' }, { status: 500 });
  }
}
