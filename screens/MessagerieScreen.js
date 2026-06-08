import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Image, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../AppContext';
import { useMessagerie } from '../MessagerieContext';
import { supabase } from '../supabase';

function formatDateCourte(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const maintenant = new Date();
  const auj = new Date(); auj.setHours(0, 0, 0, 0);
  const hier = new Date(auj); hier.setDate(hier.getDate() - 1);
  if (d >= auj) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (d >= hier) return 'Hier';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export default function MessagerieScreen({ navigation }) {
  const { theme, facteurTexte } = useApp();
  const { totalNonLus, rafraichir } = useMessagerie();
  const [conversations, setConversations] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState('');
  const [userActuel, setUserActuel] = useState(null);

  const t = (size) => size * facteurTexte;

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserActuel(user);
    })();
  }, []);

  const chargerConversations = useCallback(async () => {
    setChargement(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Récupère les conversations dont l'user est membre
      const { data: membres } = await supabase
        .from('conversation_membres')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (!membres?.length) { setConversations([]); setChargement(false); return; }

      const convIds = membres.map(m => m.conversation_id);

      // Récupère les conversations avec le dernier message
      const { data: convs } = await supabase
        .from('conversations')
        .select(`
          id, type, created_at,
          messages (
            id, texte, auteur_id, created_at, lu
          ),
          conversation_membres (
            user_id,
            profiles (
              id, pseudo, avatar_url
            )
          )
        `)
        .in('id', convIds)
        .order('created_at', { ascending: false });

      if (!convs) { setConversations([]); setChargement(false); return; }

      // Transforme pour l'affichage
      const convsTransformees = convs.map(conv => {
        // Trouve l'autre participant
        const autresMembres = conv.conversation_membres?.filter(
          m => m.user_id !== user.id
        ) || [];
        const autreProfile = autresMembres[0]?.profiles;

        // Dernier message
        const messages = conv.messages || [];
        const dernierMsg = messages.sort((a, b) =>
          new Date(b.created_at) - new Date(a.created_at)
        )[0];

        // Compte les non lus
        const nonLus = messages.filter(m => !m.lu && m.auteur_id !== user.id).length;

        return {
          id: conv.id,
          type: conv.type,
          interlocuteur: autreProfile || { pseudo: 'Utilisateur', avatar_url: null },
          dernierMessage: dernierMsg?.texte || null,
          dernierMessageDate: dernierMsg?.created_at || conv.created_at,
          dernierMessageAuteur: dernierMsg?.auteur_id,
          nonLus,
          monId: user.id,
        };
      }).sort((a, b) =>
        new Date(b.dernierMessageDate) - new Date(a.dernierMessageDate)
      );

      setConversations(convsTransformees);
    } catch (e) {
      console.log('Erreur chargement conversations:', e);
    }
    setChargement(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      chargerConversations();
    }, [chargerConversations])
  );

  // Abonnement temps réel
  useEffect(() => {
    const channel = supabase
      .channel('messagerie_liste')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
      }, () => {
        chargerConversations();
        rafraichir();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [chargerConversations]);

  const convsFiltrees = conversations.filter(c => {
    if (!recherche) return true;
    return c.interlocuteur?.pseudo?.toLowerCase().includes(recherche.toLowerCase()) ||
      c.dernierMessage?.toLowerCase().includes(recherche.toLowerCase());
  });

  const renderItem = ({ item }) => {
    const estMoi = item.dernierMessageAuteur === item.monId;
    const aDesNonLus = item.nonLus > 0;

    return (
      <TouchableOpacity
        style={[styles.convItem, { backgroundColor: theme.card, borderBottomColor: theme.border }]}
        onPress={() => navigation.navigate('Conversation', {
          convId: item.id,
          interlocuteur: item.interlocuteur,
        })}
        activeOpacity={0.7}
      >
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          {item.interlocuteur.avatar_url ? (
            <Image source={{ uri: item.interlocuteur.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: '#DBEAFE' }]}>
              <Text style={{ color: '#2563EB', fontSize: t(16), fontWeight: '600' }}>
                {(item.interlocuteur.pseudo || 'U')[0].toUpperCase()}
              </Text>
            </View>
          )}
          {aDesNonLus && (
            <View style={styles.badgeNonLu}>
              <Text style={{ color: '#fff', fontSize: t(9), fontWeight: '700' }}>
                {item.nonLus > 9 ? '9+' : item.nonLus}
              </Text>
            </View>
          )}
        </View>

        {/* Contenu */}
        <View style={styles.convContenu}>
          <View style={styles.convHaut}>
            <Text style={[styles.convNom, {
              color: theme.text,
              fontSize: t(15),
              fontWeight: aDesNonLus ? '600' : '500',
            }]} numberOfLines={1}>
              {item.interlocuteur.pseudo || 'Utilisateur'}
            </Text>
            <Text style={[styles.convDate, {
              color: aDesNonLus ? '#2563EB' : theme.text3,
              fontSize: t(11),
              fontWeight: aDesNonLus ? '600' : '400',
            }]}>
              {formatDateCourte(item.dernierMessageDate)}
            </Text>
          </View>
          <View style={styles.convBas}>
            <Text style={[styles.convDernierMsg, {
              color: aDesNonLus ? theme.text : theme.text3,
              fontSize: t(13),
              fontWeight: aDesNonLus ? '500' : '400',
              flex: 1,
            }]} numberOfLines={1}>
              {item.dernierMessage
                ? `${estMoi ? 'Moi : ' : ''}${item.dernierMessage}`
                : 'Nouvelle conversation'}
            </Text>
            {aDesNonLus && (
              <View style={styles.pointNonLu} />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Text style={[styles.titre, { color: theme.text, fontSize: t(22) }]}>Messages</Text>
        {totalNonLus > 0 && (
          <View style={[styles.badgeTotal, { backgroundColor: '#EF4444' }]}>
            <Text style={{ color: '#fff', fontSize: t(11), fontWeight: '700' }}>
              {totalNonLus}
            </Text>
          </View>
        )}
      </View>

      {/* Recherche */}
      <View style={[styles.searchWrap, { backgroundColor: theme.card, borderColor: theme.border }]}>
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

      {/* Liste */}
      {convsFiltrees.length === 0 && !chargement ? (
        <View style={styles.vide}>
          <View style={[styles.videIcone, { backgroundColor: theme.card }]}>
            <Ionicons name="chatbubbles-outline" size={32} color={theme.text3} />
          </View>
          <Text style={[styles.videTexte, { color: theme.text, fontSize: t(17) }]}>
            {recherche ? 'Aucune conversation trouvée' : 'Pas encore de messages'}
          </Text>
          <Text style={[styles.videDesc, { color: theme.text3, fontSize: t(13) }]}>
            {recherche
              ? 'Essaie un autre terme'
              : 'Rejoins un événement et échange avec les participants'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={convsFiltrees}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={chargement}
              onRefresh={chargerConversations}
              tintColor="#2563EB"
            />
          }
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 16, paddingTop: 56, borderBottomWidth: 0.5,
  },
  titre: { fontWeight: '500', flex: 1 },
  badgeTotal: {
    borderRadius: 12, minWidth: 22, height: 22,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: 12, borderRadius: 12, padding: 12, borderWidth: 0.5,
  },
  searchInput: { flex: 1 },
  convItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5,
  },
  avatarWrap: { position: 'relative' },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  avatarPlaceholder: {
    width: 50, height: 50, borderRadius: 25,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeNonLu: {
    position: 'absolute', top: -2, right: -2,
    backgroundColor: '#EF4444', borderRadius: 8,
    minWidth: 16, height: 16,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3, borderWidth: 1.5, borderColor: '#fff',
  },
  convContenu: { flex: 1 },
  convHaut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  convNom: {},
  convDate: {},
  convBas: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  convDernierMsg: {},
  pointNonLu: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563EB',
  },
  vide: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  videIcone: { width: 70, height: 70, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  videTexte: { fontWeight: '500' },
  videDesc: { textAlign: 'center', lineHeight: 20 },
});