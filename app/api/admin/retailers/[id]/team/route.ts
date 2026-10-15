import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';
import { sendRetailerEmail } from '@/lib/email';
import { buildStaffInvitationEmail } from '@/lib/emailTemplates';

type RouteContext = { params: { id: string } };

async function validateLocationIds(adminClient: any, retailerId: string, rawLocationIds: unknown) {
  const locationIds: string[] = Array.isArray(rawLocationIds)
    ? Array.from(new Set<string>(rawLocationIds.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)))
    : [];
  if (!locationIds.length) throw new Error('Staff must have at least one location.');
  const { data, error } = await adminClient
    .from('retailer_locations')
    .select('id, location_name')
    .eq('retailer_id', retailerId)
    .in('id', locationIds);
  if (error) throw error;
  if ((data || []).length !== locationIds.length) throw new Error('Choose valid retailer locations.');
  return { locationIds, locations: data || [] };
}

async function createInvitationLink(adminClient: any, invitation: { id: string; email: string; display_name: string }) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://wholesale.barenakedpet.com').replace(/\/$/, '');
  const redirectTo = `${appUrl}/accept-invite?invitation=${encodeURIComponent(invitation.id)}`;
  const options = {
    data: { account_type: 'retailer_staff', display_name: invitation.display_name },
    redirectTo,
  };
  let result = await adminClient.auth.admin.generateLink({ type: 'invite', email: invitation.email, options });
  if (result.error) result = await adminClient.auth.admin.generateLink({ type: 'magiclink', email: invitation.email, options });
  if (result.error || !result.data?.properties?.action_link) throw result.error || new Error('Unable to create invitation link.');
  return result.data.properties.action_link as string;
}

async function loadInvitation(adminClient: any, retailerId: string, invitationId: string) {
  const { data, error } = await adminClient
    .from('retailer_staff_invitations')
    .select('id, retailer_id, email, display_name, status, locations:retailer_staff_invitation_locations(location_id, location:retailer_locations(location_name))')
    .eq('id', invitationId)
    .eq('retailer_id', retailerId)
    .in('status', ['pending', 'expired'])
    .single();
  if (error || !data) throw new Error('Invitation not found.');
  return data;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { adminClient } = await requireAdminAccess();
    const retailerId = params.id;
    const body = await request.json();

    if (body.action === 'member_locations' && typeof body.membershipId === 'string') {
      const { data: member } = await adminClient
        .from('retailer_memberships')
        .select('id, role')
        .eq('id', body.membershipId)
        .eq('retailer_id', retailerId)
        .single();
      if (!member || member.role !== 'staff') return NextResponse.json({ error: 'Staff member not found.' }, { status: 404 });
      const { locationIds } = await validateLocationIds(adminClient, retailerId, body.locationIds);
      await adminClient.from('retailer_member_locations').delete().eq('membership_id', member.id);
      const { error } = await adminClient.from('retailer_member_locations').insert(locationIds.map((locationId) => ({ membership_id: member.id, location_id: locationId })));
      if (error) throw error;
      return NextResponse.json({ success: true, locationIds });
    }

    if (body.action === 'member_status' && typeof body.membershipId === 'string' && ['active', 'disabled'].includes(body.status)) {
      const { data: member } = await adminClient
        .from('retailer_memberships')
        .select('id, role')
        .eq('id', body.membershipId)
        .eq('retailer_id', retailerId)
        .single();
      if (!member || member.role !== 'staff') return NextResponse.json({ error: 'Staff member not found.' }, { status: 404 });
      const { error } = await adminClient.from('retailer_memberships').update({ status: body.status, updated_at: new Date().toISOString() }).eq('id', member.id);
      if (error) throw error;
      return NextResponse.json({ success: true, status: body.status });
    }

    if (body.action === 'invitation_cancel' && typeof body.invitationId === 'string') {
      const { error } = await adminClient.from('retailer_staff_invitations').update({ status: 'canceled', updated_at: new Date().toISOString() }).eq('id', body.invitationId).eq('retailer_id', retailerId).in('status', ['pending', 'expired']);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (['invitation_resend', 'invitation_link'].includes(body.action) && typeof body.invitationId === 'string') {
      const invitation = await loadInvitation(adminClient, retailerId, body.invitationId);
      const invitationUrl = await createInvitationLink(adminClient, invitation);

      if (body.action === 'invitation_resend') {
        const { data: retailer, error: retailerError } = await adminClient.from('retailers').select('company_name').eq('id', retailerId).single();
        if (retailerError) throw retailerError;
        const locationNames = (invitation.locations || []).map((item: any) => item.location?.location_name).filter(Boolean);
        const email = buildStaffInvitationEmail({
          staffName: invitation.display_name,
          inviterName: 'The Bare Naked Pet Co. team',
          retailerName: retailer.company_name,
          locationNames,
          invitationUrl,
        });
        await sendRetailerEmail({ to: invitation.email, ...email });
      }

      const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
      await adminClient.from('retailer_staff_invitations').update({ status: 'pending', expires_at: expiresAt, updated_at: new Date().toISOString() }).eq('id', invitation.id);
      return NextResponse.json({ success: true, invitationUrl: body.action === 'invitation_link' ? invitationUrl : undefined, expiresAt });
    }

    return NextResponse.json({ error: 'Unsupported team action.' }, { status: 400 });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Admin retailer team update error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update retailer access.' }, { status: 500 });
  }
}
