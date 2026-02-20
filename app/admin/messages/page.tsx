'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { AlertCircle, MessageCircle, Send, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Conversation {
  id: string;
  retailer_id: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  retailer?: {
    id: string;
    company_name: string;
    account_number: string;
  } | null;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_role: 'retailer' | 'admin';
  sender_id: string;
  body: string;
  created_at: string;
}

export default function AdminMessagesPage() {
  const supabase = createClientComponentClient();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageBody, setMessageBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const loadConversations = async () => {
      const { data } = await supabase
        .from('conversations')
        .select('id, retailer_id, last_message_at, last_message_preview, retailer:retailers(id, company_name, account_number)')
        .order('last_message_at', { ascending: false, nullsFirst: true });

      const normalized = (data || []).map((item: any) => ({
        ...item,
        retailer: Array.isArray(item.retailer) ? item.retailer[0] ?? null : item.retailer ?? null,
      })) as Conversation[];

      setConversations(normalized);
      if (normalized.length > 0) {
        setActiveConversation((current) => current ?? normalized[0]);
      }
    };

    loadConversations();
  }, [supabase]);

  useEffect(() => {
    const loadMessages = async () => {
      if (!activeConversation?.id) {
        setMessages([]);
        return;
      }

      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', activeConversation.id)
        .order('created_at', { ascending: true });

      setMessages((data || []) as Message[]);
    };

    loadMessages();
  }, [supabase, activeConversation?.id]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-conversations')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' }, (payload) => {
        const incoming = payload.new as Conversation;
        setConversations((current) => [incoming, ...current]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, (payload) => {
        const updated = payload.new as Conversation;
        setConversations((current) => {
          const next = current.filter((item) => item.id !== updated.id);
          return [updated, ...next];
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  useEffect(() => {
    if (!activeConversation?.id) return;

    const channel = supabase
      .channel(`admin-messages-${activeConversation.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConversation.id}` },
        (payload) => {
          setMessages((current) => [...current, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, activeConversation?.id]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!messageBody.trim() || isSubmitting || !activeConversation) return;

    setIsSubmitting(true);
    setStatus('idle');
    setErrorMessage('');

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageBody,
          conversationId: activeConversation.id,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Failed to send message');
      }

      setMessageBody('');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to send message');
    } finally {
      setIsSubmitting(false);
    }
  };

  const emptyState = useMemo(() => {
    if (conversations.length > 0) return null;
    return (
      <div className="flex flex-col items-center justify-center text-center py-16 text-gray-600">
        <div className="w-12 h-12 rounded-2xl bg-bark-100 flex items-center justify-center mb-4">
          <MessageCircle className="w-6 h-6 text-bark-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">No retailer messages yet</h3>
        <p className="max-w-md mt-2 text-sm">
          Conversations will appear here as retailers reach out. Once a message arrives, you can respond in this
          thread.
        </p>
      </div>
    );
  }, [conversations.length]);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-bark-100 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-bark-500" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900" style={{ fontFamily: 'var(--font-poppins)' }}>
              Retailer Conversations
            </h1>
            <p className="text-sm text-gray-600">High-touch support in one shared inbox.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3 max-h-[620px] overflow-y-auto">
          {conversations.length === 0 && (
            <div className="text-sm text-gray-500">Waiting for retailer messages...</div>
          )}
          {conversations.map((conversation) => {
            const isActive = activeConversation?.id === conversation.id;
            return (
              <button
                key={conversation.id}
                onClick={() => setActiveConversation(conversation)}
                className={cn(
                  'w-full text-left p-4 rounded-xl border transition-colors',
                  isActive
                    ? 'border-bark-500 bg-bark-50'
                    : 'border-gray-100 hover:border-bark-200 hover:bg-bark-50/40'
                )}
              >
                <p className="font-semibold text-gray-900">
                  {conversation.retailer?.company_name || 'Retailer'}
                </p>
                <p className="text-xs text-gray-500">{conversation.retailer?.account_number || 'Account pending'}</p>
                <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                  {conversation.last_message_preview || 'No messages yet'}
                </p>
              </button>
            );
          })}
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 flex flex-col min-h-[520px]">
          {!activeConversation && emptyState}
          {activeConversation && (
            <>
              <div className="border-b border-gray-100 pb-4 mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  {activeConversation.retailer?.company_name || 'Retailer'}
                </h2>
                <p className="text-sm text-gray-500">{activeConversation.retailer?.account_number || ''}</p>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto pr-2">
                {messages.map((msg) => {
                  const isAdmin = msg.sender_role === 'admin';
                  return (
                    <div key={msg.id} className={cn('flex', isAdmin ? 'justify-end' : 'justify-start')}>
                      <div
                        className={cn(
                          'max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm',
                          isAdmin
                            ? 'bg-bark-500 text-white rounded-br-md'
                            : 'bg-bark-50 text-gray-800 rounded-bl-md'
                        )}
                      >
                        <p className="whitespace-pre-wrap">{msg.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <form onSubmit={handleSubmit} className="pt-4 border-t border-gray-100 mt-4">
                <div className="relative">
                  <textarea
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 min-h-[120px] focus:outline-none focus:ring-2 focus:ring-bark-500/30 focus:border-bark-500"
                    placeholder="Write a reply..."
                    value={messageBody}
                    onChange={(event) => setMessageBody(event.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={!messageBody.trim() || isSubmitting}
                    className="absolute bottom-4 right-4 inline-flex items-center justify-center w-10 h-10 rounded-full bg-bark-500 text-white shadow-lg shadow-bark-500/20 hover:bg-bark-600 transition-colors disabled:opacity-50"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
                {status === 'error' && (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mt-3">
                    <AlertCircle className="w-4 h-4" />
                    {errorMessage}
                  </div>
                )}
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
