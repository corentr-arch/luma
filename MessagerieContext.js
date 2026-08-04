import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

const MessagerieContext = createContext();

// Configure les notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function MessagerieProvider({ children }) {
  const [totalNonLus, setTotalNonLus] = useState(0);
  const [userId, setUserId] = useState(null);
  const userIdRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        userIdRef.current = user.id;
        await chargerNonLus(user.id);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) {
        setUserId(session.user.id);
        userIdRef.current = session.user.id;
        chargerNonLus(session.user.id);
      } else {
        setUserId(null);
        userIdRef.current = null;
        setTotalNonLus(0);
      }
    });

    // Recharge quand app revient au premier plan
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        if (userIdRef.current) chargerNonLus(userIdRef.current);
      }
      appStateRef.current = nextState;
    });

    init();
    return () => {
      subscription.unsubscribe();
      appStateSub.remove();
    };
  }, []);

  const chargerNonLus = useCallback(async (uid) => {
    const currentUid = uid || userIdRef.current;
    if (!currentUid) return;
    try {
      const { data: membres } = await supabase
        .from('conversation_membres')
        .select('conversation_id')
        .eq('user_id', currentUid);

      if (!membres?.length) { setTotalNonLus(0); return; }

      const convIds = membres.map(m => m.conversation_id);
      const { count } = await supabase
        .from('messages_luma')
        .select('id', { count: 'exact', head: true })
        .in('conversation_id', convIds)
        .neq('auteur_id', currentUid)
        .eq('lu', false);

      setTotalNonLus(count || 0);
    } catch {}
  }, []);

  // Temps réel — écoute messages_luma
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`nonlus_${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages_luma',
      }, async (payload) => {
        if (payload.new.auteur_id === userIdRef.current) return;

        setTotalNonLus(n => n + 1);

        // ✅ Notification push si app en arrière-plan
        if (appStateRef.current !== 'active') {
          try {
            // Récupère le prénom de l'expéditeur
            const { data: auteur } = await supabase
              .from('profiles')
              .select('prenom')
              .eq('id', payload.new.auteur_id)
              .single();

            await Notifications.scheduleNotificationAsync({
              content: {
                title: auteur?.prenom || 'Nouveau message',
                body: payload.new.contenu?.slice(0, 80) || 'Tu as reçu un message',
                data: { convId: payload.new.conversation_id },
                sound: 'default',
              },
              trigger: null,
            });
          } catch {}
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages_luma',
      }, () => {
        chargerNonLus(userIdRef.current);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [userId]);

  const marquerLu = useCallback(async (convId) => {
    const uid = userIdRef.current;
    if (!uid || !convId) return;
    try {
      await supabase
        .from('messages_luma')
        .update({ lu: true })
        .eq('conversation_id', convId)
        .neq('auteur_id', uid)
        .eq('lu', false);
      await chargerNonLus(uid);
    } catch {}
  }, []);

  return (
    <MessagerieContext.Provider value={{
      totalNonLus,
      marquerLu,
      chargerNonLus: () => chargerNonLus(userIdRef.current),
    }}>
      {children}
    </MessagerieContext.Provider>
  );
}

export function useMessagerie() { return useContext(MessagerieContext); }