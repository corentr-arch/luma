import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, FlatList, Modal, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { useApp } from '../AppContext';
import { supabase } from '../supabase';
import StoryViewer from '../components/StoryViewer';

export default function ProfilPublicScreen({ route, navigation }) {
  const { userId } = route.params;
  const { theme, facteurTexte, profil: monProfil } = useApp();
  const t = (size) => size * facteurTexte;

  const [profil, setProfil] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [stories, setStories] = useState([]);
  const [evenements, setEvenements] = useState([]);
  const [storyViewerVisible, setStoryViewerVisible] = useState(false);
  const [storyIndex, setStoryIndex] = useState(0);
  const [estMoi, setEstMoi] = useState(false);

  useEffect(() => {
    chargerProfil();
  }, [userId]);

  const chargerProfil = async () => {
    setChargement(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setEstMoi(user?.id === userId);

      const [{ data: p }, { data: s }, { data: ev }] = await Promise.all([
        supabase.from('profiles')
          .select('id, prenom, handle, bio, avatar_url, arrondissement, centres_interet, score_confiance, created_at, is_organisateur')
          .eq('id', userId)
          .single(),
        supabase.from('stories')
          .select('id, media_url, media_type, type, texte, adresse, created_at, expires_at, actif, nb_vues, nb_likes, latitude, longitude, profiles(id, prenom, avatar_url)')
          .eq('user_id', userId)
          .eq('actif', true)
          .gte('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(20),
        supabase.from('evenements')
          .select('id, titre, lieu, date_evenement, categorie, participants, max, sans_max')
          .eq('auteur_id', userId)
          .eq('suspendu', false)
          .gte('date_evenement', new Date().toISOString())
          .order('date_evenement', { ascending: true })
          .limit(10),
      ]);

      if (p) setProfil(p);
      if (s) setStories(s);
      if (ev) setEvenements(ev);
    } catch (e) {
      console.error('Erreur chargement profil:', e);
    }
    setChargement(false);
  };

  const ouvrirConversation = async () => {
    if (!monProfil?.id || !userId) return;
    try {
      const { data: mesMembres } = await supabase
        .from('conversation_membres')
        .select('conversation_id')
        .eq('user_id', monProfil.id);

      const { data: saMembres } = await supabase
        .from('conversation_membres')
        .select('conversation_id')
        .eq('user_id', userId);

      const mesIds = new Set((mesMembres || []).map(m => m.conversation_id));
      const convCommune = (saMembres || []).find(m => mesIds.has(m.conversation_id));

      if (convCommune) {
        navigation.navigate('Conversation', {
          convId: convCommune.conversation_id,
          interlocuteur: profil,
        });
        return;
      }

      const { data: nouvelleConv, error } = await supabase
        .from('conversations')
        .insert({ type: 'direct' })
        .select('id')
        .single();

      if (error || !nouvelleConv) return;

      await supabase.from('conversation_membres').insert([
        { conversation_id: nouvelleConv.id, user_id: monProfil.id },
        { conversation_id: nouvelleConv.id, user_id: userId },
      ]);

      navigation.navigate('Conversation', {
        convId: nouvelleConv.id,
        interlocuteur: profil,
      });
    } catch (e) {
      Alert.alert('Erreur', 'Impossible d\'ouvrir la conversation');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const auj = new Date(); auj.setHours(0, 0, 0, 0);
    const dem = new Date(auj); dem.setDate(dem.getDate() + 1);
    if (d >= auj && d < dem) return `Aujourd'hui ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    if (d >= dem && d < new Date(dem.getTime() + 86400000)) return `Demain ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const scoreConfiance = profil?.score_confiance || 0;
  const initiales = profil?.prenom
    ? profil.prenom.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  if (chargement) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color="#2563EB" size="large" />
      </View>
    );
  }

  if (!profil) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 36 }}>
            <Ionicons name="chevron-back" size={22} color="#2563EB" />
          </TouchableOpacity>
          <Text style={[styles.headerTitre, { color: theme.text, fontSize: t(17) }]}>Profil</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Ionicons name="person-outline" size={48} color={theme.text3} />
          <Text style={{ color: theme.text, fontSize: t(16), fontWeight: '500' }}>Profil introuvable</Text>
          <Text style={{ color: theme.text3, fontSize: t(13) }}>Cet utilisateur n'existe pas.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 36 }}>
          <Ionicons name="chevron-back" size={22} color="#2563EB" />
        </TouchableOpacity>
        <Text style={[styles.headerTitre, { color: theme.text, fontSize: t(17) }]} numberOfLines={1}>
          {profil.prenom || 'Profil'}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Avatar + infos */}
        <View style={styles.avatarSection}>
          {profil.avatar_url ? (
            <Image source={{ uri: profil.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarDefaut, { backgroundColor: '#2563EB' }]}>
              <Text style={{ color: '#fff', fontSize: 32, fontWeight: '500' }}>{initiales}</Text>
            </View>
          )}

          <Text style={[styles.nom, { color: theme.text, fontSize: t(22) }]}>{profil.prenom}</Text>

          {profil.handle && (
            <Text style={{ color: theme.text3, fontSize: t(13), marginTop: 2 }}>{profil.handle}</Text>
          )}

          {profil.arrondissement && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <Ionicons name="location-outline" size={13} color={theme.text3} />
              <Text style={{ color: theme.text3, fontSize: t(13) }}>{profil.arrondissement}</Text>
            </View>
          )}

          {profil.bio && (
            <Text style={[styles.bio, { color: theme.text2, fontSize: t(13) }]}>{profil.bio}</Text>
          )}

          {/* Badges */}
          <View style={styles.badgesRow}>
            {profil.is_organisateur && (
              <View style={[styles.badge, { backgroundColor: '#F3E8FF' }]}>
                <Ionicons name="star" size={11} color="#A855F7" />
                <Text style={{ color: '#7E22CE', fontSize: t(11), fontWeight: '500' }}>Organisateur</Text>
              </View>
            )}
            {scoreConfiance >= 70 && (
              <View style={[styles.badge, { backgroundColor: '#DCFCE7' }]}>
                <Ionicons name="shield-checkmark" size={11} color="#22C55E" />
                <Text style={{ color: '#15803D', fontSize: t(11), fontWeight: '500' }}>Fiable</Text>
              </View>
            )}
            {profil.created_at && (
              <View style={[styles.badge, { backgroundColor: theme.card, borderWidth: 0.5, borderColor: theme.border }]}>
                <Ionicons name="calendar-outline" size={11} color={theme.text3} />
                <Text style={{ color: theme.text3, fontSize: t(11) }}>
                  Depuis {new Date(profil.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                </Text>
              </View>
            )}
          </View>

          {/* Bouton message — seulement si c'est pas moi */}
          {!estMoi && (
            <TouchableOpacity
              style={[styles.btnMessage, { backgroundColor: '#111' }]}
              onPress={ouvrirConversation}
              activeOpacity={0.8}
            >
              <Ionicons name="chatbubble-outline" size={16} color="#fff" />
              <Text style={{ color: '#fff', fontSize: t(14), fontWeight: '600' }}>
                Envoyer un message
              </Text>
            </TouchableOpacity>
          )}
          {estMoi && (
            <TouchableOpacity
              style={[styles.btnMessage, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }]}
              onPress={() => navigation.navigate('Compte')}
              activeOpacity={0.8}
            >
              <Ionicons name="pencil-outline" size={16} color={theme.text} />
              <Text style={{ color: theme.text, fontSize: t(14), fontWeight: '500' }}>
                Modifier mon profil
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Centres d'intérêt */}
        {profil.centres_interet?.length > 0 && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardTitreRow}>
              <Ionicons name="heart-outline" size={14} color={theme.text3} />
              <Text style={[styles.cardTitre, { color: theme.text3, fontSize: t(11) }]}>CENTRES D'INTÉRÊT</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {profil.centres_interet.map(interet => (
                <View key={interet} style={[styles.interetTag, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                  <Text style={{ color: theme.text, fontSize: t(12) }}>{interet}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Stories actives */}
        {stories.length > 0 && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardTitreRow}>
              <Ionicons name="camera-outline" size={14} color={theme.text3} />
              <Text style={[styles.cardTitre, { color: theme.text3, fontSize: t(11) }]}>
                STORIES · {stories.length}
              </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {stories.map((story, i) => (
                  <TouchableOpacity
                    key={story.id}
                    style={styles.storyThumb}
                    onPress={() => { setStoryIndex(i); setStoryViewerVisible(true); }}
                    activeOpacity={0.85}
                  >
                    <Image source={{ uri: story.media_url }} style={styles.storyThumbImg} />
                    <View style={[styles.storyTypeBadge, {
                      backgroundColor: story.type === 'spot' ? '#EF4444' : story.type === 'evenement' ? '#2563EB' : '#8B5CF6'
                    }]}>
                      <Text style={{ color: '#fff', fontSize: 9 }}>
                        {story.type === 'spot' ? '⚡' : story.type === 'evenement' ? '🎉' : '📍'}
                      </Text>
                    </View>
                    <View style={styles.storyStats}>
                      <Ionicons name="eye-outline" size={10} color="#fff" />
                      <Text style={{ color: '#fff', fontSize: 9 }}>{story.nb_vues || 0}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Événements organisés */}
        {evenements.length > 0 && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardTitreRow}>
              <Ionicons name="calendar-outline" size={14} color={theme.text3} />
              <Text style={[styles.cardTitre, { color: theme.text3, fontSize: t(11) }]}>
                ÉVÉNEMENTS À VENIR · {evenements.length}
              </Text>
            </View>
            <View style={{ gap: 8 }}>
              {evenements.map(ev => (
                <TouchableOpacity
                  key={ev.id}
                  style={[styles.evItem, { borderColor: theme.border }]}
                  onPress={() => navigation.navigate('DetailEvenement', { evenement: ev })}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontSize: t(13), fontWeight: '500' }} numberOfLines={1}>
                      {ev.titre}
                    </Text>
                    {ev.lieu && (
                      <Text style={{ color: theme.text3, fontSize: t(12), marginTop: 2 }} numberOfLines={1}>
                        📍 {ev.lieu}
                      </Text>
                    )}
                    {ev.date_evenement && (
                      <Text style={{ color: '#2563EB', fontSize: t(11), marginTop: 2 }}>
                        📅 {formatDate(ev.date_evenement)}
                      </Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View style={[styles.participantsBadge, { backgroundColor: '#DCFCE7' }]}>
                      <Ionicons name="people-outline" size={11} color="#15803D" />
                      <Text style={{ color: '#15803D', fontSize: t(10) }}>
                        {ev.sans_max ? String(ev.participants || 0) : `${ev.participants || 0}/${ev.max || '?'}`}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={theme.text3} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Vide — rien à afficher */}
        {stories.length === 0 && evenements.length === 0 && !profil.bio && !profil.centres_interet?.length && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, alignItems: 'center', padding: 32 }]}>
            <Ionicons name="person-outline" size={36} color={theme.text3} />
            <Text style={{ color: theme.text3, fontSize: t(13), marginTop: 10, textAlign: 'center' }}>
              {estMoi ? 'Complète ton profil pour qu\'il soit visible !' : 'Cet utilisateur n\'a rien partagé pour l\'instant.'}
            </Text>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Story Viewer */}
      {storyViewerVisible && stories.length > 0 && (
        <Modal visible animationType="fade" statusBarTranslucent>
          <StoryViewer
            stories={stories}
            indexDepart={storyIndex}
            onFermer={() => setStoryViewerVisible(false)}
            navigation={navigation}
          />
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 56, borderBottomWidth: 0.5 },
  headerTitre: { fontWeight: '500', flex: 1, textAlign: 'center' },
  scroll: { padding: 16, paddingBottom: 40 },
  avatarSection: { alignItems: 'center', gap: 6, marginBottom: 16 },
  avatar: { width: 90, height: 90, borderRadius: 45 },
  avatarDefaut: { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center' },
  nom: { fontWeight: '600', marginTop: 8 },
  bio: { textAlign: 'center', lineHeight: 20, paddingHorizontal: 20, marginTop: 4 },
  badgesRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginTop: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  btnMessage: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 12, marginTop: 12 },
  card: { borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 0.5 },
  cardTitreRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  cardTitre: { fontWeight: '700', letterSpacing: 0.04, flex: 1 },
  interetTag: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 0.5 },
  storyThumb: { width: 72, height: 96, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  storyThumbImg: { width: '100%', height: '100%' },
  storyTypeBadge: { position: 'absolute', top: 4, left: 4, borderRadius: 8, paddingHorizontal: 4, paddingVertical: 2 },
  storyStats: { position: 'absolute', bottom: 4, right: 4, flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8, paddingHorizontal: 4, paddingVertical: 2 },
  evItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, borderWidth: 0.5 },
  participantsBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 20, paddingHorizontal: 6, paddingVertical: 3 },
});