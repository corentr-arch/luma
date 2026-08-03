import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useRef } from 'react';
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
  const { theme, facteurTexte, profil } = useApp();

  const [messages, setMessages] = useState([]);
  const [texte, setTexte] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [interlocuteur, setInterlocuteur] = useState(interlocuteurParam || null);

  const flatListRef = useRef(null);
  const t = (size) => size * facteurTexte;

  useEffect(() => {
    chargerInterlocuteur();
    chargerMessages();
    marquerLus();
  }, [convId]);

  // ✅ Abonnement temps réel sur messages_luma
  useEffect(() => {
    const channel = supabase
      .channel(`conv_${convId}_${Date.now()}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages_luma',
        filter: `conversation_id=eq.${convId}`,
      }, (payload) => {
        setMessages(prev => {
          const existe = prev.find(m => m.id === payload.new.id);
          if (existe) return prev;
          return [...prev, payload.new];
        });
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        // Marque comme lu si c'est pas moi
        if (payload.new.auteur_id !== profil?.id) {
          supabase.from('messages_luma')
            .update({ lu: true })
            .eq('id', payload.new.id)
            .then(() => {});
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [convId, profil?.id]);

  const chargerInterlocuteur = async () => {
    if (interlocuteurParam?.prenom) return;
    try {
      const { data } = await supabase
        .from('conversation_membres')
        .select('user_id, profiles(id, prenom, avatar_url, handle)')
        .eq('conversation_id', convId)
        .neq('user_id', profil?.id);

      if (data && data.length > 0 && data[0].profiles) {
        setInterlocuteur(data[0].profiles);
      }
    } catch {}
  };

  const chargerMessages = async () => {
    setChargement(true);
    try {
      const { data, error } = await supabase
        .from('messages_luma')
        .select('id, contenu, auteur_id, lu, created_at')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Erreur chargement messages:', error);
      } else if (data) {
        setMessages(data);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 200);
      }
    } catch (e) {
      console.error('Erreur:', e);
    }
    setChargement(false);
  };

  const marquerLus = async () => {
    if (!profil?.id) return;
    try {
      await supabase
        .from('messages_luma')
        .update({ lu: true })
        .eq('conversation_id', convId)
        .neq('auteur_id', profil.id)
        .eq('lu', false);
    } catch {}
  };

  const envoyer = async () => {
    if (!texte.trim() || !profil?.id || envoi) return;
    const texteTrimme = texte.trim();
    setTexte('');
    setEnvoi(true);

    try {
      const { data, error } = await supabase
        .from('messages_luma')
        .insert({
          conversation_id: convId,
          auteur_id: profil.id,
          contenu: texteTrimme,
          lu: false,
        })
        .select()
        .single();

      if (error) {
        console.error('Erreur envoi:', error);
        setTexte(texteTrimme);
      } else if (data) {
        setMessages(prev => {
          const existe = prev.find(m => m.id === data.id);
          return existe ? prev : [...prev, data];
        });
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } catch (e) {
      console.error('Erreur:', e);
      setTexte(texteTrimme);
    }
    setEnvoi(false);
  };

  const getNom = () =>
    interlocuteur?.prenom || interlocuteur?.handle || 'Utilisateur';

  // Groupement par date
  const messagesAvecSeparateurs = [];
  let dernierJour = null;
  messages.forEach((msg, i) => {
    const jour = new Date(msg.created_at).toDateString();
    if (jour !== dernierJour) {
      messagesAvecSeparateurs.push({ type: 'sep', id: `sep_${i}`, date: msg.created_at });
      dernierJour = jour;
    }
    messagesAvecSeparateurs.push({ type: 'msg', ...msg });
  });

  const renderItem = ({ item }) => {
    if (item.type === 'sep') {
      return (
        <View style={styles.separateur}>
          <View style={[styles.sepLigne, { backgroundColor: theme.border }]} />
          <Text style={[styles.sepTexte, { color: theme.text3 }]}>
            {separateurDate(item.date)}
          </Text>
          <View style={[styles.sepLigne, { backgroundColor: theme.border }]} />
        </View>
      );
    }

    const estMoi = item.auteur_id === profil?.id;

    return (
      <View style={[styles.msgWrap, estMoi ? styles.msgMoi : styles.msgAutre]}>
        {!estMoi && (
          interlocuteur?.avatar_url ? (
            <Image source={{ uri: interlocuteur.avatar_url }} style={styles.msgAvatar} />
          ) : (
            <View style={[styles.msgAvatarPlaceholder, { backgroundColor: '#DBEAFE' }]}>
              <Text style={{ color: '#2563EB', fontSize: 12, fontWeight: '600' }}>
                {getNom()[0].toUpperCase()}
              </Text>
            </View>
          )
        )}

        <View style={[
          styles.bulle,
          estMoi ? styles.bulleMoi : [styles.bulleAutre, { backgroundColor: theme.card, borderColor: theme.border }],
        ]}>
          <Text style={[styles.bulleTexte, { color: estMoi ? '#fff' : theme.text, fontSize: t(14) }]}>
            {item.contenu}
          </Text>
          <View style={styles.bulleMeta}>
            <Text style={{ color: estMoi ? 'rgba(255,255,255,0.6)' : theme.text3, fontSize: t(10) }}>
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
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 36 }}>
          <Ionicons name="chevron-back" size={24} color="#2563EB" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerProfil}
          onPress={() => interlocuteur?.id && navigation.navigate('ProfilPublic', { userId: interlocuteur.id })}
          activeOpacity={0.7}
        >
          {interlocuteur?.avatar_url ? (
            <Image source={{ uri: interlocuteur.avatar_url }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatarPlaceholder, { backgroundColor: '#DBEAFE' }]}>
              <Text style={{ color: '#2563EB', fontSize: t(16), fontWeight: '600' }}>
                {getNom()[0].toUpperCase()}
              </Text>
            </View>
          )}
          <View>
            <Text style={[styles.headerNom, { color: theme.text, fontSize: t(15) }]}>
              {getNom()}
            </Text>
            <Text style={{ color: theme.text3, fontSize: t(11) }}>Voir le profil</Text>
          </View>
        </TouchableOpacity>

        <View style={{ width: 36 }} />
      </View>

      {/* Messages */}
      {chargement ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#2563EB" />
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.vide}>
          <View style={[styles.videIcone, { backgroundColor: theme.card }]}>
            <Ionicons name="chatbubble-outline" size={32} color={theme.text3} />
          </View>
          <Text style={[{ color: theme.text, fontSize: t(16), fontWeight: '500' }]}>
            Début de la conversation
          </Text>
          <Text style={[{ color: theme.text3, fontSize: t(13), textAlign: 'center' }]}>
            Envoie un message à {getNom()}
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
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Saisie */}
      <View style={[styles.saisie, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
        <TextInput
          style={[styles.saisieInput, {
            color: theme.text,
            backgroundColor: theme.bg,
            borderColor: theme.border,
            fontSize: t(14),
          }]}
          placeholder={`Message à ${getNom()}...`}
          placeholderTextColor={theme.text3}
          value={texte}
          onChangeText={setTexte}
          multiline
          maxLength={1000}
          onSubmitEditing={envoyer}
          returnKeyType="send"
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[styles.envoiBtn, { backgroundColor: texte.trim() ? '#2563EB' : theme.border }]}
          onPress={envoyer}
          disabled={!texte.trim() || envoi}
          activeOpacity={0.7}
        >
          {envoi
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="send" size={18} color="#fff" />
          }
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
  headerAvatar: { width: 40, height: 40, borderRadius: 20 },
  headerAvatarPlaceholder: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  headerNom: { fontWeight: '600' },
  liste: { padding: 12, paddingBottom: 8 },
  separateur: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 12 },
  sepLigne: { flex: 1, height: 0.5 },
  sepTexte: { fontSize: 11, paddingHorizontal: 4 },
  msgWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginVertical: 2 },
  msgMoi: { justifyContent: 'flex-end' },
  msgAutre: { justifyContent: 'flex-start' },
  msgAvatar: { width: 28, height: 28, borderRadius: 14, flexShrink: 0 },
  msgAvatarPlaceholder: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  bulle: { maxWidth: '75%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bulleMoi: { backgroundColor: '#2563EB', borderBottomRightRadius: 4 },
  bulleAutre: { borderBottomLeftRadius: 4, borderWidth: 0.5 },
  bulleTexte: { lineHeight: 20 },
  bulleMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, justifyContent: 'flex-end' },
  vide: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  videIcone: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  saisie: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    padding: 10, paddingHorizontal: 12, borderTopWidth: 0.5,
    paddingBottom: Platform.OS === 'ios' ? 28 : 10,
  },
  saisieInput: {
    flex: 1, borderRadius: 22, paddingHorizontal: 16,
    paddingVertical: 10, borderWidth: 0.5,
    maxHeight: 120, minHeight: 44,
  },
  envoiBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
});