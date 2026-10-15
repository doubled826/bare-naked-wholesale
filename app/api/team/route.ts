import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { getRetailerAccess } from '@/lib/retailerAccess';
import { sendRetailerEmail } from '@/lib/email';
import { buildStaffInvitationEmail } from '@/lib/emailTemplates';
import { isValidEmail } from '@/lib/utils';

export const dynamic = 'force-dynamic';

async function requireOwner() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const adminClient = createSupabaseAdminClient();
  const access = await getRetailerAccess(adminClient, user);
  if (!access || access.role !== 'owner') {
    return { error: NextResponse.json({ error: 'Only the account owner can manage staff.' }, { status: 403 }) };
  }
  return { adminClient, access, user };
}

async function createInvitationLink(adminClient: any, invitation: { id: string; email: string; display_name: string }) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://wholesale.barenakedpet.com').replace(/\/$/, '');
  const redirectTo = `${appUrl}/accept-invite?invitation=${encodeURIComponent(invitation.id)}`;
  const options = {
    data: {
      account_type: 'retailer_staff',
      display_name: invitation.display_name,
    },
    redirectTo,
  };

  let result = await adminClient.auth.admin.generateLink({ type: 'invite', email: invitation.email, options });
  if (result.error) {
    result = await adminClient.auth.admin.generateLink({ type: 'magiclink', email: invitation.email, options });
  }
  if (result.error || !result.data?.properties?.action_link) {
    throw result.error || new Error('Unable to create invitation link.');
  }
  return result.data.properties.action_link as string;
}

async function sendInvitation(adminClient: any, access: NonNullable<Awaited<ReturnType<typeof getRetailerAccess>>>, invitation: any, locationNames: string[]) {
  const { data: retailer, error: retailerError } = await adminClient
    .from('retailers')
    .select('company_name')
    .eq('id', access.retailerId)
    .single();
  if (retailerError) throw retailerError;

  const invitationUrl = await createInvitationLink(adminClient, invitation);
  const email = buildStaffInvitationEmail({
    staffName: invitation.display_name,
    inviterName: access.displayName || 'Your account owner',
    retailerName: retailer.company_name,
    locationNames,
    invitationUrl,
  });

  await sendRetailerEmail({ to: invitation.email, ...email });
}

