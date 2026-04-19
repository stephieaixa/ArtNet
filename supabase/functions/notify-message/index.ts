import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const APP_URL = 'https://artnet-circus.vercel.app';

Deno.serve(async (req) => {
  // Supabase database webhooks send a POST with the record payload
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const payload = await req.json();
    const message = payload.record; // new message row

    if (!message?.id || !message?.conversation_id || !message?.sender_id || !message?.body) {
      return new Response('Invalid payload', { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 1. Get the conversation to find the recipient
    const { data: conv } = await supabase
      .from('conversations')
      .select('artist_user_id, other_user_id')
      .eq('id', message.conversation_id)
      .single();

    if (!conv) return new Response('Conversation not found', { status: 404 });

    // 2. Recipient is the other person (not the sender)
    const recipientId = conv.artist_user_id === message.sender_id
      ? conv.other_user_id
      : conv.artist_user_id;

    // 3. Get sender display name from artist_profiles (fallback to email)
    const { data: senderProfile } = await supabase
      .from('artist_profiles')
      .select('display_name')
      .eq('user_id', message.sender_id)
      .maybeSingle();

    // Also check venue_profiles
    let senderName = senderProfile?.display_name;
    if (!senderName) {
      const { data: venueProfile } = await supabase
        .from('venue_profiles')
        .select('venue_name')
        .eq('user_id', message.sender_id)
        .maybeSingle();
      senderName = venueProfile?.venue_name;
    }

    // 4. Get recipient email via admin auth API
    const { data: recipientData } = await supabase.auth.admin.getUserById(recipientId);
    const recipientEmail = recipientData?.user?.email;

    if (!recipientEmail) return new Response('Recipient email not found', { status: 404 });

    // 5. Get sender email as fallback for name
    if (!senderName) {
      const { data: senderData } = await supabase.auth.admin.getUserById(message.sender_id);
      senderName = senderData?.user?.email?.split('@')[0] ?? 'Alguien';
    }

    // 6. Build the conversation deep link
    const conversationUrl = `${APP_URL}/chat/${message.conversation_id}`;

    // 7. Send email via Resend
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'ArtNet <onboarding@resend.dev>',
        to: [recipientEmail],
        subject: `💬 Nuevo mensaje de ${senderName} en ArtNet`,
        html: `
          <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h1 style="color: #6C3CE1; font-size: 24px; margin: 0;">ArtNet</h1>
              <p style="color: #6B7280; margin: 4px 0 0;">La red del espectáculo</p>
            </div>

            <div style="background: #F8F7FF; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
              <p style="margin: 0 0 8px; color: #6B7280; font-size: 13px;">Mensaje de <strong style="color: #1A1A2E;">${senderName}</strong></p>
              <p style="margin: 0; color: #1A1A2E; font-size: 15px; line-height: 1.5; background: white; border-radius: 8px; padding: 12px; border-left: 3px solid #6C3CE1;">
                ${message.body.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
              </p>
            </div>

            <a href="${conversationUrl}"
               style="display: block; background: #6C3CE1; color: white; text-align: center;
                      text-decoration: none; padding: 14px 24px; border-radius: 10px;
                      font-weight: 700; font-size: 15px;">
              Contestar mensaje →
            </a>

            <p style="color: #9CA3AF; font-size: 11px; text-align: center; margin-top: 24px;">
              ArtNet · La red que conecta artistas escénicos con el mundo
            </p>
          </div>
        `,
      }),
    });

    if (!emailRes.ok) {
      const err = await emailRes.text();
      console.error('[notify-message] Resend error:', err);
      return new Response('Email failed', { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[notify-message] Error:', err);
    return new Response('Internal error', { status: 500 });
  }
});
