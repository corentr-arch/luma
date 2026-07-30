import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Image, ActivityIndicator, Platform, KeyboardAvoidingView,
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

  useFocusEffect(
    useCallback(() => {
      chargerConversations();
    }, [profil])
  );

  const chargerConversations = async () => {
    if (!profil?.id) return;
    setChargement(true);
    try {
      const { data } = await supabase
        .from('conversations')
        .select(`
          id, created_at, updated_at,
          conversation_membres!inner(user_id, profiles(id, prenom, avatar_url)),
          messages(id, contenu, created_at, user_id)
        `)
        .order('updated_at', { ascending: false })
        .limit(30);

      if (data) {
        const convsFiltrees = data.map(conv => {
          const autresMembres = conv.conversation_membres
            .filter(m => m.user_id !== profil.id)
            .map(m => m.profiles);
          const dernierMessage = conv.messages?.sort((a, b) =>
            new Date(b.created_at) - new Date(a.created_at)
          )[0] || null;
          return { ...conv, autresMembres, dernierMessage };
        });
        setConversations(convsFiltrees);
      }
    } catch {}
    setChargement(false);
  };

  const rechercherUtilisateurs = async (texte) => {
    if (!texte || texte.length < 2) { setUtilisateurs([]); return; }
    setChargementUsers(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, prenom, avatar_url, handle')
        .neq('id', profil?.id)
        .or(`prenom.ilike.%${texte}%,handle.ilike.%${texte}%`)
        .limit(20);
      if (data) setUtilisateurs(data);
    } catch {}
    setChargementUsers(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => rechercherUtilisateurs(rechercheUser), 400);
    return () => clearTimeout(timer);
  }, [rechercheUser]);

  const creerOuOuvrirConversation = async (autreUserId) => {
    if (!profil?.id) return;
    try {
      const { data: existantes } = await supabase
        .from('conversation_membres')
        .select('conversation_id')
        .eq('user_id', profil.id);

      const { data: existantesAutre } = await supabase
        .from('conversation_membres')
        .select('conversation_id')
        .eq('user_id', autreUserId);

      const idsUser = new Set((existantes || []).map(c => c.conversation_id));
      const convCommune = (existantesAutre || []).find(c => idsUser.has(c.conversation_id));

      if (convCommune) {
        setShowNouvelleConv(false);
        setRechercheUser('');
        navigation.navigate('Conversation', { conversationId: convCommune.conversation_id });
        return;
      }

      const { data: nouvelleConv } = await supabase
        .from('conversations')
        .insert({})
        .select()
        .single();

      if (nouvelleConv) {
        await supabase.from('conversation_membres').insert([
          { conversation_id: nouvelleConv.id, user_id: profil.id },
          { conversation_id: nouvelleConv.id, user_id: autreUserId },
        ]);
        setShowNouvelleConv(false);
        setRechercheUser('');
        navigation.navigate('Conversation', { conversationId: nouvelleConv.id });
      }
    } catch (e) {
      console.error('Erreur création conversation:', e);
    }
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

  const convsFiltrees = conversations.filter(conv =>
    !recherche || conv.autresMembres?.some(m =>
      m?.prenom?.toLowerCase().includes(recherche.toLowerCase())
    )
  );

  const fermerModal = () => {
    setShowNouvelleConv(false);
    setRechercheUser('');
    setUtilisateurs([]);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Text style={[styles.titre, { color: theme.text, fontSize: t(22) }]}>Messages</Text>
        <TouchableOpacity
          style={[styles.nouveauBtn, { backgroundColor: '#111' }]}
          onPress={() => { setShowNouvelleConv(true); setRechercheUser(''); setUtilisateurs([]); }}
        >
          <Ionicons name="create-outline" size={18} color="#fff" />
          <Text style={{ color: '#fff', fontSize: t(13), fontWeight: '500' }}>Nouveau</Text>
        </TouchableOpacity>
      </View>

      {/* Barre de recherche */}
      <View style={[styles.searchWrap, { backgroundColor: theme.card, borderColor: theme.border, margin: 12, marginBottom: 6 }]}>
        <Ionicons name="search-outline" size={15} color={theme.text3} />
        <TextInput
          style={[styles.searchInput, { color: theme.text, fontSize: t(14) }]}
          placeholder="Rechercher une conversation..."
          placeholderTextColor={theme.text3}
          value={recherche}
          onChangeText={setRecherche}
        />
        {recherche.length > 0 && (
          <TouchableOpacity onPress={() => setRecherche('')}>
            <Ionicons name="close-circle" size={16} color={theme.text3} />
          </TouchableOpacity>
        )}
      </View>

      {/* Liste des conversations */}
      {chargement ? (
        <View style={styles.vide}>
          <ActivityIndicator color="#2563EB" />
        </View>
      ) : convsFiltrees.length === 0 ? (
        <View style={styles.vide}>
          <Ionicons name="chatbubbles-outline" size={48} color={theme.text3} />
          <Text style={{ color: theme.text, fontSize: t(16), fontWeight: '500', marginTop: 12 }}>
            {recherche ? 'Aucune conversation trouvée' : 'Aucun message'}
          </Text>
          <Text style={{ color: theme.text3, fontSize: t(13), marginTop: 6, textAlign: 'center' }}>
            {!recherche && "Démarre une conversation avec quelqu'un !"}
          </Text>
          {!recherche && (
            <TouchableOpacity
              style={[styles.nouveauBtnVide, { backgroundColor: '#111' }]}
              onPress={() => { setShowNouvelleConv(true); setRechercheUser(''); setUtilisateurs([]); }}
            >
              <Ionicons name="create-outline" size={18} color="#fff" />
              <Text style={{ color: '#fff', fontSize: t(14), fontWeight: '500' }}>Nouvelle conversation</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={convsFiltrees}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            const autre = item.autresMembres?.[0];
            const dernierMsg = item.dernierMessage;
            return (
              <TouchableOpacity
                style={[styles.convItem, { borderBottomColor: theme.border }]}
                onPress={() => navigation.navigate('Conversation', { conversationId: item.id })}
                activeOpacity={0.7}
              >
                {autre?.avatar_url ? (
                  <Image source={{ uri: autre.avatar_url }} style={styles.convAvatar} />
                ) : (
                  <View style={[styles.convAvatar, styles.avatarPlaceholder]}>
                    <Text style={[styles.avatarInitiale, { fontSize: 18 }]}>
                      {(autre?.prenom || '?')[0].toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                    <Text style={{ color: theme.text, fontSize: t(15), fontWeight: '600' }}>
                      {autre?.prenom || 'Utilisateur'}
                    </Text>
                    {dernierMsg && (
                      <Text style={{ color: theme.text3, fontSize: t(11) }}>
                        {formatTemps(dernierMsg.created_at)}
                      </Text>
                    )}
                  </View>
                  <Text style={{ color: theme.text3, fontSize: t(13) }} numberOfLines={1}>
                    {dernierMsg
                      ? (dernierMsg.user_id === profil?.id ? 'Toi : ' : '') + dernierMsg.contenu
                      : "Démarre la conversation !"}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}

      {/* ✅ Modal nouvelle conversation avec KeyboardAvoidingView */}
      {showNouvelleConv && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          {/* Zone transparente pour fermer */}
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={fermerModal}
          />

          {/* Contenu du modal */}
          <View style={[styles.modal, { backgroundColor: theme.card }]}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <Text style={{ color: theme.text, fontSize: t(16), fontWeight: '600' }}>
                Nouvelle conversation
              </Text>
              <TouchableOpacity onPress={fermerModal}>
                <Ionicons name="close" size={22} color={theme.text3} />
              </TouchableOpacity>
            </View>

            <View style={[styles.searchWrap, { backgroundColor: theme.bg, borderColor: theme.border, margin: 0, marginBottom: 8 }]}>
              <Ionicons name="search-outline" size={15} color={theme.text3} />
              <TextInput
                style={[styles.searchInput, { color: theme.text, fontSize: t(14) }]}
                placeholder="Cherche par prénom ou @handle..."
                placeholderTextColor={theme.text3}
                value={rechercheUser}
                onChangeText={setRechercheUser}
                autoFocus
              />
              {rechercheUser.length > 0 && (
                <TouchableOpacity onPress={() => { setRechercheUser(''); setUtilisateurs([]); }}>
                  <Ionicons name="close-circle" size={15} color={theme.text3} />
                </TouchableOpacity>
              )}
            </View>

            {chargementUsers ? (
              <ActivityIndicator style={{ marginVertical: 20 }} color="#2563EB" />
            ) : utilisateurs.length > 0 ? (
              <FlatList
                data={utilisateurs}
                keyExtractor={item => item.id}
                keyboardShouldPersistTaps="handled"
                style={{ maxHeight: 280 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.userItem, { borderBottomColor: theme.border }]}
                    onPress={() => creerOuOuvrirConversation(item.id)}
                  >
                    {item.avatar_url ? (
                      <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, styles.avatarPlaceholder]}>
                        <Text style={styles.avatarInitiale}>
                          {(item.prenom || '?')[0].toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.text, fontSize: t(15), fontWeight: '500' }}>
                        {item.prenom}
                      </Text>
                      {item.handle && (
                        <Text style={{ color: theme.text3, fontSize: t(12) }}>{item.handle}</Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={theme.text3} />
                  </TouchableOpacity>
                )}
              />
            ) : rechercheUser.length >= 2 ? (
              <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                <Ionicons name="person-outline" size={32} color={theme.text3} />
                <Text style={{ color: theme.text3, fontSize: t(14), marginTop: 8 }}>
                  Aucun utilisateur trouvé
                </Text>
              </View>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                <Ionicons name="people-outline" size={32} color={theme.text3} />
                <Text style={{ color: theme.text3, fontSize: t(13), marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
                  Tape le prénom ou le @handle{'\n'}d'un utilisateur Luma
                </Text>
              </View>
            )}

            {/* Padding bas pour iOS */}
            <View style={{ height: Platform.OS === 'ios' ? 8 : 16 }} />
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, paddingTop: 56, borderBottomWidth: 0.5,
  },
  titre: { fontWeight: '600' },
  nouveauBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
  },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, padding: 10, borderWidth: 0.5,
  },
  searchInput: { flex: 1 },
  vide: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 },
  nouveauBtnVide: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12, marginTop: 12,
  },
  convItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, paddingHorizontal: 16, borderBottomWidth: 0.5,
  },
  convAvatar: { width: 50, height: 50, borderRadius: 25, flexShrink: 0 },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  avatarPlaceholder: { backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  avatarInitiale: { color: '#fff', fontWeight: '700', fontSize: 16 },
  modalOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100,
  },
  modal: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingTop: 12,
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16,
  },
  userItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 0.5,
  },
});