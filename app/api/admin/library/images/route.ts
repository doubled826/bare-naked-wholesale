import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

const BUCKET = 'resources';
const PREFIX = 'images';

const ensureAdmin = async () => {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('id')
    .eq('id', user.id)
    .single();

  if (!adminUser) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { user };
};

const getPublicUrl = (path: string) => {
  const adminClient = createSupabaseAdminClient();
  const { data } = adminClient.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
};

export async function GET() {
  try {
    const admin = await ensureAdmin();
    if (admin.error) return admin.error;

    const adminClient = createSupabaseAdminClient();
    const { data, error } = await adminClient.storage.from(BUCKET).list(PREFIX, {
      limit: 200,
      offset: 0,
      sortBy: { column: 'created_at', order: 'desc' },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const images = (data || [])
      .filter((item) => item.name && item.name !== '.emptyFolderPlaceholder')
      .map((item) => {
        const path = `${PREFIX}/${item.name}`;
        return {
          name: item.name,
          path,
          url: getPublicUrl(path),
          size: item.metadata?.size || null,
          mimeType: item.metadata?.mimetype || item.metadata?.contentType || null,
          createdAt: item.created_at || null,
          updatedAt: item.updated_at || null,
        };
      });

    return NextResponse.json({ images });
  } catch (error) {
    console.error('Library images list error:', error);
    return NextResponse.json({ error: 'Unable to load images' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await ensureAdmin();
    if (admin.error) return admin.error;

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image files can be uploaded here.' }, { status: 400 });
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const path = `${PREFIX}/${Date.now()}-${safeName}`;

    const adminClient = createSupabaseAdminClient();
    const { error } = await adminClient.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type || undefined, upsert: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      image: {
        name: file.name,
        path,
        url: getPublicUrl(path),
        size: file.size,
        mimeType: file.type,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Library image upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const admin = await ensureAdmin();
    if (admin.error) return admin.error;

    const body = await request.json().catch(() => ({}));
    const path = typeof body.path === 'string' ? body.path : '';

    if (!path.startsWith(`${PREFIX}/`)) {
      return NextResponse.json({ error: 'Invalid image path' }, { status: 400 });
    }

    const adminClient = createSupabaseAdminClient();
    const { error } = await adminClient.storage.from(BUCKET).remove([path]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Library image delete error:', error);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