export async function GET() {
  try {
    const auth = await requireOwner();
    if ('error' in auth) return auth.error;
    const { adminClient, access } = auth;

    const [membersResult, invitationsResult] = await Promise.all([
      adminClient
        .from('retailer_memberships')
        .select('id, user_id, role, status, display_name, email, created_at, locations:retailer_member_locations(location_id)')
        .eq('retailer_id', access.retailerId)
        .order('created_at', { ascending: true }),
      adminClient
        .from('retailer_staff_invitations')
        .select('id, email, display_name, status, expires_at, created_at, locations:retailer_staff_invitation_locations(location_id)')
        .eq('retailer_id', access.retailerId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
    ]);
    if (membersResult.error) throw membersResult.error;
    if (invitationsResult.error) throw invitationsResult.error;

    return NextResponse.json({ members: membersResult.data || [], invitations: invitationsResult.data || [] });
  } catch (error) {
    console.error('Team load error:', error);
    return NextResponse.json({ error: 'Unable to load team members.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireOwner();
    if ('error' in auth) return auth.error;
    const { adminClient, access, user } = auth;
    const body = await request.json();
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const locationIds: string[] = Array.isArray(body.locationIds)
      ? Array.from(new Set<string>(body.locationIds.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)))
      : [];

    if (!displayName || !email || !isValidEmail(email) || locationIds.length === 0) {
      return NextResponse.json({ error: 'Name, a valid email, and at least one location are required.' }, { status: 400 });
    }

    const { data: locations, error: locationsError } = await adminClient
      .from('retailer_locations')
      .select('id, location_name')
      .eq('retailer_id', access.retailerId)
      .in('id', locationIds);
    if (locationsError) throw locationsError;
    if ((locations || []).length !== locationIds.length) {
      return NextResponse.json({ error: 'Choose valid store locations.' }, { status: 400 });
    }

    const { data: existingMember } = await adminClient
      .from('retailer_memberships')
      .select('id')
      .eq('retailer_id', access.retailerId)
      .ilike('email', email)
      .eq('status', 'active')
      .maybeSingle();
    if (existingMember) return NextResponse.json({ error: 'That person already has access.' }, { status: 409 });

    await adminClient
      .from('retailer_staff_invitations')
      .update({ status: 'canceled', updated_at: new Date().toISOString() })
      .eq('retailer_id', access.retailerId)
      .ilike('email', email)
      .eq('status', 'pending');

    const invitationId = crypto.randomUUID();
    const invitation = {
      id: invitationId,
      retailer_id: access.retailerId,
      display_name: displayName,
      email,
      invited_by: user.id,
      status: 'pending',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const { error: invitationError } = await adminClient.from('retailer_staff_invitations').insert(invitation);
    if (invitationError) throw invitationError;

    const { error: assignmentError } = await adminClient.from('retailer_staff_invitation_locations').insert(
      locationIds.map((locationId) => ({ invitation_id: invitationId, location_id: locationId })),
    );
    if (assignmentError) throw assignmentError;

    await sendInvitation(adminClient, access, invitation, (locations || []).map((location: any) => location.location_name));
    return NextResponse.json({ success: true, invitationId });
  } catch (error) {
    console.error('Staff invitation error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to send invitation.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireOwner();
    if ('error' in auth) return auth.error;
    const { adminClient, access } = auth;
    const body = await request.json();

    if (body.action === 'resend' && typeof body.invitationId === 'string') {
      const { data: invitation, error } = await adminClient
        .from('retailer_staff_invitations')
        .select('id, email, display_name, retailer_id, locations:retailer_staff_invitation_locations(location_id, location:retailer_locations(location_name))')
        .eq('id', body.invitationId)
        .eq('retailer_id', access.retailerId)
        .eq('status', 'pending')
        .single();
      if (error || !invitation) return NextResponse.json({ error: 'Invitation not found.' }, { status: 404 });
      await adminClient.from('retailer_staff_invitations').update({ expires_at: new Date(Date.now() + 7 * 86400000).toISOString(), updated_at: new Date().toISOString() }).eq('id', invitation.id);
      const names = (invitation.locations || []).map((item: any) => item.location?.location_name).filter(Boolean);
      await sendInvitation(adminClient, access, invitation, names);
      return NextResponse.json({ success: true });
    }

    if (body.action === 'cancel' && typeof body.invitationId === 'string') {
      const { error } = await adminClient.from('retailer_staff_invitations').update({ status: 'canceled', updated_at: new Date().toISOString() }).eq('id', body.invitationId).eq('retailer_id', access.retailerId).eq('status', 'pending');
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (body.action === 'locations' && typeof body.membershipId === 'string' && Array.isArray(body.locationIds)) {
      const locationIds: string[] = Array.from(new Set<string>(body.locationIds.filter((id: unknown): id is string => typeof id === 'string')));
      if (!locationIds.length) return NextResponse.json({ error: 'Staff must have at least one location.' }, { status: 400 });
      const { data: member } = await adminClient.from('retailer_memberships').select('id, role').eq('id', body.membershipId).eq('retailer_id', access.retailerId).single();
      if (!member || member.role !== 'staff') return NextResponse.json({ error: 'Staff member not found.' }, { status: 404 });
      const { data: locations } = await adminClient.from('retailer_locations').select('id').eq('retailer_id', access.retailerId).in('id', locationIds);
      if ((locations || []).length !== locationIds.length) return NextResponse.json({ error: 'Choose valid locations.' }, { status: 400 });
      await adminClient.from('retailer_member_locations').delete().eq('membership_id', member.id);
      const { error } = await adminClient.from('retailer_member_locations').insert(locationIds.map((locationId) => ({ membership_id: member.id, location_id: locationId })));
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unsupported team update.' }, { status: 400 });
  } catch (error) {
    console.error('Team update error:', error);
    return NextResponse.json({ error: 'Unable to update the team.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireOwner();
    if ('error' in auth) return auth.error;
    const { adminClient, access } = auth;
    const membershipId = new URL(request.url).searchParams.get('membershipId');
    if (!membershipId) return NextResponse.json({ error: 'Team member is required.' }, { status: 400 });

    const { data: member } = await adminClient.from('retailer_memberships').select('id, role').eq('id', membershipId).eq('retailer_id', access.retailerId).single();
    if (!member || member.role !== 'staff') return NextResponse.json({ error: 'Staff member not found.' }, { status: 404 });
    const { error } = await adminClient.from('retailer_memberships').update({ status: 'disabled', updated_at: new Date().toISOString() }).eq('id', member.id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Remove staff error:', error);
    return NextResponse.json({ error: 'Unable to remove staff access.' }, { status: 500 });
  }
}
