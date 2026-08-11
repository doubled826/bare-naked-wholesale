import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { getOfferResolution } from '@/lib/offerResolver';

export const dynamic = 'force-dynamic';

type AnnouncementRow = {
  id: string;
  title: string;
  message: string;
  bar_message?: string | null;
  is_active: boolean;
  popup_enabled?: boolean | null;
  popup_headline?: string | null;
  popup_body?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  version?: number | null;
  targeting_type?: string | null;
  manual_retailer_ids?: string[] | null;
  linked_discount_code_id?: string | null;
  inherit_discount_eligibility?: boolean | null;
  created_at: string;
  updated_at?: string | null;
};

type PublicAnnouncement = {
  id: string;
  version: number;
  title: string;
  message: string;
  bar_message: string;
  popup_enabled: boolean;
  popup_headline: string | null;
  popup_body: string | null;
  cta_label: string | null;
  cta_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
};

const isInsideWindow = (announcement: AnnouncementRow, now = Date.now()) => {
  if (announcement.starts_at && new Date(announcement.starts_at).getTime() > now) return false;
  if (announcement.ends_at && new Date(announcement.ends_at).getTime() < now) return false;
  return true;
};

const toPublicAnnouncement = (announcement: AnnouncementRow): PublicAnnouncement => ({
  id: announcement.id,
  version: announcement.version || 1,
  title: announcement.title,
  message: announcement.message,
  bar_message: announcement.bar_message || announcement.message,
  popup_enabled: Boolean(announcement.popup_enabled),
  popup_headline: announcement.popup_headline || null,
  popup_body: announcement.popup_body || null,
  cta_label: announcement.cta_label || null,
  cta_url: announcement.cta_url || null,
  starts_at: announcement.starts_at || null,
  ends_at: announcement.ends_at || null,
});

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createSupabaseAdminClient();
    const { data: retailer, error: retailerError } = await adminClient
      .from('retailers')
      .select('id, created_at')
      .eq('id', user.id)
      .single();

    if (retailerError || !retailer) {
      return NextResponse.json({ error: 'Retailer not found.' }, { status: 404 });
    }

    const { count: activeOrderCount, error: orderCountError } = await adminClient
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('retailer_id', user.id)
      .neq('status', 'canceled');

    if (orderCountError) throw orderCountError;

    const { data, error } = await adminClient
      .from('announcements')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const rows = (data || []) as AnnouncementRow[];
    const eligible = [];

    for (const announcement of rows) {
      if (!isInsideWindow(announcement)) continue;

      const targetingType = announcement.targeting_type || 'all_retailers';
      let isEligible = targetingType === 'all_retailers';

      if (targetingType === 'manual') {
        isEligible = (announcement.manual_retailer_ids || []).includes(user.id);
      } else if (targetingType === 'new_retailers') {
        const createdAt = retailer.created_at ? new Date(retailer.created_at).getTime() : 0;
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        isEligible = createdAt >= thirtyDaysAgo;
      } else if (targetingType === 'linked_discount' && announcement.linked_discount_code_id) {
        const { data: discount } = await adminClient
          .from('discount_codes')
          .select('code')
          .eq('id', announcement.linked_discount_code_id)
          .maybeSingle();

        if (discount?.code) {
          const resolution = await getOfferResolution({
            adminClient,
            retailer,
            activeOrderCount: activeOrderCount || 0,
            subtotal: 100,
            promotionCode: discount.code,
          });
          isEligible = !resolution.error && resolution.appliedBenefits.some((benefit) => benefit.sourceId === announcement.linked_discount_code_id);
        }
      }

      if (isEligible) eligible.push(announcement);
    }

    const popupIds = eligible.filter((announcement) => announcement.popup_enabled).map((announcement) => announcement.id);
    const { data: views, error: viewsError } = popupIds.length > 0
      ? await adminClient
          .from('announcement_popup_views')
          .select('announcement_id, version, dismissed_at')
          .eq('retailer_id', user.id)
          .in('announcement_id', popupIds)
      : { data: [], error: null };

    if (viewsError) throw viewsError;

    const seenKeys = new Set((views || []).map((view: any) => `${view.announcement_id}:${view.version}`));
    const popup = eligible.find((announcement) =>
      announcement.popup_enabled &&
      !seenKeys.has(`${announcement.id}:${announcement.version || 1}`)
    ) || null;

    return NextResponse.json({
      announcements: eligible.map(toPublicAnnouncement),
      popup: popup ? toPublicAnnouncement(popup) : null,
    });
  } catch (error) {
    console.error('Retailer announcements load error:', error);
    return NextResponse.json({ error: 'Unable to load announcements.' }, { status: 500 });
  }
}
