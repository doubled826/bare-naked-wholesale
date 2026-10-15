import type { User } from '@supabase/supabase-js';

export type RetailerAccess = {
  membershipId: string;
  retailerId: string;
  userId: string;
  role: 'owner' | 'staff';
  displayName: string;
  email: string;
  locationIds: string[];
};

export async function getRetailerAccess(adminClient: any, user: Pick<User, 'id' | 'email' | 'user_metadata'>): Promise<RetailerAccess | null> {
  const { data: membership, error } = await adminClient
    .from('retailer_memberships')
    .select('id, retailer_id, user_id, role, status, display_name, email')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  if (membership) {
    const { data: assignments, error: assignmentError } = membership.role === 'staff'
      ? await adminClient
          .from('retailer_member_locations')
          .select('location_id')
          .eq('membership_id', membership.id)
      : { data: [], error: null };

    if (assignmentError) throw assignmentError;

    return {
      membershipId: membership.id,
      retailerId: membership.retailer_id,
      userId: membership.user_id,
      role: membership.role,
      displayName: membership.display_name || user.user_metadata?.display_name || user.email || 'Team member',
      email: membership.email || user.email || '',
      locationIds: (assignments || []).map((assignment: { location_id: string }) => assignment.location_id),
    };
  }

  // Compatibility fallback while the migration is being deployed.
  const { data: retailer } = await adminClient
    .from('retailers')
    .select('id, contact_name')
    .eq('id', user.id)
    .maybeSingle();

  if (!retailer) return null;

  return {
    membershipId: user.id,
    retailerId: retailer.id,
    userId: user.id,
    role: 'owner',
    displayName: retailer.contact_name || user.user_metadata?.display_name || user.email || 'Owner',
    email: user.email || '',
    locationIds: [],
  };
}

export function canAccessLocation(access: RetailerAccess, locationId: string) {
  return access.role === 'owner' || access.locationIds.includes(locationId);
}
