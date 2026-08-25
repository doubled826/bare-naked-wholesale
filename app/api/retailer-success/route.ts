import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { DEFAULT_ASTRO_URL, normalizeCurrentAstroPromo } from '@/lib/retailerSuccess';
import { sendTeamEmail } from '@/lib/email';
import { formatMarketingMaterialsLabel, isMarketingMaterialsType } from '@/lib/marketingMaterials';
import {
  schedulePrivateLaunchPromo,
  sendPrivateLaunchPromoEmail,
  type PrivateLaunchPromoSource,
} from '@/lib/privateLaunchPromo';

const allowedProfileFields = [
  'samples_acknowledged',
  'astro_enrolled',
  'marketing_materials_status',
  'launch_promo_status',
  'private_promo_status',
  'private_promo_source',
  'private_promo_start_date',
  'private_promo_end_date',
  'private_promo_duration_weeks',
  'private_promo_discount_percent',
  'private_promo_sales_summary_requested_at',
  'private_promo_sales_summary_received_at',
  'private_promo_last_reminder_sent_at',
  'private_promo_last_email_stage',
  'shelf_placement_status',
  'shelf_placement_note',
  'current_promo_status',
] as const;

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [{ data: profile }, { data: promo }] = await Promise.all([
      supabase
        .from('retailer_success_profiles')
        .select('*')
        .eq('retailer_id', user.id)
        .maybeSingle(),
      supabase
        .from('retailer_success_promo_settings')
        .select('*')
        .eq('id', 'current')
        .maybeSingle(),
    ]);

    return NextResponse.json({
      profile,
      currentPromo: normalizeCurrentAstroPromo(promo),
    });
  } catch (error) {
    console.error('Retailer success load error:', error);
    return NextResponse.json({ error: 'Failed to load retailer success profile.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    allowedProfileFields.forEach((field) => {
      if (field in body) updates[field] = body[field];
    });
    const marketingMaterialsRequest = isMarketingMaterialsType(body.marketing_materials_request)
      ? body.marketing_materials_request
      : null;
    const launchPromoRequest = typeof body.launch_promo_request === 'object' && body.launch_promo_request
      ? body.launch_promo_request as { start_date?: unknown; duration_weeks?: unknown; notes?: unknown }
      : null;
    let notificationWarning: string | null = null;

    if (updates.marketing_materials_status === 'requested' && marketingMaterialsRequest) {
      const { data: retailer } = await supabase
        .from('retailers')
        .select('company_name, account_number, business_address, phone')
        .eq('id', user.id)
        .maybeSingle();

      const companyName = retailer?.company_name || 'Unknown retailer';
      const materialsLabel = formatMarketingMaterialsLabel(marketingMaterialsRequest);

      const { data: existingRequest } = await supabase
        .from('marketing_material_requests')
        .select('id')
        .eq('retailer_id', user.id)
        .eq('status', 'pending')
        .maybeSingle();

      const requestPayload = {
        retailer_id: user.id,
        materials_type: marketingMaterialsRequest,
        status: 'pending',
      };

      const { error: requestError } = existingRequest?.id
        ? await supabase
            .from('marketing_material_requests')
            .update(requestPayload)
            .eq('id', existingRequest.id)
        : await supabase
            .from('marketing_material_requests')
            .insert(requestPayload);

      if (requestError) {
        return NextResponse.json(
          { error: requestError.message || 'Failed to save marketing materials request.' },
          { status: 400 },
        );
      }

      try {
        await sendTeamEmail({
          subject: `Marketing materials requested: ${companyName}`,
          text: `
A retailer requested in-store marketing materials.

These materials should be added to their next order.

Retailer: ${companyName}
Account Number: ${retailer?.account_number || 'Not provided'}
Email: ${user.email || 'Not provided'}
Phone: ${retailer?.phone || 'Not provided'}
Address: ${retailer?.business_address || 'Not provided'}

Requested Materials: ${materialsLabel}
          `.trim(),
        });
      } catch (emailError) {
        console.error('Marketing materials notification email error:', emailError);
        return NextResponse.json(
          { error: 'Marketing materials request could not be emailed to the team. Please try again.' },
          { status: 500 },
        );
      }
    }

    if (
      'marketing_materials_status' in updates &&
      updates.marketing_materials_status !== 'requested'
    ) {
      const { error: cancelRequestError } = await supabase
        .from('marketing_material_requests')
        .update({ status: 'canceled' })
        .eq('retailer_id', user.id)
        .eq('status', 'pending');

      if (cancelRequestError) {
        console.error('Marketing materials request cancel error:', cancelRequestError);
      }
    }

    if (['requested', 'dates_needed', 'scheduled'].includes(String(updates.launch_promo_status)) && launchPromoRequest) {
      const startDate = typeof launchPromoRequest.start_date === 'string' ? launchPromoRequest.start_date : '';
      const durationWeeks = Number(launchPromoRequest.duration_weeks);

      if (!startDate || ![2, 3, 4].includes(durationWeeks)) {
        return NextResponse.json(
          { error: 'Please choose a promo start date and a 2-4 week duration.' },
          { status: 400 },
        );
      }

      const { data: retailer } = await supabase
        .from('retailers')
        .select('company_name, account_number, business_address, phone')
        .eq('id', user.id)
        .maybeSingle();

      const companyName = retailer?.company_name || 'Unknown retailer';
      const source: PrivateLaunchPromoSource = body.private_promo_source === 'welcome_offer'
        ? 'welcome_offer'
        : 'dashboard_request';

      const promoRequest = await schedulePrivateLaunchPromo({
        adminClient: supabase,
        retailerId: user.id,
        source,
        startDate,
        durationWeeks,
        retailerNotes: typeof launchPromoRequest.notes === 'string' ? launchPromoRequest.notes : '',
      });

      updates.launch_promo_status = promoRequest.status;
      updates.private_promo_status = promoRequest.status;
      updates.private_promo_source = source;
      updates.private_promo_start_date = promoRequest.start_date;
      updates.private_promo_end_date = promoRequest.end_date;
      updates.private_promo_duration_weeks = promoRequest.duration_weeks;
      updates.private_promo_discount_percent = promoRequest.promo_discount_percent;
      updates.private_promo_last_email_stage = 'scheduled_confirmation';

      try {
        if (user.email) {
          await sendPrivateLaunchPromoEmail({
            to: user.email,
            storeName: companyName,
            stage: 'scheduled_confirmation',
            startDate: promoRequest.start_date,
            endDate: promoRequest.end_date,
            durationWeeks: promoRequest.duration_weeks,
            discountPercent: promoRequest.promo_discount_percent,
          });
        }
      } catch (emailError) {
        console.error('Launch promo notification email error:', emailError);
        notificationWarning = 'Launch promo was saved, but the confirmation email could not be sent. Please contact the team if this is urgent.';
      }
    }

    if ('launch_promo_status' in updates && ['not_requested', 'canceled'].includes(String(updates.launch_promo_status))) {
      const { error: cancelLaunchPromoError } = await supabase
        .from('launch_promo_requests')
        .update({ status: 'canceled' })
        .eq('retailer_id', user.id)
        .in('status', ['pending', 'dates_needed', 'scheduled', 'active', 'awaiting_sales_summary']);

      if (cancelLaunchPromoError) {
        console.error('Launch promo request cancel error:', cancelLaunchPromoError);
      }
    }

    const { data, error } = await supabase
      .from('retailer_success_profiles')
      .upsert({
        retailer_id: user.id,
        ...updates,
        success_plan_last_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'retailer_id' })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to save retailer success profile.' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      profile: data,
      notificationWarning,
      currentPromo: {
        promoVisible: false,
        promoName: '',
        promoDescription: '',
        promoStartDate: null,
        promoEndDate: null,
        astroPromoUrl: DEFAULT_ASTRO_URL,
      },
    });
  } catch (error) {
    console.error('Retailer success save error:', error);
    return NextResponse.json({ error: 'Failed to save retailer success profile.' }, { status: 500 });
  }
}
