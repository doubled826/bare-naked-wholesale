import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export class AdminAuthorizationError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AdminAuthorizationError';
    this.status = status;
  }
}

export async function requireAdminAccess() {
  const supabase = createRouteHandlerClient({ cookies });
  const adminClient = createSupabaseAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AdminAuthorizationError('Unauthorized', 401);
  }

  const { data: adminById } = await adminClient
    .from('admin_users')
    .select('id, email')
    .eq('id', user.id)
    .single();

  if (adminById) {
    return { user, adminClient };
  }

  if (!user.email) {
    throw new AdminAuthorizationError('Forbidden', 403);
  }

  const { data: adminByEmail } = await adminClient
    .from('admin_users')
    .select('id')
    .eq('email', user.email)
    .single();

  if (!adminByEmail) {
    throw new AdminAuthorizationError('Forbidden', 403);
  }

  return { user, adminClient };
}

