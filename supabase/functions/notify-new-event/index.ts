import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

serve(async (req) => {
  try {
    const body = await req.json();
    const record = body.record;

    if (!record) {
      return new Response('no record', { status: 200 });
    }

    // Ignore les événements privés, suspendus ou non publics
    if (record.visibilite !== 'public' || record.suspendu === true) {
      return new Response('ignored', { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Récupère le profil du créateur
    const { data: createur } = await supabase
      .from('profiles')
      .select('prenom')
      .eq('id', record.auteur_id)
      .single();

    const prenomCreateur = createur?.prenom || 'Quelqu\'un';

    // Récupère toutes les préférences actives avec la catégorie correspondante
    const { data: preferences, error: prefError } = await supabase
      .from('preferences_notifications')
      .select(`
        user_id,
        categories,
        rayon_notifications,
        profiles:user_id (
          push_token
        )
      `)
      .eq('actif', true)
      .neq('user_id', record.auteur_id);

    if (prefError || !preferences || preferences.length === 0) {
      return new Response('no preferences', { status: 200 });
    }

    // Filtre par catégorie et par rayon
    const pushMessages: any[] = [];
    const notificationsAInserer: any[] = [];

    for (const pref of preferences) {
      // Vérifie que la catégorie est dans les préférences
      const categories = pref.categories || [];
      if (!categories.includes(record.categorie)) continue;

      // Calcule la distance entre l'événement et... on utilise le rayon préféré
      // Pour la beta on notifie tous ceux qui ont la catégorie active
      // Le rayon sera affiné avec la position GPS stockée en V2
      const rayon = pref.rayon_notifications || 5000;

      const token = (pref.profiles as any)?.push_token;

      // Crée la notification en base
      notificationsAInserer.push({
        user_id: pref.user_id,
        titre: `Nouvel événement : ${record.titre}`,
        corps: `${prenomCreateur} organise "${record.titre}" — ${record.lieu}`,
        type: 'nouvel_evenement',
        evenement_id: record.id,
        lu: false,
      });

      // Prépare le push si token valide
      if (token && typeof token === 'string' && token.startsWith('ExponentPushToken')) {
        pushMessages.push({
          to: token,
          title: `📍 ${record.categorie} près de toi`,
          body: `${record.titre} — ${record.lieu}`,
          data: {
            evenementId: record.id,
            type: 'nouvel_evenement',
          },
          sound: 'default',
          badge: 1,
          priority: 'normal',
          channelId: 'default',
        });
      }
    }

    // Sauvegarde toutes les notifications en base
    if (notificationsAInserer.length > 0) {
      const { error: insertError } = await supabase
        .from('notifications')
        .insert(notificationsAInserer);

      if (insertError) {
        console.error('Erreur insertion notifications:', insertError);
      }
    }

    // Envoie les pushs par batch de 100 (limite Expo)
    if (pushMessages.length > 0) {
      const batches: any[][] = [];
      for (let i = 0; i < pushMessages.length; i += 100) {
        batches.push(pushMessages.slice(i, i + 100));
      }

      const results = await Promise.allSettled(
        batches.map(batch =>
          fetch(EXPO_PUSH_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify(batch),
          })
        )
      );

      for (const result of results) {
        if (result.status === 'rejected') {
          console.error('Erreur envoi push:', result.reason);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        notifications_inserees: notificationsAInserer.length,
        pushs_envoyes: pushMessages.length,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Edge Function error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});