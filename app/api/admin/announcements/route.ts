import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';

const selectColumns = 'id, title, message, bar_message, is_active, popup_enabled, popup_headline, popup_body, cta_label, cta_url, starts_at, ends_at, version, targeting_type, manual_retailer_ids, linked_discount_code_id, inherit_discount_eligibility, created_at, updated_at';

const toNullableDate = (value: unknown) => {
  if (!value || typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

function normalizeAnnouncementInput(body: unknown) {
  const source = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const title = typeof source.title === 'string' ? source.title.trim() : '';
  const barMessage = typeof source.bar_message === 'string'
    ? source.bar_message.trim()
    : typeof source.message === 'string'
      ? source.message.trim()
      : '';
  const popupEnabled = Boolean(source.popup_enabled);
  const targetingType = ['all_retailers', 'manual', 'new_retailers', 'linked_discount'].includes(String(source.targeting_type))
    ? String(source.targeting_type)
    : 'all_retailers';
  const manualRetailerIds = Array.isArray(source.manual_retailer_ids)
    ? source.manual_retailer_ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : [];
  const linkedDiscountCodeId = typeof source.linked_discount_code_id === 'string' && source.linked_discount_code_id
    ? source.linked_discount_code_id
    : null;

  return {
    title,
    message: barMessage,
    bar_message: barMessage,
    is_active: Boolean(source.is_active),
    popup_enabled: popupEnabled,
    popup_headline: typeof source.popup_headline === 'string' ? source.popup_headline.trim() || null : null,
    popup_body: typeof source.popup_body === 'string' ? source.popup_body.trim() || null : null,
    cta_label: typeof source.cta_label === 'string' ? source.cta_label.trim() || null : null,
    cta_url: typeof source.cta_url === 'string' ? source.cta_url.trim() || null : null,
    starts_at: toNullableDate(source.starts_at),
    ends_at: toNullableDate(source.ends_at),
    targeting_type: targetingType,
    manual_retailer_ids: targetingType === 'manual' ? manualRetailerIds : [],
    linked_discount_code_id: targetingType === 'linked_discount' ? linkedDiscountCodeId : null,
    inherit_discount_eligibility: targetingType === 'linked_discount' ? Boolean(source.inherit_discount_eligibility) : false,
  };
}

function getIdFromRequest(request: Request) {
  const { searchParams } = new URL(request.url);
  return searchParams.get('id')?.trim() || '';
}

function handleAdminError(error: unknown, fallback: string) {
  if (error instanceof AdminAuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error(fallback, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function GET() {
  try {
    const { adminClient } = await requireAdminAccess();
    const { data, error } = await adminClient
      .from('announcements')
      .select(selectColumns)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message || 'Unable to load announcements.' }, { status: 400 });
    }

    return NextResponse.json({ announcements: data || [] });
  } catch (error) {
    return handleAdminError(error, 'Unable to load announcements.');
  }
}

export async function POST(request: Request) {
  try {
    const { adminClient } = await requireAdminAccess();
    const announcement = normalizeAnnouncementInput(await request.json().catch(() => ({})));

    if (!announcement.title || !announcement.bar_message) {
      return NextResponse.json({ error: 'Title and announcement bar message are required.' }, { status: 400 });
    }
    if (announcement.popup_enabled && (!announcement.popup_headline || !announcement.popup_body)) {
      return NextResponse.json({ error: 'Popup headline and body are required when popup is enabled.' }, { status: 400 });
    }

    const { data, error } = await adminClient
      .from('announcements')
      .insert(announcement)
      .select(selectColumns)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message || 'Unable to create announcement.' }, { status: 400 });
    }

    return NextResponse.json({ announcement: data });
  } catch (error) {
    return handleAdminError(error, 'Unable to create announcement.');
  }
}

export async function PATCH(request: Request) {
  try {
    const id = getIdFromRequest(request);

    if (!id) {
      return NextResponse.json({ error: 'Missing announcement id.' }, { status: 400 });
    }

    const { adminClient } = await requireAdminAccess();
    const announcement = normalizeAnnouncementInput(await request.json().catch(() => ({})));

    if (!announcement.title || !announcement.bar_message) {
      return NextResponse.json({ error: 'Title and announcement bar message are required.' }, { status: 400 });
    }
    if (announcement.popup_enabled && (!announcement.popup_headline || !announcement.popup_body)) {
      return NextResponse.json({ error: 'Popup headline and body are required when popup is enabled.' }, { status: 400 });
    }

    const { data: existing } = await adminClient
      .from('announcements')
      .select('popup_enabled, popup_headline, popup_body, cta_label, cta_url, version')
      .eq('id', id)
      .maybeSingle();

    const popupChanged = existing
      ? (
          Boolean(existing.popup_enabled) !== announcement.popup_enabled ||
          (existing.popup_headline || '') !== (announcement.popup_headline || '') ||
          (existing.popup_body || '') !== (announcement.popup_body || '') ||
          (existing.cta_label || '') !== (announcement.cta_label || '') ||
          (existing.cta_url || '') !== (announcement.cta_url || '')
        )
      : false;

    const { data, error } = await adminClient
      .from('announcements')
      .update({
        ...announcement,
        version: popupChanged ? Number(existing?.version || 1) + 1 : Number(existing?.version || 1),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(selectColumns)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message || 'Unable to update announcement.' }, { status: 400 });
    }

    return NextResponse.json({ announcement: data });
  } catch (error) {
    return handleAdminError(error, 'Unable to update announcement.');
  }
}

export async function DELETE(request: Request) {
  try {
    const id = getIdFromRequest(request);

    if (!id) {
      return NextResponse.json({ error: 'Missing announcement id.' }, { status: 400 });
    }

    const { adminClient } = await requireAdminAccess();
    const { error } = await adminClient
      .from('announcements')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message || 'Unable to delete announcement.' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAdminError(error, 'Unable to delete announcement.');
  }
}
