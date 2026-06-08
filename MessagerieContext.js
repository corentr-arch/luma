import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './supabase';

const MessagerieContext = createContext();

export function MessagerieProvider({ children }) {
  const [conversations, setConversations] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [userId, setUserId] = useState(null);
  const userIdRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        userIdRef.current = user.id;
        await chargerConversations(user.id);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) {
        setUserId(session.user.id);
        userIdRef.current = session.user.id;
        chargerConversations(session.user.id);
      } else {
        setUserId(null);
        userIdRef.current = null;
        setConversations([]);
      }
    });

    init();
    return () => subscription.unsubscribe();
  }, []);

  const chargerConversations = useCallback(async (uid) => {
    const currentUid = uid || userIdRef.current;
    if (!currentUid) return;

    try {
      const { data: membres, error } = await supabase
        .from('conversation_membres')
        .select('conversation_id')
        .eq('user_id', currentUid);

      if (error || !membres || membres.length === 0) {
        setConversations([]);
        setChargement(false);
        return;
      }

      const convIds = membres.map(m => m.conversation_id);

      const { data: convs, error: convError } = await supabase
        .from('conversations')
        .select('id, nom, type, evenement_id')
        .in('id', convIds)
        .order('id', { ascending: false });

      if (convError) { setChargement(false); return; }

      const convsAvecMessages = await Promise.all((convs || []).map(async (conv) => {
        const { data: msgs } = await supabase
          .from('messages')
          .select('id, texte, created_at, auteur_id, profiles:auteur_id(prenom)')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: true })
          .limit(50);

        return {
          id: conv.id,
          nom: conv.nom,
          type: conv.type,
          evenementId: conv.evenement_id,
          messages: (msgs || []).map(m => ({
            id: m.id,
            auteur: m.profiles?.prenom || 'Utilisateur',
            texte: m.texte,
            heure: new Date(m.created_at).toLocaleTimeString('fr-FR', {
              hour: '2-digit', minute: '2-digit',
            }),
            moi: m.auteur_id === currentUid,
          })),
          nonLus: 0,
          avatar: (conv.nom || '?')[0].toUpperCase(),
        };
      }));

      setConversations(convsAvecMessages);
    } catch (e) {
      // Silencieux en production
    }
    setChargement(false);
  }, []);

  // Temps réel — récupère le prénom depuis profiles
  useEffect(() => {
    if (!userId) return;

    const subscription = supabase
      .channel('messages_realtime')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
      }, async (payload) => {
        const newMsg = payload.new;

        // Récupère le prénom de l'auteur
        let prenomAuteur = 'Utilisateur';
        try {
          const { data: profil } = await supabase
            .from('profiles').select('prenom').eq('id', newMsg.auteur_id).single();
          if (profil?.prenom) prenomAuteur = profil.prenom;
        } catch {}

        const heure = new Date(newMsg.created_at).toLocaleTimeString('fr-FR', {
          hour: '2-digit', minute: '2-digit',
        });
        const moi = newMsg.auteur_id === userIdRef.current;

        setConversations(prev => prev.map(conv => {
          if (conv.id !== newMsg.conversation_id) return conv;
          if (conv.messages.some(m => m.id === newMsg.id)) return conv;
          return {
            ...conv,
            messages: [...conv.messages, {
              id: newMsg.id,
              auteur: prenomAuteur,
              texte: newMsg.texte,
              heure,
              moi,
            }],
            nonLus: moi ? conv.nonLus : conv.nonLus + 1,
          };
        }));
      })
      .subscribe();

    return () => supabase.removeChannel(subscription);
  }, [userId]);

  const envoyerMessage = useCallback(async (convId, texte) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('messages').insert({
      conversation_id: convId,
      auteur_id: user.id,
      texte: texte.trim(),
    });
  }, []);

  const marquerLu = useCallback((convId) => {
    setConversations(prev => prev.map(c =>
      c.id === convId ? { ...c, nonLus: 0 } : c
    ));
  }, []);

  const getConversation = useCallback((id) =>
    conversations.find(c => c.id === id),
  [conversations]);

  const totalNonLus = conversations.reduce((acc, c) => acc + (c.nonLus || 0), 0);

  return (
    <MessagerieContext.Provider value={{
      conversations, envoyerMessage, marquerLu,
      getConversation, totalNonLus, chargement,
      chargerConversations: () => chargerConversations(userIdRef.current),
    }}>
      {children}
    </MessagerieContext.Provider>
  );
}

export function useMessagerie() { return useContext(MessagerieContext); }