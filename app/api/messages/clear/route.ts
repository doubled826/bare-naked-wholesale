import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('id')
      .eq('id', user.id)
      .single();

    if (adminUser) {
      return NextResponse.json({ error: 'Admins cannot clear retailer chat history' }, { status: 403 });
    }

    const body = await request.json();
    const conversationId = typeof body?.conversationId === 'string' ? body.conversationId : '';

    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
    }

    const { data: conversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('retailer_id', user.id)
      .single();

    if (!conversation) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { error: deleteError } = await supabase
      .from('messages')
      .delete()
      .eq('conversation_id', conversationId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }

    await supabase
      .from('conversations')
      .update({
        last_message_at: null,
        last_message_preview: null,
        last_sender_role: null,
        last_read_by_retailer_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Clear chat history error:', error);
    return NextResponse.json({ error: 'Failed to clear chat history' }, { status: 500 });
  }
}
