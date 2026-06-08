import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../AppContext';
import { supabase } from '../supabase';

function formatHeure(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const auj = new Date(); auj.setHours(0, 0, 0, 0);
  const hier = new Date(auj); hier.setDate(hier.getDate() - 1);
  if (d >= auj) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (d >= hier) return `Hier ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function separateurDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const auj = new Date(); auj.setHours(0, 0, 0, 0);
  const hier = new Date(auj); hier.setDate(hier.getDate() - 1);
  if (d >= auj) return "Aujourd'hui";
  if (d >= hier) return 'Hier';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function ConversationScreen({ route, navigation }) {
  const { convId, interlocuteur: interlocuteurParam } = route.params;
  const { theme, facteurTexte } = useApp();

  const [messages, setMessages] = useState([]);
  const [texte, setTexte] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [userActuel, setUserActuel] = useState(null);
  const [interlocuteur, setInterlocuteur] = useState(interlocuteurParam || null);

  const flatListRef = useRef(null);
  const t = (size) => size * facteurTexte;

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserActuel(user);
      if (user) {
        await chargerMessages(user.id);
        await marquerLus(user.id);
        if (!interlocuteurParam) await chargerInterlocuteur(user.id);
      }
    })();
  }, [convId]);

  const chargerInterlocuteur = async (monId) => {
    try {
      const { data } = await supabase
        .from('conversation_membres')
        .select('profiles (id, pseudo, avatar_url)')
        .eq('conversation_id', convId)
        .neq('user_id', monId)
        .single();
      if (data?.profiles) setInterlocuteur(data.profiles);
    } catch {}
  };

  const chargerMessages = async (monId) => {
    try {
      const { data } = await supabase
        .from('messages')
        .select(`
          id, texte, auteur_id, created_at, lu,
          profiles:auteur_id (pseudo, avatar_url)
        `)
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });

      if (data) setMessages(data);
    } catch (e) {
      console.log('Erreur chargement messages:', e);
    }
    setChargement(false);
  };

  const marquerLus = async (monId) => {
    try {
      await supabase
        .from('messages')
        .update({ lu: true })
        .eq('conversation_id', convId)
        .neq('auteur_id', monId)
        .eq('lu', false);
    } catch {}
  };

  // Abonnement temps réel
  useEffect(() => {
    if (!userActuel) return;

    const channel = supabase
      .channel(`conv_${convId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${convId}`,
      }, async (payload) => {
        // Récupère le profil de l'auteur
        const { data: profil } = await supabase
          .from('profiles')
          .select('pseudo, avatar_url')
          .eq('id', payload.new.auteur_id)
          .single();

        const nvMsg = { ...payload.new, profiles: profil };
        setMessages(prev => [...prev, nvMsg]);

        // Marque comme lu si c'est pas moi
        if (payload.new.auteur_id !== userActuel.id) {
          await supabase
            .from('messages')
            .update({ lu: true })
            .eq('id', payload.new.id);
        }

        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [convId, userActuel]);

  // Scroll vers le bas au chargement
  useEffect(() => {
    if (!chargement && messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 200);
    }
  }, [chargement]);

  const envoyer = async () => {
    if (!texte.trim() || !userActuel || envoi) return;
    const texteTrimme = texte.trim();
    setTexte('');
    setEnvoi(true);

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: convId,
          auteur_id: userActuel.id,
          texte: texteTrimme,
          lu: false,
        })
        .select()
        .single();

      if (error) throw error;

      // Mise à jour optimiste
      const nvMsg = {
        ...data,
        profiles: { pseudo: 'Moi', avatar_url: null },
      };
      setMessages(prev => {
        const existe = prev.find(m => m.id === nvMsg.id);
        return existe ? prev : [...prev, nvMsg];
      });

      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      console.log('Erreur envoi:', e);
      setTexte(texteTrimme);
    }
    setEnvoi(false);
  };

  // Groupe les messages par date
  const messagesAvecSeparateurs = [];
  let dernierJour = null;
  messages.forEach((msg, i) => {
    const jour = new Date(msg.created_at).toDateString();
    if (jour !== dernierJour) {
      messagesAvecSeparateurs.push({ type: 'separateur', id: `sep_${i}`, date: msg.created_at });
      dernierJour = jour;
    }
    messagesAvecSeparateurs.push({ type: 'message', ...msg });
  });

  const renderItem = ({ item }) => {
    if (item.type === 'separateur') {
      return (
        <View style={styles.separateur}>
          <View style={[styles.separateurLigne, { backgroundColor: theme.border }]} />
          <Text style={[styles.separateurTexte, { color: theme.text3, backgroundColor: theme.bg }]}>
            {separateurDate(item.date)}
          </Text>
          <View style={[styles.separateurLigne, { backgroundColor: theme.border }]} />
        </View>
      );
    }

    const estMoi = item.auteur_id === userActuel?.id;

    return (
      <View style={[styles.msgWrap, estMoi ? styles.msgWrapMoi : styles.msgWrapAutre]}>
        {!estMoi && (
          <View style={styles.msgAvatarWrap}>
            {item.profiles?.avatar_url ? (
              <Image source={{ uri: item.profiles.avatar_url }} style={styles.msgAvatar} />
            ) : (
              <View style={[styles.msgAvatarPlaceholder, { backgroundColor: '#DBEAFE' }]}>
                <Text style={{ color: '#2563EB', fontSize: t(11), fontWeight: '600' }}>
                  {(item.profiles?.pseudo || interlocuteur?.pseudo || 'U')[0].toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={[
          styles.msgBulle,
          estMoi
            ? [styles.msgBulleMoi, { backgroundColor: '#2563EB' }]
            : [styles.msgBulleAutre, { backgroundColor: theme.card, borderColor: theme.border }],
        ]}>
          <Text style={[
            styles.msgTexte,
            { color: estMoi ? '#fff' : theme.text, fontSize: t(14) },
          ]}>
            {item.texte}
          </Text>
          <View style={styles.msgMeta}>
            <Text style={[
              styles.msgHeure,
              { color: estMoi ? 'rgba(255,255,255,0.65)' : theme.text3, fontSize: t(10) },
            ]}>
              {formatHeure(item.created_at)}
            </Text>
            {estMoi && (
              <Ionicons
                name={item.lu ? 'checkmark-done' : 'checkmark'}
                size={12}
                color={item.lu ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)'}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 36 }}>
          <Ionicons name="chevron-back" size={24} color="#2563EB" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerProfil}
          onPress={() => interlocuteur?.id && navigation.navigate('ProfilPublic', { userId: interlocuteur.id })}
        >
          {interlocuteur?.avatar_url ? (
            <Image source={{ uri: interlocuteur.avatar_url }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatarPlaceholder, { backgroundColor: '#DBEAFE' }]}>
              <Text style={{ color: '#2563EB', fontSize: t(15), fontWeight: '600' }}>
                {(interlocuteur?.pseudo || 'U')[0].toUpperCase()}
              </Text>
            </View>
          )}
          <View>
            <Text style={[styles.headerNom, { color: theme.text, fontSize: t(15) }]}>
              {interlocuteur?.pseudo || 'Utilisateur'}
            </Text>
            <Text style={{ color: theme.text3, fontSize: t(11) }}>Voir le profil</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.headerAction, { backgroundColor: theme.bg }]}
          onPress={() => interlocuteur?.id && navigation.navigate('ProfilPublic', { userId: interlocuteur.id })}
        >
          <Ionicons name="person-outline" size={18} color={theme.text} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      {chargement ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#2563EB" />
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.vide}>
          <View style={[styles.videIcone, { backgroundColor: theme.card }]}>
            <Ionicons name="chatbubble-outline" size={28} color={theme.text3} />
          </View>
          <Text style={[styles.videTexte, { color: theme.text, fontSize: t(15) }]}>
            Début de la conversation
          </Text>
          <Text style={[styles.videDesc, { color: theme.text3, fontSize: t(13) }]}>
            Envoie un message à {interlocuteur?.pseudo || 'cet utilisateur'}
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messagesAvecSeparateurs}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.liste}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      {/* Saisie */}
      <View style={[styles.saisieWrap, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
        <TextInput
          style={[styles.saisieInput, {
            color: theme.text,
            backgroundColor: theme.bg,
            borderColor: theme.border,
            fontSize: t(14),
          }]}
          placeholder="Message..."
          placeholderTextColor={theme.text3}
          value={texte}
          onChangeText={setTexte}
          multiline
          maxLength={1000}
          onSubmitEditing={envoyer}
        />
        <TouchableOpacity
          style={[styles.envoiBtn, {
            backgroundColor: texte.trim() ? '#2563EB' : theme.border,
          }]}
          onPress={envoyer}
          disabled={!texte.trim() || envoi}
        >
          {envoi ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, paddingTop: 56, borderBottomWidth: 0.5,
  },
  headerProfil: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: { width: 38, height: 38, borderRadius: 19 },
  headerAvatarPlaceholder: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  headerNom: { fontWeight: '500' },
  headerAction: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  liste: { padding: 12, gap: 4, paddingBottom: 8 },
  separateur: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginVertical: 12,
  },
  separateurLigne: { flex: 1, height: 0.5 },
  separateurTexte: { fontSize: 11, paddingHorizontal: 8 },
  msgWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginVertical: 2 },
  msgWrapMoi: { justifyContent: 'flex-end' },
  msgWrapAutre: { justifyContent: 'flex-start' },
  msgAvatarWrap: {},
  msgAvatar: { width: 28, height: 28, borderRadius: 14 },
  msgAvatarPlaceholder: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  msgBulle: {
    maxWidth: '75%', borderRadius: 18, padding: 10, paddingHorizontal: 14,
  },
  msgBulleMoi: { borderBottomRightRadius: 4, borderWidth: 0 },
  msgBulleAutre: { borderBottomLeftRadius: 4, borderWidth: 0.5 },
  msgTexte: { lineHeight: 20 },
  msgMeta: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 3, justifyContent: 'flex-end',
  },
  msgHeure: {},
  vide: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  videIcone: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  videTexte: { fontWeight: '500' },
  videDesc: { textAlign: 'center', color: '#888', lineHeight: 20 },
  saisieWrap: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    padding: 10, paddingHorizontal: 12, borderTopWidth: 0.5,
  },
  saisieInput: {
    flex: 1, borderRadius: 22, paddingHorizontal: 14,
    paddingVertical: 10, borderWidth: 0.5,
    maxHeight: 120, minHeight: 42,
  },
  envoiBtn: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
  },
});