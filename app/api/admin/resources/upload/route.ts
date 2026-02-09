import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!adminUser) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const path = `${Date.now()}-${safeName}`;

    const adminClient = createSupabaseAdminClient();
    const { error } = await adminClient.storage
      .from('resources')
      .upload(path, file, { contentType: file.type || undefined, upsert: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const { data } = adminClient.storage.from('resources').getPublicUrl(path);

    return NextResponse.json({
      url: data.publicUrl,
      path,
      name: file.name,
      type: file.type,
      size: file.size,
    });
  } catch (error) {
    console.error('Resource upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
