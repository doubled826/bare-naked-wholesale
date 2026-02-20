'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { CheckCircle2, MessageCircle, Send, Sparkles, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

interface Conversation {
  id: string;
  retailer_id: string;
  last_message_at: string | null;
  last_message_preview: string | null;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_role: 'retailer' | 'admin';
  sender_id: string;
  body: string;
  created_at: string;
}

export default function MessagesPage() {
  const supabase = createClientComponentClient();
  const { retailer } = useAppStore();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageBody, setMessageBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const businessName = retailer?.company_name || retailer?.business_name || 'Retailer';

  useEffect(() => {
    const loadConversation = async () => {
      const { data: convo } = await supabase
        .from('conversations')
        .select('*')
        .eq('retailer_id', retailer?.id)
        .single();

      if (convo) {
        setConversation(convo as Conversation);
      }
    };

    if (retailer?.id) {
      loadConversation();
    }
  }, [supabase, retailer?.id]);

  useEffect(() => {
    const loadMessages = async () => {
      if (!conversation?.id) return;

      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true });

      setMessages((data || []) as Message[]);
    };

    loadMessages();
  }, [supabase, conversation?.id]);

  useEffect(() => {
    if (!conversation?.id) return;

    const channel = supabase
      .channel(`conversation-${conversation.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversation.id}` },
        (payload) => {
          setMessages((current) => [...current, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, conversation?.id]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!messageBody.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setStatus('idle');
    setErrorMessage('');

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageBody,
          conversationId: conversation?.id || null,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Failed to send message');
      }

      const payload = await response.json();
      if (!conversation && payload?.conversation) {
        setConversation(payload.conversation as Conversation);
      }

      setMessageBody('');
      setStatus('success');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to send message');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSendDisabled = !messageBody.trim() || isSubmitting;

  const emptyState = useMemo(() => {
    if (messages.length > 0) return null;
    return (
      <div className="flex flex-col items-center justify-center text-center py-12 text-bark-500/70">
        <div className="w-12 h-12 rounded-2xl bg-cream-200 flex items-center justify-center mb-4">
          <MessageCircle className="w-6 h-6 text-bark-500" />
        </div>
        <h3 className="text-lg font-semibold text-bark-500">Start the conversation</h3>
        <p className="max-w-md mt-2 text-sm">
          Send your first message and our team will jump in. We typically respond within one business day.
        </p>
      </div>
    );
  }, [messages.length]);

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="card relative overflow-hidden p-6 lg:p-8">
        <div className="absolute inset-0 pattern-dots opacity-40" />
        <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-bark-500/10 blur-3xl" />
        <div className="relative z-10 space-y-3">
          <p className="text-sm font-semibold text-bark-500/70 tracking-wide uppercase">Retailer Message</p>
          <h1 className="page-title">Message the Bare Naked Team</h1>
          <p className="text-bark-500/70 max-w-2xl">
            A dedicated line for {businessName}. Your messages go straight to our team and we reply in this thread.
          </p>
          <div className="flex flex-wrap items-center gap-3 text-sm text-bark-500/70">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cream-200">
              <Sparkles className="w-4 h-4" />
              High-touch support
            </span>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cream-200">
              <CheckCircle2 className="w-4 h-4" />
              Routed to the full team
            </span>
          </div>
        </div>
      </div>

      <div className="card p-6 lg:p-8 space-y-6">
        <div className="space-y-4 max-h-[420px] overflow-y-auto pr-2">
          {emptyState}
          {messages.map((msg) => {
            const isRetailer = msg.sender_role === 'retailer';
            return (
              <div
                key={msg.id}
                className={cn('flex', isRetailer ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm',
                    isRetailer
                      ? 'bg-bark-500 text-white rounded-br-md'
                      : 'bg-cream-200 text-bark-500 rounded-bl-md'
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.body}</p>
                </div>
              </div>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <textarea
              className="input min-h-[140px] pr-14"
              placeholder="Type your message..."
              value={messageBody}
              onChange={(event) => setMessageBody(event.target.value)}
            />
            <button
              type="submit"
              disabled={isSendDisabled}
              className="absolute bottom-4 right-4 inline-flex items-center justify-center w-10 h-10 rounded-full bg-bark-500 text-white shadow-lg shadow-bark-500/20 hover:bg-bark-600 transition-colors disabled:opacity-50"
              aria-label="Send message"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          {status === 'success' && (
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
              <CheckCircle2 className="w-4 h-4" />
              Message sent! We will reply here soon.
            </div>
          )}
          {status === 'error' && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              <AlertCircle className="w-4 h-4" />
              {errorMessage}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
