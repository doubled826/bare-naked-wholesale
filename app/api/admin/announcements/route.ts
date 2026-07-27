import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';

const selectColumns = 'id, title, message, is_active, created_at, updated_at';

function normalizeAnnouncementInput(body: unknown) {
  const source = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const title = typeof source.title === 'string' ? source.title.trim() : '';
  const message = typeof source.message === 'string' ? source.message.trim() : '';

  return {
    title,
    message,
    is_active: Boolean(source.is_active),
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

    if (!announcement.title || !announcement.message) {
      return NextResponse.json({ error: 'Title and message are required.' }, { status: 400 });
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

    if (!announcement.title || !announcement.message) {
      return NextResponse.json({ error: 'Title and message are required.' }, { status: 400 });
    }

    const { data, error } = await adminClient
      .from('announcements')
      .update({
        ...announcement,
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
