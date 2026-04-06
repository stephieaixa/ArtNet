import { supabase } from './supabase';

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at?: string | null;
  created_at: string;
};

export type Conversation = {
  id: string;
  application_id?: string | null;
  job_id?: string | null;
  artist_user_id: string;
  other_user_id: string;
  created_at: string;
  last_message_at: string;
  // joined / computed
  other_display_name?: string;
  job_title?: string;
  last_message?: Message;
  unread_count?: number;
};

/** Fetch all conversations for current user, enriched */
export async function fetchConversations(): Promise<Conversation[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: convs } = await supabase
    .from('conversations')
    .select(`
      *,
      job:scraped_jobs(title),
      messages(id, body, sender_id, read_at, created_at)
    `)
    .or(`artist_user_id.eq.${user.id},other_user_id.eq.${user.id}`)
    .order('last_message_at', { ascending: false });

  if (!convs?.length) return [];

  // Collect all "other" user ids to batch-fetch display names
  const otherIds = convs.map((c) =>
    c.artist_user_id === user.id ? c.other_user_id : c.artist_user_id
  );
  const uniqueIds = [...new Set(otherIds)];

  const { data: profiles } = await supabase
    .from('artist_profiles')
    .select('user_id, display_name')
    .in('user_id', uniqueIds);

  const nameMap: Record<string, string> = {};
  profiles?.forEach((p) => { nameMap[p.user_id] = p.display_name; });

  return convs.map((c) => {
    const otherId = c.artist_user_id === user.id ? c.other_user_id : c.artist_user_id;
    const msgs: Message[] = (c.messages ?? []).sort(
      (a: Message, b: Message) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const unread = msgs.filter((m) => m.sender_id !== user.id && !m.read_at).length;

    return {
      id: c.id,
      application_id: c.application_id,
      job_id: c.job_id,
      artist_user_id: c.artist_user_id,
      other_user_id: c.other_user_id,
      created_at: c.created_at,
      last_message_at: c.last_message_at,
      other_display_name: nameMap[otherId] ?? 'Usuario',
      job_title: (c.job as any)?.title ?? null,
      last_message: msgs[0] ?? null,
      unread_count: unread,
    } as Conversation;
  });
}

/** Fetch messages for a conversation */
export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  return (data ?? []) as Message[];
}

/** Send a message */
export async function sendMessage(
  conversationId: string,
  body: string
): Promise<Message | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: user.id, body })
    .select()
    .single();

  return data as Message | null;
}

/** Mark all unread messages in a conversation as read */
export async function markConversationRead(conversationId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .neq('sender_id', user.id)
    .is('read_at', null);
}

/** Get single conversation (for chat screen) */
export async function fetchConversation(id: string): Promise<Conversation | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('conversations')
    .select('*, job:scraped_jobs(title)')
    .eq('id', id)
    .maybeSingle();

  if (!data) return null;

  const otherId =
    data.artist_user_id === user.id ? data.other_user_id : data.artist_user_id;

  const { data: profile } = await supabase
    .from('artist_profiles')
    .select('display_name')
    .eq('user_id', otherId)
    .maybeSingle();

  return {
    ...data,
    other_display_name: profile?.display_name ?? 'Usuario',
    job_title: (data.job as any)?.title ?? null,
  } as Conversation;
}
