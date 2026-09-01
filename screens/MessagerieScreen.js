import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Image, ActivityIndicator, Platform, KeyboardAvoidingView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../AppContext';
import { supabase } from '../supabase';

export default function MessagerieScreen({ navigation }) {
  const { theme, facteurTexte, profil } = useApp();
  const [conversations, setConversations] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState('');
  const [showNouvelleConv, setShowNouvelleConv] = useState(false);
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [rechercheUser, setRechercheUser] = useState('');
  const [chargementUsers, setChargementUsers] = useState(false);
  const t = (s) => s * facteurTexte;

  useFocusEffect(useCallback(() => { chargerConversations(); }, [profil]));

  const chargerConversations = async () => {
    if (!profil?.id) return;
    setChargement(true);
    try {
      const { data: memberships } = await supabase
        .from('conversation_membres').select('conversation_id').eq('user_id', profil.id);
      if (!memberships?.length) { setConversations([]); setChargement(false); return; }
      const convIds = memberships.map(m => m.conversation_id);
      const { data: convs } = await supabase
        .from('conversations').select('id, updated_at')
        .in('id', convIds).order('updated_at', { ascending: false }).limit(30);
      if (!convs?.length) { setConversations([]); setChargement(false); return; }
      const convsCompletes = await Promise.all(convs.map(async (conv) => {
        const [{ data: membres }, { data: msgs }] = await Promise.all([
          supabase.from('conversation_membres').select('user_id, profiles(id, prenom, avatar_url)').eq('conversation_id', conv.id),
          supabase.from('messages_luma').select('id, contenu, auteur_id, lu, created_at').eq('conversation_id', conv.id).order('created_at', { ascending: false }).limit(1),
        ]);
        const { count: nonLus } = await supabase.from('messages_luma')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', conv.id).neq('auteur_id', profil.id).eq('lu', false);
        const autresMembres = (membres || []).filter(m => m.user_id !== profil.id).map(m => m.profiles).filter(Boolean);
        return { ...conv, autresMembres, dernierMessage: msgs?.[0] || null, nonLus: nonLus || 0 };
      }));
      setConversations(convsCompletes);
    } catch (e) { console.error(e); }
    setChargement(false);
  };

  const rechercherUtilisateurs = async (texte) => {
    if (!texte || texte.length < 2) { setUtilisateurs([]); return; }
    setChargementUsers(true);
    try {
      const { data } = await supabase.from('profiles').select('id, prenom, avatar_url, handle')
        .neq('id', profil?.id).or(`prenom.ilike.%${texte}%,handle.ilike.%${texte}%`).limit(20);
      if (data) setUtilisateurs(data);
    } catch {}
    setChargementUsers(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => rechercherUtilisateurs(rechercheUser), 400);
    return () => clearTimeout(timer);
  }, [rechercheUser]);

  const creerOuOuvrirConversation = async (autreUser) => {
    if (!profil?.id) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { Alert.alert('Session expirée', 'Reconnecte-toi.'); return; }
    try {
      const { data: mesMembres } = await supabase.from('conversation_membres').select('conversation_id').eq('user_id', profil.id);
      const { data: saMembres } = await supabase.from('conversation_membres').select('conversation_id').eq('user_id', autreUser.id);
      const mesIds = new Set((mesMembres || []).map(m => m.conversation_id));
      const convCommune = (saMembres || []).find(m => mesIds.has(m.conversation_id));
      if (convCommune) { fermerModal(); navigation.navigate('Conversation', { convId: convCommune.conversation_id, interlocuteur: autreUser }); return; }
      const { data: convId, error } = await supabase.rpc('creer_conversation_directe', { autre_user_id: autreUser.id });
      if (error || !convId) { Alert.alert('Erreur', error?.message); return; }
      fermerModal();
      navigation.navigate('Conversation', { convId, interlocuteur: autreUser });
      setTimeout(chargerConversations, 500);
    } catch (e) { Alert.alert('Erreur', String(e?.message || e)); }
  };

  const formatTemps = (dateStr) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const min = Math.floor(diff / 60000);
    const h = Math.floor(min / 60);
    const j = Math.floor(h / 24);
    if (min < 1) return "à l'instant";
    if (min < 60) return `${min}m`;
    if (h < 24) return `${h}h`;
    if (j < 7) return `${j}j`;
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const fermerModal = () => { setShowNouvelleConv(false); setRechercheUser(''); setUtilisateurs([]); };

  const convsFiltrees = conversations.filter(conv =>
    !recherche || conv.autresMembres?.some(m => m?.prenom?.toLowerCase().includes(recherche.toLowerCase()))
  );

  return (
    <View style={[styles.container, { backgroundColor: '#fafaf8' }]}>
      {/* Header style Apple */}
      <View style={styles.header}>
        <Text style={[styles.titre, { fontSize: t(28) }]}>Messages</Text>
        <TouchableOpacity
          style={styles.nouveauBtn}
          onPress={() => { setShowNouvelleConv(true); setRechercheUser(''); setUtilisateurs([]); }}
          activeOpacity={0.75}
        >
          <Ionicons name="create-outline" size={16} color="#fff" />
          <Text style={{ color: '#fff', fontSize: t(13), fontWeight: '600' }}>Nouveau</Text>
        </TouchableOpacity>
      </View>

      {/* Barre recherche style iOS */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={15} color="#aaa" />
        <TextInput
          style={[styles.searchInput, { fontSize: t(14) }]}
          placeholder="Rechercher..."
          placeholderTextColor="#aaa"
          value={recherche}
          onChangeText={setRecherche}
        />
        {recherche.length > 0 && (
          <TouchableOpacity onPress={() => setRecherche('')}>
            <Ionicons name="close-circle" size={16} color="#aaa" />
          </TouchableOpacity>
        )}
      </View>

      {chargement ? (
        <View style={styles.vide}><ActivityIndicator color="#111" /></View>
      ) : convsFiltrees.length === 0 ? (
        <View style={styles.vide}>
          <View style={styles.videIconeWrap}>
            <Ionicons name="chatbubbles-outline" size={30} color="#aaa" />
          </View>
          <Text style={{ color: '#111', fontSize: t(16), fontWeight: '600', marginTop: 12 }}>
            {recherche ? 'Aucune conversation' : 'Aucun message'}
          </Text>
          <Text style={{ color: '#aaa', fontSize: t(13), marginTop: 4, textAlign: 'center' }}>
            {!recherche && "Démarre une conversation !"}
          </Text>
          {!recherche && (
            <TouchableOpacity
              style={styles.videBtn}
              onPress={() => { setShowNouvelleConv(true); setRechercheUser(''); setUtilisateurs([]); }}
            >
              <Ionicons name="create-outline" size={16} color="#fff" />
              <Text style={{ color: '#fff', fontSize: t(14), fontWeight: '600' }}>Nouvelle conversation</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={convsFiltrees}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item }) => {
            const autre = item.autresMembres?.[0];
            const dernierMsg = item.dernierMessage;
            const nom = autre?.prenom || 'Utilisateur';
            return (
              <TouchableOpacity
                style={styles.convItem}
                onPress={() => navigation.navigate('Conversation', { convId: item.id, interlocuteur: autre })}
                activeOpacity={0.7}
              >
                {autre?.avatar_url ? (
                  <Image source={{ uri: autre.avatar_url }} style={styles.convAvatar} />
                ) : (
                  <View style={[styles.convAvatar, styles.avatarPlaceholder]}>
                    <Text style={{ color: '#2563EB', fontWeight: '700', fontSize: 20 }}>
                      {nom[0].toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                    <Text style={{ color: '#111', fontSize: t(15), fontWeight: item.nonLus > 0 ? '700' : '500' }}>
                      {nom}
                    </Text>
                    {dernierMsg && (
                      <Text style={{ color: '#aaa', fontSize: t(11) }}>
                        {formatTemps(dernierMsg.created_at)}
                      </Text>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ color: item.nonLus > 0 ? '#111' : '#aaa', fontSize: t(13), fontWeight: item.nonLus > 0 ? '500' : '400', flex: 1 }} numberOfLines={1}>
                      {dernierMsg ? (dernierMsg.auteur_id === profil?.id ? 'Toi : ' : '') + dernierMsg.contenu : "Démarre la conversation !"}
                    </Text>
                    {item.nonLus > 0 && (
                      <View style={styles.badgeNonLus}>
                        <Text style={{ color: '#fff', fontSize: t(10), fontWeight: '700' }}>
                          {item.nonLus > 9 ? '9+' : item.nonLus}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {showNouvelleConv && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={fermerModal} />
          <View style={styles.modal}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={{ color: '#111', fontSize: t(17), fontWeight: '600' }}>Nouvelle conversation</Text>
              <TouchableOpacity onPress={fermerModal} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={16} color="#888" />
              </TouchableOpacity>
            </View>
            <View style={styles.searchWrapModal}>
              <Ionicons name="search-outline" size={15} color="#aaa" />
              <TextInput
                style={[styles.searchInput, { fontSize: t(14) }]}
                placeholder="Cherche par prénom ou @handle..."
                placeholderTextColor="#aaa"
                value={rechercheUser}
                onChangeText={setRechercheUser}
                autoFocus
              />
              {rechercheUser.length > 0 && (
                <TouchableOpacity onPress={() => { setRechercheUser(''); setUtilisateurs([]); }}>
                  <Ionicons name="close-circle" size={15} color="#aaa" />
                </TouchableOpacity>
              )}
            </View>
            {chargementUsers ? (
              <ActivityIndicator style={{ marginVertical: 20 }} color="#111" />
            ) : utilisateurs.length > 0 ? (
              <FlatList
                data={utilisateurs}
                keyExtractor={item => item.id}
                keyboardShouldPersistTaps="handled"
                style={{ maxHeight: 300 }}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.userItem} onPress={() => creerOuOuvrirConversation(item)}>
                    {item.avatar_url ? (
                      <Image source={{ uri: item.avatar_url }} style={styles.userAvatar} />
                    ) : (
                      <View style={[styles.userAvatar, styles.avatarPlaceholder]}>
                        <Text style={{ color: '#2563EB', fontWeight: '700', fontSize: 16 }}>
                          {(item.prenom || '?')[0].toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#111', fontSize: t(15), fontWeight: '500' }}>{item.prenom}</Text>
                      {item.handle && <Text style={{ color: '#aaa', fontSize: t(12) }}>{item.handle}</Text>}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#ddd" />
                  </TouchableOpacity>
                )}
              />
            ) : rechercheUser.length >= 2 ? (
              <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                <Ionicons name="person-outline" size={32} color="#ddd" />
                <Text style={{ color: '#aaa', fontSize: t(14), marginTop: 8 }}>Aucun utilisateur trouvé</Text>
              </View>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 28 }}>
                <Ionicons name="people-outline" size={36} color="#ddd" />
                <Text style={{ color: '#aaa', fontSize: t(13), marginTop: 10, textAlign: 'center', lineHeight: 20 }}>
                  Tape le prénom ou le @handle{'\n'}d'un utilisateur Luma
                </Text>
              </View>
            )}
            <View style={{ height: Platform.OS === 'ios' ? 8 : 16 }} />
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 58 : 20, paddingBottom: 12 },
  titre: { fontWeight: '700', color: '#111', letterSpacing: -0.5 },
  nouveauBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#111', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f0f0ee', borderRadius: 13, padding: 11, marginHorizontal: 16, marginBottom: 8 },
  searchWrapModal: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f0f0ee', borderRadius: 13, padding: 11, marginBottom: 10 },
  searchInput: { flex: 1, color: '#111' },
  vide: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  videIconeWrap: { width: 60, height: 60, borderRadius: 18, backgroundColor: '#f0f0ee', alignItems: 'center', justifyContent: 'center' },
  videBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#111', borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12, marginTop: 16 },
  convItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 20, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.05)' },
  convAvatar: { width: 52, height: 52, borderRadius: 26, flexShrink: 0 },
  userAvatar: { width: 42, height: 42, borderRadius: 21 },
  avatarPlaceholder: { backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  badgeNonLus: { backgroundColor: '#111', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, marginLeft: 6 },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 100 },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingTop: 12 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  modalCloseBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f0f0ee', alignItems: 'center', justifyContent: 'center' },
  userItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.05)' },
});