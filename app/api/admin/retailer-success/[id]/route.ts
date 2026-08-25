import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';

type RouteContext = {
  params: {
    id: string;
  };
};

const allowedProfileFields = [
  'samples_acknowledged',
  'astro_enrolled',
  'marketing_materials_status',
  'shelf_placement_status',
  'shelf_placement_note',
  'current_promo_status',
] as const;

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { adminClient } = await requireAdminAccess();
    const retailerId = params.id;

    if (!retailerId) {
      return NextResponse.json({ error: 'Missing retailerId' }, { status: 400 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    allowedProfileFields.forEach((field) => {
      if (field in body) updates[field] = body[field];
    });

    const { data, error } = await adminClient
      .from('retailer_success_profiles')
      .upsert({
        retailer_id: retailerId,
        ...updates,
        success_plan_last_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'retailer_id' })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to save retailer success profile.' }, { status: 400 });
    }

    return NextResponse.json({ success: true, profile: data });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Admin retailer success save error:', error);
    return NextResponse.json({ error: 'Failed to save retailer success profile.' }, { status: 500 });
  }
}
