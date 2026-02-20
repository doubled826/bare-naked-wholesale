import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { sendTeamEmail } from '@/lib/email';

const MAX_MESSAGE_LENGTH = 5000;

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const conversationId = typeof body?.conversationId === 'string' ? body.conversationId : null;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ error: 'Message is too long' }, { status: 400 });
    }

    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('name')
      .eq('id', user.id)
      .single();

    const isAdmin = Boolean(adminUser);

    if (isAdmin) {
      if (!conversationId) {
        return NextResponse.json({ error: 'Conversation is required' }, { status: 400 });
      }

      const { data: messageRecord, error: messageError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_role: 'admin',
          sender_id: user.id,
          body: message,
        })
        .select('*')
        .single();

      if (messageError) {
        return NextResponse.json({ error: messageError.message }, { status: 400 });
      }

      await supabase
        .from('conversations')
        .update({
          last_message_at: messageRecord.created_at,
          last_message_preview: messageRecord.body.slice(0, 140),
          last_sender_role: 'admin',
        })
        .eq('id', conversationId);

      return NextResponse.json({ message: messageRecord });
    }

    const { data: retailer } = await supabase
      .from('retailers')
      .select('id, company_name, business_name, account_number, phone, business_address')
      .eq('id', user.id)
      .single();

    if (!retailer) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          debug: {
            authUserId: user.id,
            authEmail: user.email,
            retailerFound: false,
          },
        },
        { status: 403 }
      );
    }

    let conversation = null as null | { id: string };
    if (conversationId) {
      const { data } = await supabase
        .from('conversations')
        .select('id')
        .eq('id', conversationId)
        .eq('retailer_id', retailer.id)
        .single();
      conversation = data;
    }

    if (!conversation) {
      const { data: createdConversation, error: conversationError } = await supabase
        .from('conversations')
        .insert({ retailer_id: retailer.id })
        .select('*')
        .single();

      if (conversationError) {
        return NextResponse.json({ error: conversationError.message }, { status: 400 });
      }

      conversation = createdConversation as { id: string };
    }

    const { data: messageRecord, error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        sender_role: 'retailer',
        sender_id: user.id,
        body: message,
      })
      .select('*')
      .single();

    if (messageError) {
      return NextResponse.json({ error: messageError.message }, { status: 400 });
    }

    await supabase
      .from('conversations')
      .update({
        last_message_at: messageRecord.created_at,
        last_message_preview: messageRecord.body.slice(0, 140),
        last_sender_role: 'retailer',
      })
      .eq('id', conversation.id);

    const businessName = retailer.company_name || retailer.business_name || 'Retailer';
    const emailText = [
      messageRecord.body,
      '',
      '--',
      `Retailer: ${businessName}`,
      `Account: ${retailer.account_number || 'Not provided'}`,
      `Email: ${user.email || 'Not provided'}`,
      `Phone: ${retailer.phone || 'Not provided'}`,
      `Address: ${retailer.business_address || 'Not provided'}`,
      `Conversation ID: ${conversation.id}`,
    ].join('\n');

    await sendTeamEmail({
      subject: `Retailer Message - ${businessName}`,
      text: emailText,
    });

    return NextResponse.json({ message: messageRecord, conversation });
  } catch (error) {
    console.error('Message send error:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
