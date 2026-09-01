import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { user_id, titre, corps, data } = await req.json();

    if (!user_id || !titre) {
      return new Response(
        JSON.stringify({ error: 'user_id et titre requis' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: profil } = await supabase
      .from('profiles')
      .select('push_token, prenom')
      .eq('id', user_id)
      .single();

    if (!profil?.push_token) {
      return new Response(
        JSON.stringify({ ok: false, raison: 'pas de token push' }),
        { status: 200, headers: corsHeaders }
      );
    }

    const message = {
      to: profil.push_token,
      title: titre,
      body: corps || '',
      data: data || {},
      sound: 'default',
      badge: 1,
      priority: 'high',
      channelId: 'default',
    };

    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(message),
    });

    const result = await res.json();

    // Insère une notification en base
    await supabase.from('notifications').insert({
      user_id,
      titre,
      corps: corps || '',
      type: data?.type || 'systeme',
      lu: false,
      evenement_id: data?.evenement_id || null,
      conv_id: data?.conv_id || null,
    });

    return new Response(
      JSON.stringify({ ok: true, result }),
      { status: 200, headers: corsHeaders }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
