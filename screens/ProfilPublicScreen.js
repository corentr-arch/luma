import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Modal, Alert, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { useApp } from '../AppContext';
import { supabase } from '../supabase';
import StoryViewer from '../components/StoryViewer';
import BoutonSignaler from '../components/BoutonSignaler';

export default function ProfilPublicScreen({ route, navigation }) {
  const { userId } = route.params;
  const { facteurTexte, profil: monProfil } = useApp();
  const t = (size) => size * facteurTexte;

  const [profil, setProfil] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [stories, setStories] = useState([]);
  const [evenements, setEvenements] = useState([]);
  const [storyViewerVisible, setStoryViewerVisible] = useState(false);
  const [storyIndex, setStoryIndex] = useState(0);
  const [estMoi, setEstMoi] = useState(false);
  const [estAbonne, setEstAbonne] = useState(false);
  const [chargementAbonnement, setChargementAbonnement] = useState(false);

  useEffect(() => { chargerProfil(); }, [userId]);

  const chargerProfil = async () => {
    setChargement(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setEstMoi(user?.id === userId);
      const [{ data: p }, { data: s }, { data: ev }] = await Promise.all([
        supabase.from('profiles').select('id, prenom, handle, bio, avatar_url, arrondissement, centres_interet, score_confiance, created_at, is_organisateur, nb_followers, nb_following').eq('id', userId).single(),
        supabase.from('stories').select('id, media_url, media_type, type, texte, adresse, created_at, expires_at, actif, nb_vues, nb_likes, latitude, longitude, profiles(id, prenom, avatar_url)').eq('user_id', userId).eq('actif', true).gte('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(20),
        supabase.from('evenements').select('id, titre, lieu, date_evenement, categorie, participants:participants_count, max:max_participants, sans_max').eq('auteur_id', userId).eq('suspendu', false).gte('date_evenement', new Date().toISOString()).order('date_evenement', { ascending: true }).limit(10),
      ]);
      if (p) setProfil(p);
      if (s) setStories(s);
      if (ev) setEvenements(ev);
      if (user && user.id !== userId) {
        const { data: abo } = await supabase.from('abonnements').select('id')
          .eq('follower_id', user.id).eq('suivi_id', userId).maybeSingle();
        setEstAbonne(!!abo);
      }
    } catch (e) { console.error(e); }
    setChargement(false);
  };

  const toggleAbonnement = async () => {
    if (!monProfil?.id || estMoi || chargementAbonnement) return;
    setChargementAbonnement(true);
    const etaitAbonne = estAbonne;
    setEstAbonne(!etaitAbonne);
    setProfil(prev => prev ? { ...prev, nb_followers: Math.max(0, (prev.nb_followers || 0) + (etaitAbonne ? -1 : 1)) } : prev);
    try {
      if (etaitAbonne) {
        const { error } = await supabase.from('abonnements').delete()
          .eq('follower_id', monProfil.id).eq('suivi_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('abonnements').insert({ follower_id: monProfil.id, suivi_id: userId });
        if (error) throw error;
        supabase.rpc('creer_notification', {
          destinataire_id: userId,
          p_titre: `${monProfil.prenom || 'Quelqu\'un'} s'est abonné à toi`,
          p_corps: '',
          p_type: 'systeme',
        }).then(() => {});
      }
    } catch {
      setEstAbonne(etaitAbonne);
      setProfil(prev => prev ? { ...prev, nb_followers: Math.max(0, (prev.nb_followers || 0) + (etaitAbonne ? 1 : -1)) } : prev);
      Alert.alert('Erreur', 'Impossible de mettre à jour l\'abonnement');
    }
    setChargementAbonnement(false);
  };

  const ouvrirConversation = async () => {
    if (!monProfil?.id || !userId) return;
    try {
      const { data: mesMembres } = await supabase.from('conversation_membres').select('conversation_id').eq('user_id', monProfil.id);
      const { data: saMembres } = await supabase.from('conversation_membres').select('conversation_id').eq('user_id', userId);
      const mesIds = new Set((mesMembres || []).map(m => m.conversation_id));
      const convCommune = (saMembres || []).find(m => mesIds.has(m.conversation_id));
      if (convCommune) { navigation.navigate('Conversation', { convId: convCommune.conversation_id, interlocuteur: profil }); return; }
      const { data: convId, error } = await supabase.rpc('creer_conversation_directe', { autre_user_id: userId });
      if (error || !convId) return;
      navigation.navigate('Conversation', { convId, interlocuteur: profil });
    } catch { Alert.alert('Erreur', 'Impossible d\'ouvrir la conversation'); }
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
  const initiales = profil?.prenom ? profil.prenom.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';

  if (chargement) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color="#111" size="large" />
      </View>
    );
  }

  if (!profil) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={20} color="#2563EB" />
            <Text style={{ color: '#2563EB', fontSize: t(16) }}>Retour</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <View style={styles.videIcone}><Ionicons name="person-outline" size={26} color="#aaa" /></View>
          <Text style={{ color: '#111', fontSize: t(16), fontWeight: '600' }}>Profil introuvable</Text>
          <Text style={{ color: '#aaa', fontSize: t(13) }}>Cet utilisateur n'existe pas.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color="#2563EB" />
          <Text style={{ color: '#2563EB', fontSize: t(16) }}>Retour</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitre, { fontSize: t(16) }]} numberOfLines={1}>{profil.prenom || 'Profil'}</Text>
        <View style={{ width: 70, alignItems: 'flex-end' }}>
          {!estMoi && <BoutonSignaler type="profil" id={userId} couleur="#888" taille={19} />}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Hero ── */}
        <View style={styles.heroSection}>
          {profil.avatar_url ? (
            <Image source={{ uri: profil.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarDefaut]}>
              <Text style={{ color: '#fff', fontSize: 34, fontWeight: '600' }}>{initiales}</Text>
            </View>
          )}
          <Text style={[styles.nom, { fontSize: t(22) }]}>{profil.prenom}</Text>
          {profil.handle && <Text style={[styles.handle, { fontSize: t(13) }]}>{profil.handle}</Text>}
          {profil.arrondissement && (
            <View style={styles.lieuRow}>
              <Ionicons name="location-outline" size={13} color="#aaa" />
              <Text style={{ color: '#aaa', fontSize: t(13) }}>{profil.arrondissement}</Text>
            </View>
          )}
          {profil.bio && <Text style={[styles.bio, { fontSize: t(13) }]}>{profil.bio}</Text>}

          {/* Abonnés / Abonnements */}
          <View style={styles.compteursRow}>
            <TouchableOpacity style={styles.compteurItem} onPress={() => navigation.navigate('Abonnes', { userId, mode: 'followers', prenom: profil.prenom })}>
              <Text style={[styles.compteurNb, { fontSize: t(16) }]}>{profil.nb_followers || 0}</Text>
              <Text style={[styles.compteurLabel, { fontSize: t(12) }]}>Abonnés</Text>
            </TouchableOpacity>
            <View style={styles.compteurSep} />
            <TouchableOpacity style={styles.compteurItem} onPress={() => navigation.navigate('Abonnes', { userId, mode: 'following', prenom: profil.prenom })}>
              <Text style={[styles.compteurNb, { fontSize: t(16) }]}>{profil.nb_following || 0}</Text>
              <Text style={[styles.compteurLabel, { fontSize: t(12) }]}>Abonnements</Text>
            </TouchableOpacity>
          </View>

          {/* Badges */}
          <View style={styles.badgesRow}>
            {profil.is_organisateur && (
              <View style={[styles.badge, { backgroundColor: '#F3E8FF' }]}>
                <Ionicons name="star" size={10} color="#7E22CE" />
                <Text style={{ color: '#7E22CE', fontSize: t(10), fontWeight: '500' }}>Organisateur</Text>
              </View>
            )}
            {scoreConfiance >= 70 && (
              <View style={[styles.badge, { backgroundColor: '#DCFCE7' }]}>
                <Ionicons name="shield-checkmark" size={10} color="#15803D" />
                <Text style={{ color: '#15803D', fontSize: t(10), fontWeight: '500' }}>Fiable</Text>
              </View>
            )}
            {profil.created_at && (
              <View style={[styles.badge, { backgroundColor: '#f0f0ee' }]}>
                <Ionicons name="calendar-outline" size={10} color="#aaa" />
                <Text style={{ color: '#aaa', fontSize: t(10) }}>
                  Depuis {new Date(profil.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                </Text>
              </View>
            )}
          </View>

          {/* Boutons action */}
          {!estMoi ? (
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.btnAbonner, estAbonne && styles.btnAbonnerActif]}
                onPress={toggleAbonnement}
                activeOpacity={0.85}
                disabled={chargementAbonnement}
              >
                <Ionicons name={estAbonne ? 'checkmark' : 'add'} size={16} color={estAbonne ? '#111' : '#fff'} />
                <Text style={{ color: estAbonne ? '#111' : '#fff', fontSize: t(14), fontWeight: '600' }}>
                  {estAbonne ? 'Abonné' : 'Suivre'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnMessage, { flex: 1 }]} onPress={ouvrirConversation} activeOpacity={0.85}>
                <Ionicons name="chatbubble-outline" size={16} color="#fff" />
                <Text style={{ color: '#fff', fontSize: t(14), fontWeight: '600' }}>Message</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.btnMessage, { backgroundColor: '#f0f0ee' }]}
              onPress={() => navigation.navigate('Compte')}
              activeOpacity={0.85}
            >
              <Ionicons name="pencil-outline" size={16} color="#111" />
              <Text style={{ color: '#111', fontSize: t(14), fontWeight: '500' }}>Modifier mon profil</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Centres d'intérêt ── */}
        {profil.centres_interet?.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcone, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="heart-outline" size={14} color="#92400E" />
              </View>
              <Text style={[styles.sectionTitre, { fontSize: t(13) }]}>CENTRES D'INTÉRÊT</Text>
            </View>
            <View style={styles.interetsGrid}>
              {profil.centres_interet.map(interet => (
                <View key={interet} style={styles.interetTag}>
                  <Text style={{ color: '#666', fontSize: t(12) }}>{interet}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Stories actives ── */}
        {stories.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcone, { backgroundColor: '#F3E8FF' }]}>
                <Ionicons name="camera-outline" size={14} color="#7E22CE" />
              </View>
              <Text style={[styles.sectionTitre, { fontSize: t(13) }]}>STORIES · {stories.length}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {stories.map((story, i) => (
                  <TouchableOpacity
                    key={story.id}
                    style={styles.storyThumb}
                    onPress={() => { setStoryIndex(i); setStoryViewerVisible(true); }}
                    activeOpacity={0.85}
                  >
                    <Image source={{ uri: story.media_url }} style={styles.storyThumbImg} />
                    <View style={[styles.storyTypeDot, {
                      backgroundColor: story.type === 'spot' ? '#EF4444' : story.type === 'evenement' ? '#2563EB' : '#7C3AED'
                    }]} />
                    <View style={styles.storyVues}>
                      <Ionicons name="eye-outline" size={9} color="#fff" />
                      <Text style={{ color: '#fff', fontSize: 9 }}>{story.nb_vues || 0}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* ── Événements à venir ── */}
        {evenements.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcone, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="calendar-outline" size={14} color="#1D4ED8" />
              </View>
              <Text style={[styles.sectionTitre, { fontSize: t(13) }]}>ÉVÉNEMENTS · {evenements.length}</Text>
            </View>
            <View style={{ gap: 8, marginTop: 4 }}>
              {evenements.map(ev => (
                <TouchableOpacity
                  key={ev.id}
                  style={styles.evItem}
                  onPress={() => navigation.navigate('DetailEvenement', { evenement: ev })}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#111', fontSize: t(13), fontWeight: '500' }} numberOfLines={1}>{ev.titre}</Text>
                    {ev.lieu && <Text style={{ color: '#aaa', fontSize: t(11), marginTop: 2 }} numberOfLines={1}>📍 {ev.lieu}</Text>}
                    {ev.date_evenement && <Text style={{ color: '#2563EB', fontSize: t(11), marginTop: 2 }}>📅 {formatDate(ev.date_evenement)}</Text>}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 5 }}>
                    <View style={styles.participantsBadge}>
                      <Ionicons name="people-outline" size={11} color="#15803D" />
                      <Text style={{ color: '#15803D', fontSize: t(10) }}>
                        {ev.sans_max ? String(ev.participants || 0) : `${ev.participants || 0}/${ev.max || '?'}`}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={13} color="#ddd" />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Vide */}
        {stories.length === 0 && evenements.length === 0 && !profil.bio && !profil.centres_interet?.length && (
          <View style={[styles.section, { alignItems: 'center', padding: 32 }]}>
            <View style={styles.videIcone}><Ionicons name="person-outline" size={26} color="#aaa" /></View>
            <Text style={{ color: '#aaa', fontSize: t(13), marginTop: 10, textAlign: 'center' }}>
              {estMoi ? 'Complète ton profil pour qu\'il soit visible !' : 'Cet utilisateur n\'a rien partagé pour l\'instant.'}
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {storyViewerVisible && stories.length > 0 && (
        <Modal visible animationType="fade" statusBarTranslucent>
          <StoryViewer stories={stories} indexDepart={storyIndex} onFermer={() => setStoryViewerVisible(false)} navigation={navigation} />
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf8' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 54 : 16, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.06)', backgroundColor: '#fafaf8' },
  backBtn: { flexDirection: 'row', alignItems: 'center', width: 70 },
  headerTitre: { fontWeight: '600', color: '#111', flex: 1, textAlign: 'center' },
  scroll: { paddingBottom: 40 },
  heroSection: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.06)' },
  avatar: { width: 88, height: 88, borderRadius: 44, marginBottom: 14 },
  avatarDefaut: { backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  nom: { fontWeight: '700', color: '#111', letterSpacing: -0.5 },
  handle: { color: '#aaa', marginTop: 3 },
  lieuRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  bio: { color: '#666', textAlign: 'center', marginTop: 8, lineHeight: 19, paddingHorizontal: 20 },
  badgesRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginTop: 10 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  btnMessage: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#111', borderRadius: 14, paddingHorizontal: 22, paddingVertical: 13, marginTop: 14 },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 14, alignSelf: 'stretch', paddingHorizontal: 4 },
  btnAbonner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#2563EB', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, borderWidth: 1.5, borderColor: '#2563EB' },
  btnAbonnerActif: { backgroundColor: '#fff', borderColor: '#ddd' },
  compteursRow: { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 12 },
  compteurItem: { alignItems: 'center' },
  compteurNb: { fontWeight: '700', color: '#111' },
  compteurLabel: { color: '#aaa', marginTop: 1 },
  compteurSep: { width: 1, height: 24, backgroundColor: 'rgba(0,0,0,0.08)' },
  section: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.06)' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionIcone: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionTitre: { fontWeight: '700', color: '#aaa', letterSpacing: 0.06 },
  interetsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  interetTag: { backgroundColor: '#f0f0ee', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  storyThumb: { width: 70, height: 94, borderRadius: 14, overflow: 'hidden', position: 'relative' },
  storyThumbImg: { width: '100%', height: '100%' },
  storyTypeDot: { position: 'absolute', top: 6, left: 6, width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' },
  storyVues: { position: 'absolute', bottom: 5, right: 5, flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8, paddingHorizontal: 4, paddingVertical: 2 },
  evItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: '#f5f5f3', borderRadius: 13 },
  participantsBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#DCFCE7', borderRadius: 20, paddingHorizontal: 7, paddingVertical: 3 },
  videIcone: { width: 56, height: 56, borderRadius: 17, backgroundColor: '#f0f0ee', alignItems: 'center', justifyContent: 'center' },
});