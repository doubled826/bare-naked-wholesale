import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user?.email) return NextResponse.json({ error: 'Open the invitation link again to continue.' }, { status: 401 });
    const { invitationId } = await request.json();
    if (typeof invitationId !== 'string') return NextResponse.json({ error: 'Invalid invitation.' }, { status: 400 });

    const adminClient = createSupabaseAdminClient();
    const { data: invitation, error } = await adminClient
      .from('retailer_staff_invitations')
      .select('id, retailer_id, email, display_name, status, expires_at, locations:retailer_staff_invitation_locations(location_id)')
      .eq('id', invitationId)
      .single();
    if (error || !invitation || invitation.status !== 'pending') return NextResponse.json({ error: 'This invitation is no longer available.' }, { status: 410 });
    if (new Date(invitation.expires_at).getTime() < Date.now()) {
      await adminClient.from('retailer_staff_invitations').update({ status: 'expired' }).eq('id', invitation.id);
      return NextResponse.json({ error: 'This invitation has expired. Ask the owner to resend it.' }, { status: 410 });
    }
    if (invitation.email.toLowerCase() !== user.email.toLowerCase()) return NextResponse.json({ error: `This invitation was sent to ${invitation.email}.` }, { status: 403 });

    const { data: otherMembership } = await adminClient.from('retailer_memberships').select('id, retailer_id').eq('user_id', user.id).eq('status', 'active').neq('retailer_id', invitation.retailer_id).limit(1).maybeSingle();
    if (otherMembership) return NextResponse.json({ error: 'This email already belongs to another retailer account. Contact support for help.' }, { status: 409 });

    const { data: membership, error: membershipError } = await adminClient
      .from('retailer_memberships')
      .upsert({ retailer_id: invitation.retailer_id, user_id: user.id, role: 'staff', status: 'active', display_name: invitation.display_name, email: invitation.email }, { onConflict: 'retailer_id,user_id' })
      .select('id')
      .single();
    if (membershipError) throw membershipError;

    await adminClient.from('retailer_member_locations').delete().eq('membership_id', membership.id);
    const locationIds = (invitation.locations || []).map((item: any) => item.location_id);
    if (locationIds.length) {
      const { error: locationsError } = await adminClient.from('retailer_member_locations').insert(locationIds.map((locationId: string) => ({ membership_id: membership.id, location_id: locationId })));
      if (locationsError) throw locationsError;
    }
    await adminClient.from('retailer_staff_invitations').update({ status: 'accepted', accepted_by: user.id, accepted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', invitation.id);
    await adminClient.auth.admin.updateUserById(user.id, { user_metadata: { ...(user.user_metadata || {}), account_type: 'retailer_staff', display_name: invitation.display_name } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Accept staff invitation error:', error);
    return NextResponse.json({ error: 'Unable to accept this invitation.' }, { status: 500 });
  }
}
