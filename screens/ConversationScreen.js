import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, Image, ActivityIndicator,
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
  const { facteurTexte, profil } = useApp();
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

  useEffect(() => {
    const channel = supabase.channel(`conv_${convId}_${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages_luma', filter: `conversation_id=eq.${convId}` },
        (payload) => {
          setMessages(prev => {
            if (prev.find(m => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
          if (payload.new.auteur_id !== profil?.id) {
            supabase.from('messages_luma').update({ lu: true }).eq('id', payload.new.id).then(() => {});
          }
        })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [convId, profil?.id]);

  const chargerInterlocuteur = async () => {
    if (interlocuteurParam?.prenom) return;
    try {
      const { data } = await supabase.from('conversation_membres')
        .select('user_id, profiles(id, prenom, avatar_url)').eq('conversation_id', convId).neq('user_id', profil?.id);
      if (data?.[0]?.profiles) setInterlocuteur(data[0].profiles);
    } catch {}
  };

  const chargerMessages = async () => {
    setChargement(true);
    try {
      const { data } = await supabase.from('messages_luma')
        .select('id, contenu, auteur_id, lu, created_at').eq('conversation_id', convId)
        .order('created_at', { ascending: true });
      if (data) { setMessages(data); setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 200); }
    } catch {}
    setChargement(false);
  };

  const marquerLus = async () => {
    if (!profil?.id) return;
    try {
      await supabase.from('messages_luma').update({ lu: true })
        .eq('conversation_id', convId).neq('auteur_id', profil.id).eq('lu', false);
    } catch {}
  };

  const envoyer = async () => {
    if (!texte.trim() || !profil?.id || envoi) return;
    const texteTrimme = texte.trim();
    setTexte('');
    setEnvoi(true);
    try {
      const { data, error } = await supabase.from('messages_luma')
        .insert({ conversation_id: convId, auteur_id: profil.id, contenu: texteTrimme, lu: false })
        .select().single();
      if (!error && data) {
        setMessages(prev => prev.find(m => m.id === data.id) ? prev : [...prev, data]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      } else { setTexte(texteTrimme); }
    } catch { setTexte(texteTrimme); }
    setEnvoi(false);
  };

  const getNom = () => interlocuteur?.prenom || interlocuteur?.handle || 'Conversation';

  const messagesAvecSep = [];
  let dernierJour = null;
  messages.forEach((msg, i) => {
    const jour = new Date(msg.created_at).toDateString();
    if (jour !== dernierJour) {
      messagesAvecSep.push({ type: 'sep', id: `sep_${i}`, date: msg.created_at });
      dernierJour = jour;
    }
    messagesAvecSep.push({ type: 'msg', ...msg });
  });

  const renderItem = ({ item }) => {
    if (item.type === 'sep') {
      return (
        <View style={styles.sep}>
          <View style={styles.sepLigne} />
          <Text style={[styles.sepTxt, { fontSize: t(11) }]}>{separateurDate(item.date)}</Text>
          <View style={styles.sepLigne} />
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
            <View style={[styles.msgAvatar, styles.msgAvatarPlaceholder]}>
              <Text style={{ color: '#2563EB', fontSize: 12, fontWeight: '700' }}>
                {getNom()[0].toUpperCase()}
              </Text>
            </View>
          )
        )}
        <View style={[styles.bulle, estMoi ? styles.bulleMoi : styles.bulleAutre]}>
          <Text style={[styles.bulleTxt, { color: estMoi ? '#fff' : '#111', fontSize: t(15) }]}>
            {item.contenu}
          </Text>
          <View style={styles.bulleMeta}>
            <Text style={{ color: estMoi ? 'rgba(255,255,255,0.55)' : '#aaa', fontSize: t(10) }}>
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
      style={[styles.container, { backgroundColor: '#fafaf8' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color="#2563EB" />
          <Text style={{ color: '#2563EB', fontSize: t(16), marginLeft: -2 }}>Retour</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerProfil}
          onPress={() => interlocuteur?.id && navigation.navigate('ProfilPublic', { userId: interlocuteur.id })}
          activeOpacity={0.7}
        >
          {interlocuteur?.avatar_url ? (
            <Image source={{ uri: interlocuteur.avatar_url }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarPlaceholder]}>
              <Text style={{ color: '#2563EB', fontSize: t(16), fontWeight: '600' }}>
                {getNom()[0].toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={[styles.headerNom, { fontSize: t(16) }]}>{getNom()}</Text>
        </TouchableOpacity>
        <View style={{ width: 70 }} />
      </View>

      {chargement ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#111" />
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.vide}>
          <View style={styles.videIcone}>
            <Ionicons name="chatbubble-outline" size={28} color="#aaa" />
          </View>
          <Text style={{ color: '#111', fontSize: t(16), fontWeight: '600', marginTop: 10 }}>
            Début de la conversation
          </Text>
          <Text style={{ color: '#aaa', fontSize: t(13), marginTop: 4 }}>
            Envoie un message à {getNom()}
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messagesAvecSep}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.liste}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Saisie */}
      <View style={styles.saisie}>
        <TextInput
          style={[styles.saisieInput, { fontSize: t(15) }]}
          placeholder={`Message à ${getNom()}...`}
          placeholderTextColor="#aaa"
          value={texte}
          onChangeText={setTexte}
          multiline
          maxLength={1000}
          returnKeyType="send"
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[styles.envoiBtn, { backgroundColor: texte.trim() ? '#111' : '#e8e8e8' }]}
          onPress={envoyer}
          disabled={!texte.trim() || envoi}
          activeOpacity={0.8}
        >
          {envoi
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="arrow-up" size={18} color={texte.trim() ? '#fff' : '#aaa'} />
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 54 : 16, paddingBottom: 12, paddingHorizontal: 14, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.06)', backgroundColor: '#fafaf8' },
  backBtn: { flexDirection: 'row', alignItems: 'center', width: 80 },
  headerProfil: { flex: 1, flexDirection: 'column', alignItems: 'center', gap: 4 },
  headerAvatar: { width: 36, height: 36, borderRadius: 18 },
  headerAvatarPlaceholder: { backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  headerNom: { fontWeight: '600', color: '#111' },
  liste: { padding: 16, paddingBottom: 8 },
  sep: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 14 },
  sepLigne: { flex: 1, height: 0.5, backgroundColor: 'rgba(0,0,0,0.08)' },
  sepTxt: { color: '#aaa' },
  msgWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginVertical: 2 },
  msgMoi: { justifyContent: 'flex-end' },
  msgAutre: { justifyContent: 'flex-start' },
  msgAvatar: { width: 28, height: 28, borderRadius: 14, flexShrink: 0 },
  msgAvatarPlaceholder: { backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  bulle: { maxWidth: '75%', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  bulleMoi: { backgroundColor: '#111', borderBottomRightRadius: 5 },
  bulleAutre: { backgroundColor: '#f0f0ee', borderBottomLeftRadius: 5 },
  bulleTxt: { lineHeight: 21 },
  bulleMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4, justifyContent: 'flex-end' },
  vide: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 32 },
  videIcone: { width: 60, height: 60, borderRadius: 18, backgroundColor: '#f0f0ee', alignItems: 'center', justifyContent: 'center' },
  saisie: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, paddingHorizontal: 16, paddingBottom: Platform.OS === 'ios' ? 30 : 14, borderTopWidth: 0.5, borderTopColor: 'rgba(0,0,0,0.06)', backgroundColor: '#fafaf8' },
  saisieInput: { flex: 1, backgroundColor: '#f0f0ee', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, maxHeight: 120, minHeight: 44, color: '#111' },
  envoiBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});