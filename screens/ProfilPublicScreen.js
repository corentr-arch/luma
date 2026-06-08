import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { useApp } from '../AppContext';
import { supabase } from '../supabase';

const CAT_ICONES = {
  'Sport':              'football-outline',
  'Musique':            'musical-notes-outline',
  'Apéro':              'wine-outline',
  'Entraide':           'heart-outline',
  'Art':                'color-palette-outline',
  'Marché':             'storefront-outline',
  'Nature & Bien-être': 'leaf-outline',
  'Famille':            'people-outline',
  'Cours':              'school-outline',
};

function Etoiles({ note, taille = 14 }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Ionicons
          key={i}
          name={i <= note ? 'star' : i - 0.5 <= note ? 'star-half' : 'star-outline'}
          size={taille}
          color="#F59E0B"
        />
      ))}
    </View>
  );
}

export default function ProfilPublicScreen({ route, navigation }) {
  const { userId } = route.params;
  const { theme, facteurTexte, CATEGORIES_COULEURS } = useApp();
  const [profil, setProfil] = useState(null);
  const [evenements, setEvenements] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [userIdActuel, setUserIdActuel] = useState(null);
  const [estSuivi, setEstSuivi] = useState(false);
  const [nbFollowers, setNbFollowers] = useState(0);
  const [suiviEnCours, setSuiviEnCours] = useState(false);
  const t = (size) => size * facteurTexte;

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserIdActuel(user.id);
      await Promise.all([
        chargerProfil(user?.id),
        chargerEvenements(),
        chargerReviews(),
      ]);
      setChargement(false);
    };
    init();
  }, [userId]);

  const chargerProfil = async (currentUserId) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data) {
      setProfil(data);
      setNbFollowers(data.nb_followers || 0);
    }

    if (currentUserId && currentUserId !== userId) {
      const { data: follow } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', currentUserId)
        .eq('following_id', userId)
        .single();
      setEstSuivi(!!follow);
    }
  };

  const chargerEvenements = async () => {
    const { data } = await supabase
      .from('evenements')
      .select('id, titre, categorie, lieu, participants_count, date_evenement, type, note_moyenne, nb_reviews')
      .eq('auteur_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setEvenements(data);
  };

  const chargerReviews = async () => {
    try {
      const { data } = await supabase
        .from('reviews')
        .select(`
          id, note, texte, created_at, auteur_id,
          profiles:auteur_id(prenom, avatar_url),
          evenements:evenement_id(titre, auteur_id)
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      if (data) {
        const filtres = data.filter(r => r.evenements?.auteur_id === userId);
        setReviews(filtres);
      }
    } catch {}
  };

  const toggleSuivi = async () => {
    if (!userIdActuel || userIdActuel === userId) return;
    setSuiviEnCours(true);
    if (estSuivi) {
      await supabase.from('follows')
        .delete()
        .eq('follower_id', userIdActuel)
        .eq('following_id', userId);
      setEstSuivi(false);
      setNbFollowers(p => Math.max(0, p - 1));
    } else {
      await supabase.from('follows')
        .insert({ follower_id: userIdActuel, following_id: userId });
      setEstSuivi(true);
      setNbFollowers(p => p + 1);
    }
    setSuiviEnCours(false);
  };

  const contacter = async () => {
    if (!userIdActuel || !profil) return;
    try {
      const nomConv = `Message à ${profil.prenom}`;
      const { data: conv, error } = await supabase
        .from('conversations')
        .insert({ nom: nomConv, type: 'individuel' })
        .select().single();
      if (error || !conv) { Alert.alert('Erreur', 'Impossible de créer la conversation.'); return; }
      await supabase.from('conversation_membres').insert({ conversation_id: conv.id, user_id: userIdActuel });
      await supabase.from('conversation_membres').insert({ conversation_id: conv.id, user_id: userId });
      navigation.navigate('Conversation', { convId: conv.id });
    } catch { Alert.alert('Erreur', 'Une erreur est survenue.'); }
  };

  const scoreConfiance = profil?.score_confiance || 0;
  const initiales = profil?.prenom
    ? profil.prenom.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';
  const membreDepuis = profil?.created_at
    ? new Date(profil.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    : null;

  const eventsActifs = evenements.filter(e =>
    e.type === 'fixe' || !e.date_evenement || new Date(e.date_evenement) >= new Date()
  );
  const eventsPasses = evenements.filter(e =>
    e.type !== 'fixe' && e.date_evenement && new Date(e.date_evenement) < new Date()
  );
  const totalParticipants = evenements.reduce((acc, e) => acc + (e.participants_count || 0), 0);
  const noteMoyenne = reviews.length > 0
    ? (reviews.reduce((acc, r) => acc + r.note, 0) / reviews.length).toFixed(1)
    : null;

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
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 32 }}>
            <Ionicons name="chevron-back" size={22} color="#2563EB" />
          </TouchableOpacity>
          <Text style={[styles.headerTitre, { color: theme.text, fontSize: t(17) }]}>Profil</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 }}>
          <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="person-outline" size={28} color="#EF4444" />
          </View>
          <Text style={{ color: theme.text, fontSize: t(16), fontWeight: '500' }}>Profil introuvable</Text>
          <Text style={{ color: theme.text3, fontSize: t(13), textAlign: 'center' }}>
            Ce profil n'existe plus ou a été supprimé.
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: '#111', borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12 }}
            onPress={() => navigation.goBack()}
          >
            <Text style={{ color: '#fff', fontSize: t(14), fontWeight: '500' }}>Retour</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 32 }}>
          <Ionicons name="chevron-back" size={22} color="#2563EB" />
        </TouchableOpacity>
        <Text style={[styles.headerTitre, { color: theme.text, fontSize: t(17) }]}>
          {profil.prenom || 'Profil'}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView>

        {/* Header noir */}
        <View style={styles.profilHeader}>

          {/* Avatar */}
          <View style={styles.avatarWrap}>
            {profil.avatar_url ? (
              <Image source={{ uri: profil.avatar_url }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: '#2563EB' }]}>
                <Text style={{ color: '#fff', fontSize: 28, fontWeight: '500' }}>{initiales}</Text>
              </View>
            )}
            {scoreConfiance >= 70 && (
              <View style={[styles.avatarBadge, { backgroundColor: '#22C55E' }]}>
                <Ionicons name="shield-checkmark" size={10} color="#fff" />
              </View>
            )}
          </View>

          <Text style={[styles.profilNom, { fontSize: t(22) }]}>{profil.prenom}</Text>
          <Text style={[styles.profilHandle, { fontSize: t(13) }]}>
            {profil.handle || ''}
            {profil.arrondissement ? ` · ${profil.arrondissement}` : ''}
          </Text>

          {membreDepuis && (
            <Text style={[styles.membreDepuis, { fontSize: t(12) }]}>
              Membre depuis {membreDepuis}
            </Text>
          )}

          {/* Badges */}
          <View style={styles.badgesRow}>
            {profil.email_verifie && (
              <View style={[styles.verifBadge, { backgroundColor: 'rgba(34,197,94,0.2)' }]}>
                <Ionicons name="mail" size={11} color="#22C55E" />
                <Text style={{ color: '#22C55E', fontSize: t(11), fontWeight: '500' }}>Email vérifié</Text>
              </View>
            )}
            {profil.telephone_verifie && (
              <View style={[styles.verifBadge, { backgroundColor: 'rgba(37,99,235,0.2)' }]}>
                <Ionicons name="call" size={11} color="#60A5FA" />
                <Text style={{ color: '#60A5FA', fontSize: t(11), fontWeight: '500' }}>Tél vérifié</Text>
              </View>
            )}
          </View>

          {/* Score confiance */}
          <View style={styles.scoreWrap}>
            <View style={styles.scoreRow}>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: t(12) }}>Score de confiance</Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: t(12), fontWeight: '500' }}>
                {scoreConfiance}%
              </Text>
            </View>
            <View style={[styles.scoreBar, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
              <View style={[styles.scoreRempli, {
                width: `${scoreConfiance}%`,
                backgroundColor: scoreConfiance >= 70 ? '#22C55E' : scoreConfiance >= 40 ? '#F59E0B' : '#EF4444',
              }]} />
            </View>
          </View>

          {/* Note moyenne */}
          {noteMoyenne && (
            <View style={styles.noteMoyenneWrap}>
              <Etoiles note={parseFloat(noteMoyenne)} taille={16} />
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: t(13), fontWeight: '500' }}>
                {noteMoyenne} / 5
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: t(12) }}>
                ({reviews.length} avis)
              </Text>
            </View>
          )}

          {/* Stats */}
          <View style={styles.statsRow}>
            {[
              { val: String(evenements.length),  label: 'Événements',   bg: '#DBEAFE', c: '#1E40AF' },
              { val: String(totalParticipants),   label: 'Participants', bg: '#DCFCE7', c: '#15803D' },
              { val: String(nbFollowers),         label: 'Abonnés',      bg: '#F3E8FF', c: '#7E22CE' },
            ].map((s, i) => (
              <View key={i} style={[styles.statItem, { backgroundColor: s.bg }]}>
                <Text style={[styles.statVal, { color: s.c, fontSize: t(16) }]}>{s.val}</Text>
                <Text style={[styles.statLabel, { color: s.c, fontSize: t(9) }]}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* Boutons action */}
          {userIdActuel && userIdActuel !== userId && (
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.btnSuivre, {
                  backgroundColor: estSuivi ? 'rgba(255,255,255,0.1)' : '#2563EB',
                  opacity: suiviEnCours ? 0.7 : 1,
                }]}
                onPress={toggleSuivi}
                disabled={suiviEnCours}
              >
                {suiviEnCours ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons
                      name={estSuivi ? 'person-remove-outline' : 'person-add-outline'}
                      size={15} color="#fff"
                    />
                    <Text style={{ color: '#fff', fontSize: t(13), fontWeight: '500' }}>
                      {estSuivi ? 'Ne plus suivre' : 'Suivre'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnContacter, { backgroundColor: 'rgba(255,255,255,0.1)' }]}
                onPress={contacter}
              >
                <Ionicons name="chatbubble-outline" size={15} color="#fff" />
                <Text style={{ color: '#fff', fontSize: t(13), fontWeight: '500' }}>Message</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Bio */}
        {profil.bio && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardTitreRow}>
              <Ionicons name="person-outline" size={14} color={theme.text3} />
              <Text style={[styles.cardTitre, { color: theme.text3, fontSize: t(11) }]}>À PROPOS</Text>
            </View>
            <Text style={{ color: theme.text2, fontSize: t(14), lineHeight: 21 }}>{profil.bio}</Text>
          </View>
        )}

        {/* Centres d'intérêt */}
        {profil.centres_interet && profil.centres_interet.length > 0 && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardTitreRow}>
              <Ionicons name="heart-outline" size={14} color={theme.text3} />
              <Text style={[styles.cardTitre, { color: theme.text3, fontSize: t(11) }]}>CENTRES D'INTÉRÊT</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {profil.centres_interet.map((cat, i) => {
                const couleur = CATEGORIES_COULEURS[cat] || { claire: '#F5F5F5', forte: '#888', texte: '#444' };
                return (
                  <View key={i} style={[styles.centreBadge, { backgroundColor: couleur.claire }]}>
                    <Ionicons name={CAT_ICONES[cat] || 'construct-outline'} size={12} color={couleur.forte} />
                    <Text style={{ color: couleur.texte, fontSize: t(12), fontWeight: '500' }}>{cat}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Événements actifs */}
        {eventsActifs.length > 0 && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardTitreRow}>
              <Ionicons name="calendar-outline" size={14} color={theme.text3} />
              <Text style={[styles.cardTitre, { color: theme.text3, fontSize: t(11) }]}>
                ÉVÉNEMENTS ACTIFS ({eventsActifs.length})
              </Text>
            </View>
            {eventsActifs.map((e, i) => {
              const cat = CATEGORIES_COULEURS[e.categorie] || { claire: '#F5F5F5', forte: '#888', texte: '#444' };
              const iconE = CAT_ICONES[e.categorie] || 'construct-outline';
              return (
                <TouchableOpacity
                  key={e.id}
                  style={[styles.evenementRow, i > 0 && { borderTopWidth: 0.5, borderTopColor: theme.border }]}
                  onPress={() => navigation.navigate('DetailEvenement', { evenement: e })}
                >
                  <View style={[styles.evenementIcone, { backgroundColor: cat.claire }]}>
                    <Ionicons name={iconE} size={16} color={cat.forte} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontSize: t(13), fontWeight: '500' }} numberOfLines={1}>
                      {e.titre}
                    </Text>
                    <Text style={{ color: theme.text3, fontSize: t(11), marginTop: 2 }} numberOfLines={1}>
                      {e.lieu}
                    </Text>
                    {e.note_moyenne && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                        <Etoiles note={e.note_moyenne} taille={11} />
                        <Text style={{ color: theme.text3, fontSize: t(10) }}>
                          {e.note_moyenne} ({e.nb_reviews})
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View style={[styles.petitBadge, { backgroundColor: '#DCFCE7' }]}>
                      <Ionicons name="people-outline" size={9} color="#22C55E" />
                      <Text style={{ color: '#15803D', fontSize: t(10) }}>{e.participants_count || 0}</Text>
                    </View>
                    <View style={[styles.petitBadge, { backgroundColor: e.type === 'fixe' ? '#DCFCE7' : '#DBEAFE' }]}>
                      <Ionicons
                        name={e.type === 'fixe' ? 'location-outline' : 'timer-outline'}
                        size={9}
                        color={e.type === 'fixe' ? '#22C55E' : '#2563EB'}
                      />
                      <Text style={{ color: e.type === 'fixe' ? '#15803D' : '#1E40AF', fontSize: t(9) }}>
                        {e.type === 'fixe' ? 'Fixe' : 'Temp.'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Événements passés */}
        {eventsPasses.length > 0 && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardTitreRow}>
              <Ionicons name="time-outline" size={14} color={theme.text3} />
              <Text style={[styles.cardTitre, { color: theme.text3, fontSize: t(11) }]}>
                ÉVÉNEMENTS PASSÉS ({eventsPasses.length})
              </Text>
            </View>
            {eventsPasses.slice(0, 5).map((e, i) => {
              const cat = CATEGORIES_COULEURS[e.categorie] || { claire: '#F5F5F5', forte: '#888', texte: '#444' };
              const iconE = CAT_ICONES[e.categorie] || 'construct-outline';
              return (
                <TouchableOpacity
                  key={e.id}
                  style={[styles.evenementRow, { opacity: 0.7 }, i > 0 && { borderTopWidth: 0.5, borderTopColor: theme.border }]}
                  onPress={() => navigation.navigate('DetailEvenement', { evenement: e })}
                >
                  <View style={[styles.evenementIcone, { backgroundColor: cat.claire }]}>
                    <Ionicons name={iconE} size={16} color={cat.forte} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontSize: t(13), fontWeight: '500' }} numberOfLines={1}>
                      {e.titre}
                    </Text>
                    <Text style={{ color: theme.text3, fontSize: t(11), marginTop: 2 }}>
                      {e.participants_count || 0} participants
                      {e.note_moyenne ? ` · ★ ${e.note_moyenne}` : ''}
                    </Text>
                  </View>
                  <View style={[styles.petitBadge, { backgroundColor: '#F5F5F5' }]}>
                    <Text style={{ color: '#888', fontSize: t(9) }}>Terminé</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Avis reçus */}
        {reviews.length > 0 && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardTitreRow}>
              <Ionicons name="star-outline" size={14} color={theme.text3} />
              <Text style={[styles.cardTitre, { color: theme.text3, fontSize: t(11) }]}>
                AVIS REÇUS ({reviews.length})
              </Text>
              {noteMoyenne && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                  <Etoiles note={parseFloat(noteMoyenne)} taille={12} />
                  <Text style={{ color: theme.text3, fontSize: t(12), fontWeight: '500' }}>{noteMoyenne}</Text>
                </View>
              )}
            </View>
            {reviews.map((r, i) => (
              <View
                key={r.id}
                style={[styles.reviewRow, i > 0 && { borderTopWidth: 0.5, borderTopColor: theme.border }]}
              >
                {r.profiles?.avatar_url ? (
                  <Image source={{ uri: r.profiles.avatar_url }} style={styles.reviewAvatar} />
                ) : (
                  <View style={[styles.reviewAvatarDefaut, { backgroundColor: '#F3E8FF' }]}>
                    <Text style={{ color: '#A855F7', fontSize: 11, fontWeight: '500' }}>
                      {(r.profiles?.prenom || '?')[0].toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ color: theme.text, fontSize: t(13), fontWeight: '500' }}>
                      {r.profiles?.prenom || 'Utilisateur'}
                    </Text>
                    <Etoiles note={r.note} taille={12} />
                  </View>
                  {r.evenements?.titre && (
                    <Text style={{ color: '#2563EB', fontSize: t(11), marginBottom: 4 }}>
                      {r.evenements.titre}
                    </Text>
                  )}
                  {r.texte && (
                    <Text style={{ color: theme.text2, fontSize: t(13), lineHeight: 18 }}>{r.texte}</Text>
                  )}
                  <Text style={{ color: theme.text3, fontSize: t(11), marginTop: 4 }}>
                    {new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 56, borderBottomWidth: 0.5 },
  headerTitre: { fontWeight: '500', flex: 1, textAlign: 'center' },
  profilHeader: { backgroundColor: '#111', paddingBottom: 24, paddingHorizontal: 20, paddingTop: 24 },
  avatarWrap: { alignSelf: 'center', position: 'relative', marginBottom: 14 },
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 80, height: 80, borderRadius: 40 },
  avatarBadge: { position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#111' },
  profilNom: { color: '#fff', fontWeight: '500', textAlign: 'center', marginBottom: 4 },
  profilHandle: { color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginBottom: 4 },
  membreDepuis: { color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginBottom: 12 },
  badgesRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 14 },
  verifBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  scoreWrap: { marginBottom: 14 },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  scoreBar: { height: 4, borderRadius: 2, overflow: 'hidden' },
  scoreRempli: { height: '100%', borderRadius: 2 },
  noteMoyenneWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statItem: { flex: 1, borderRadius: 10, padding: 10, alignItems: 'center' },
  statVal: { fontWeight: '500' },
  statLabel: { marginTop: 2, textAlign: 'center' },
  actionsRow: { flexDirection: 'row', gap: 10 },
  btnSuivre: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, paddingVertical: 11 },
  btnContacter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, paddingVertical: 11 },
  card: { borderRadius: 14, padding: 14, margin: 12, marginTop: 0, marginBottom: 10, borderWidth: 0.5 },
  cardTitreRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  cardTitre: { fontWeight: '700', letterSpacing: 0.04 },
  centreBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  evenementRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  evenementIcone: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  petitBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 20, paddingHorizontal: 6, paddingVertical: 3 },
  reviewRow: { flexDirection: 'row', gap: 10, paddingVertical: 12 },
  reviewAvatar: { width: 36, height: 36, borderRadius: 18, flexShrink: 0 },
  reviewAvatarDefaut: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});