import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../../src/stores/authStore';
import { supabase } from '../../src/services/supabase';
import {
  fetchConversation, fetchMessages, sendMessage, markConversationRead,
  type Message, type Conversation,
} from '../../src/services/messages';
import { COLORS, FONTS, SPACING, RADIUS } from '../../src/constants/theme';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const [conv, setConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!id) return;
    init();
  }, [id]);

  async function init() {
    setLoading(true);
    const [c, msgs] = await Promise.all([
      fetchConversation(id!),
      fetchMessages(id!),
    ]);
    setConv(c);
    setMessages(msgs);
    setLoading(false);
    await markConversationRead(id!);

    // Subscribe to new messages
    const channel = supabase
      .channel(`chat:${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${id}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages(prev => {
            if (prev.find(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          // Mark as read if it's from the other person
          if (newMsg.sender_id !== user?.id) {
            markConversationRead(id!);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }

  async function handleSend() {
    if (!body.trim() || !id) return;
    const text = body.trim();
    setBody('');
    setSending(true);
    const msg = await sendMessage(id, text);
    setSending(false);
    if (msg) {
      setMessages(prev => [...prev, msg]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [loading]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <StatusBar style="dark" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <View style={s.headerInfo}>
          <Text style={s.headerName}>{conv?.other_display_name ?? 'Chat'}</Text>
          {conv?.job_title ? (
            <Text style={s.headerSub} numberOfLines={1}>📋 {conv.job_title}</Text>
          ) : null}
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={item => item.id}
        contentContainerStyle={s.messages}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const isMe = item.sender_id === user?.id;
          return (
            <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleOther]}>
              <Text style={[s.bubbleText, isMe ? s.bubbleTextMe : s.bubbleTextOther]}>
                {item.body}
              </Text>
              <Text style={[s.bubbleTime, isMe && s.bubbleTimeMe]}>
                {new Date(item.created_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                {isMe && item.read_at ? ' ✓✓' : ''}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={s.emptyMsgs}>
            <Text style={s.emptyText}>Empezá la conversación 👋</Text>
          </View>
        }
      />

      {/* Input */}
      <View style={s.inputBar}>
        <TextInput
          style={s.input}
          placeholder="Escribí un mensaje..."
          value={body}
          onChangeText={setBody}
          multiline
          maxLength={1000}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[s.sendBtn, (!body.trim() || sending) && s.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!body.trim() || sending}
          activeOpacity={0.8}
        >
          {sending
            ? <ActivityIndicator color={COLORS.white} size="small" />
            : <Text style={s.sendBtnText}>→</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingHorizontal: SPACING.xl, paddingTop: 56, paddingBottom: SPACING.base,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  backBtn: { padding: SPACING.sm },
  backText: { fontSize: 22, color: COLORS.text },
  headerInfo: { flex: 1 },
  headerName: { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.text },
  headerSub: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 1 },
  messages: { padding: SPACING.base, gap: SPACING.sm, paddingBottom: SPACING.xl },
  bubble: {
    maxWidth: '78%', borderRadius: RADIUS.xl,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.base,
  },
  bubbleMe: {
    alignSelf: 'flex-end', backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    alignSelf: 'flex-start', backgroundColor: COLORS.white,
    borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: COLORS.borderLight,
  },
  bubbleText: { fontSize: FONTS.sizes.base, lineHeight: 20 },
  bubbleTextMe: { color: COLORS.white },
  bubbleTextOther: { color: COLORS.text },
  bubbleTime: { fontSize: 10, color: 'rgba(0,0,0,0.4)', marginTop: 3, textAlign: 'right' },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.7)' },
  emptyMsgs: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: FONTS.sizes.base, color: COLORS.textSecondary },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.sm,
    padding: SPACING.base, paddingBottom: Platform.OS === 'ios' ? 28 : SPACING.base,
    backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.borderLight,
  },
  input: {
    flex: 1, backgroundColor: COLORS.background, borderRadius: RADIUS.xl,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.base,
    fontSize: FONTS.sizes.base, color: COLORS.text, maxHeight: 120,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: COLORS.white, fontSize: 20, fontWeight: '700', lineHeight: 24 },
});
