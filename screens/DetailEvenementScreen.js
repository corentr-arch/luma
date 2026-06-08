import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { useApp } from '../AppContext';
import { useEvenements } from '../EvenementsContext';
import { supabase } from '../supabase';

const RAISONS_SIGNALEMENT = [
  { key: 'inapproprie', label: 'Contenu inapproprié',       icon: 'warning-outline',      couleur: '#F59E0B', bg: '#FEF3C7' },
  { key: 'dangereux',   label: 'Lieu ou contenu dangereux', icon: 'skull-outline',         couleur: '#EF4444', bg: '#FEE2E2' },
  { key: 'spam',        label: 'Spam ou publicité',         icon: 'mail-unread-outline',   couleur: '#A855F7', bg: '#F3E8FF' },
  { key: 'faux',        label: 'Fausse information',        icon: 'close-circle-outline',  couleur: '#2563EB', bg: '#DBEAFE' },
  { key: 'autre',       label: 'Autre',                     icon: 'ellipsis-horizontal',   couleur: '#888888', bg: '#F5F5F5' },
];

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

function formatDateFin(evenement) {
  if (evenement.type === 'fixe') return null;
  if (evenement.date_fin) {
    const fin = new Date(evenement.date_fin);
    return `Jusqu'au ${fin.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à ${fin.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (evenement.duree_minutes && evenement.date_evenement) {
    const fin = new Date(evenement.date_evenement);
    fin.setMinutes(fin.getMinutes() + evenement.duree_minutes);
    return `Jusqu'à ${fin.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return null;
}

function calculerEstPasse(ev) {
  if (!ev || ev.type === 'fixe') return false;
  const maintenant = new Date();
  if (ev.date_fin) return new Date(ev.date_fin) < maintenant;
  if (ev.duree_minutes && ev.date_evenement) {
    const fin = new Date(ev.date_evenement);
    fin.setMinutes(fin.getMinutes() + ev.duree_minutes);
    return fin < maintenant;
  }
  if (ev.date_evenement) return new Date(ev.date_evenement) < maintenant;
  return false;
}

export default function DetailEvenementScreen({ route, navigation }) {
  const { evenement } = route.params;
  const { theme, facteurTexte, CATEGORIES_COULEURS, CAT_ICONES, ajouterFavori, estFavori } = useApp();
  const { supprimerEvenement } = useEvenements();

  const [commentaire, setCommentaire] = useState('');
  const [commentaires, setCommentaires] = useState([]);
  const [statut, setStatut] = useState('aucun');
  const [participationId, setParticipationId] = useState(null);
  const [nbParticipants, setNbParticipants] = useState(evenement.participants || evenement.participants_count || 0);
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [userId, setUserId] = useState(null);
  const [estCreateur, setEstCreateur] = useState(false);
  const [demandesEnAttente, setDemandesEnAttente] = useState([]);
  const [modalSignalement, setModalSignalement] = useState(false);
  const [raisonSignalement, setRaisonSignalement] = useState(null);
  const [detailsSignalement, setDetailsSignalement] = useState('');
  const [envoiSignalement, setEnvoiSignalement] = useState(false);
  const [dejaSignale, setDejaSignale] = useState(false);
  const [evenementComplet, setEvenementComplet] = useState(null);
  const [contactEnCours, setContactEnCours] = useState(false);
  const [historiqueOrganisateur, setHistoriqueOrganisateur] = useState([]);
  const [voirHistorique, setVoirHistorique] = useState(false);
  const [modalReview, setModalReview] = useState(false);
  const [noteReview, setNoteReview] = useState(0);
  const [texteReview, setTexteReview] = useState('');
  const [envoiReview, setEnvoiReview] = useState(false);
  const [maReview, setMaReview] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [aParticipe, setAParticipe] = useState(false);
  const t = (size) => size * facteurTexte;

  const ev = evenementComplet || evenement;
  const cat = CATEGORIES_COULEURS[ev?.categorie] || { claire: '#F5F5F5', forte: '#888', texte: '#444' };
  const icon = CAT_ICONES[ev?.categorie] || 'construct-outline';
  const estPasse = calculerEstPasse(ev);
  const maintenant = new Date();
  const infoFin = formatDateFin(ev);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // Charge l'événement complet — sans filtre suspendu pour pouvoir voir les événements terminés
      const { data: evData } = await supabase
        .from('evenements')
        .select(`
          *,
          profiles:auteur_id (
            id, prenom, handle, avatar_url, bio, arrondissement,
            centres_interet, score_confiance,
            telephone_verifie, email_verifie
          )
        `)
        .eq('id', evenement.id)
        .single();

      if (evData) {
        setEvenementComplet(evData);
        setNbParticipants(evData.participants_count || 0);
        setEstCreateur(user.id === evData.auteur_id);
        chargerHistoriqueOrganisateur(evData.auteur_id, evData.id);
      }

      await Promise.all([
        chargerCommentaires(),
        verifierStatutEtParticipation(user.id),
        verifierSignalement(user.id),
        chargerReviews(),
      ]);

      if (user.id === (evData?.auteur_id || evenement.auteur_id)) {
        await chargerDemandesEnAttente();
      }

      setChargement(false);
    };
    init();

    const sub = supabase
      .channel(`detail_${evenement.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'commentaires',
        filter: `evenement_id=eq.${evenement.id}`,
      }, chargerCommentaires)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'demandes_participation',
        filter: `evenement_id=eq.${evenement.id}`,
      }, chargerDemandesEnAttente)
      .subscribe();

    return () => supabase.removeChannel(sub);
  }, []);

  const chargerCommentaires = async () => {
    const { data } = await supabase
      .from('commentaires')
      .select('id, texte, created_at, auteur_id, profiles:auteur_id(prenom, avatar_url, telephone_verifie)')
      .eq('evenement_id', evenement.id)
      .order('created_at', { ascending: true });
    if (data) setCommentaires(data);
  };

  const chargerReviews = async () => {
    const { data } = await supabase
      .from('reviews')
      .select('id, note, texte, created_at, auteur_id, profiles:auteur_id(prenom, avatar_url)')
      .eq('evenement_id', evenement.id)
      .order('created_at', { ascending: false });
    if (data) setReviews(data);
  };

  // Vérifie statut ET participation en une seule fonction pour éviter les race conditions
  const verifierStatutEtParticipation = async (uid) => {
    // Vérifie participation directe — utilise maybeSingle pour ne pas crasher si absent
    const { data: part } = await supabase
      .from('participations')
      .select('id')
      .eq('evenement_id', evenement.id)
      .eq('user_id', uid)
      .maybeSingle();

    if (part) {
      setStatut('accepte');
      setParticipationId(part.id);
      setAParticipe(true);

      // Vérifie si une review existe déjà
      const { data: maR } = await supabase
        .from('reviews')
        .select('*')
        .eq('evenement_id', evenement.id)
        .eq('auteur_id', uid)
        .maybeSingle();
      if (maR) {
        setMaReview(maR);
        setNoteReview(maR.note);
        setTexteReview(maR.texte || '');
      }
      return;
    }

    // Vérifie demande en attente
    const { data: demande } = await supabase
      .from('demandes_participation')
      .select('id, statut')
      .eq('evenement_id', evenement.id)
      .eq('user_id', uid)
      .maybeSingle();
    if (demande) setStatut(demande.statut);
  };

  const verifierSignalement = async (uid) => {
    const { data } = await supabase
      .from('signalements').select('id')
      .eq('evenement_id', evenement.id).eq('auteur_id', uid)
      .maybeSingle();
    if (data) setDejaSignale(true);
  };

  const chargerDemandesEnAttente = async () => {
    const { data } = await supabase
      .from('demandes_participation')
      .select('id, statut, created_at, profiles:user_id(id, prenom, avatar_url, score_confiance, telephone_verifie)')
      .eq('evenement_id', evenement.id)
      .eq('statut', 'en_attente')
      .order('created_at', { ascending: true });
    if (data) setDemandesEnAttente(data);
  };

  const chargerHistoriqueOrganisateur = async (auteurId, evenementActuelId) => {
    const { data } = await supabase
      .from('evenements')
      .select('id, titre, categorie, lieu, participants_count, date_evenement, date_fin, duree_minutes, type, note_moyenne, nb_reviews')
      .eq('auteur_id', auteurId)
      .neq('id', evenementActuelId)
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) setHistoriqueOrganisateur(data);
  };

  const rejoindre = async () => {
    if (!userId) return;
    if (estPasse) { Alert.alert('Événement terminé', 'Cet événement est déjà terminé.'); return; }
    if (statut === 'accepte') {
      Alert.alert('Se désinscrire', 'Tu vas quitter cet événement.', [
        { text: 'Annuler' },
        {
          text: 'Quitter', style: 'destructive',
          onPress: async () => {
            await supabase.from('participations').delete().eq('id', participationId);
            await supabase.rpc('increment_participants', { event_id: ev.id, delta: -1 });
            setStatut('aucun');
            setParticipationId(null);
            setAParticipe(false);
            setNbParticipants(p => Math.max(0, p - 1));
          },
        },
      ]);
      return;
    }
    if (statut === 'en_attente') { Alert.alert('Demande en attente', 'Le créateur n\'a pas encore répondu.'); return; }
    if (statut === 'refuse') { Alert.alert('Demande refusée', 'Le créateur a refusé ta demande.'); return; }
    if (!ev.sans_max && ev.max_participants && nbParticipants >= ev.max_participants) { Alert.alert('Complet', 'Cet événement est complet.'); return; }

    if (ev.validation_requise) {
      const { data, error } = await supabase
        .from('demandes_participation')
        .insert({ evenement_id: ev.id, user_id: userId, statut: 'en_attente' })
        .select().single();
      if (error) { Alert.alert('Erreur', 'Impossible d\'envoyer la demande.'); return; }
      setStatut('en_attente');
      Alert.alert('Demande envoyée !', 'Le créateur va examiner ta demande.');
    } else {
      const { data, error } = await supabase
        .from('participations')
        .insert({ evenement_id: ev.id, user_id: userId })
        .select().single();
      if (error) { Alert.alert('Erreur', 'Impossible de rejoindre.'); return; }
      await supabase.rpc('increment_participants', { event_id: ev.id, delta: 1 });
      setStatut('accepte');
      setParticipationId(data.id);
      setAParticipe(true);
      setNbParticipants(p => p + 1);
      Alert.alert('Inscrit !', 'Tu participes à cet événement.');
    }
  };

  const gererDemande = async (demandeId, userIdDemandeur, accepter) => {
    await supabase.from('demandes_participation')
      .update({ statut: accepter ? 'accepte' : 'refuse' }).eq('id', demandeId);
    if (accepter) {
      await supabase.from('participations').insert({ evenement_id: ev.id, user_id: userIdDemandeur });
      await supabase.rpc('increment_participants', { event_id: ev.id, delta: 1 });
      setNbParticipants(p => p + 1);
    }
    await chargerDemandesEnAttente();
  };

  const envoyerCommentaire = async () => {
    if (!commentaire.trim() || !userId) return;
    setEnvoi(true);
    const { error } = await supabase.from('commentaires').insert({
      evenement_id: ev.id, auteur_id: userId, texte: commentaire.trim(),
    });
    if (!error) setCommentaire('');
    setEnvoi(false);
  };

  const soumettreReview = async () => {
    if (noteReview === 0) { Alert.alert('Note requise', 'Sélectionne une note entre 1 et 5.'); return; }
    if (!aParticipe) { Alert.alert('Non autorisé', 'Tu dois avoir participé à cet événement pour laisser un avis.'); return; }
    if (!estPasse) { Alert.alert('Événement en cours', 'Tu pourras laisser un avis une fois l\'événement terminé.'); return; }

    setEnvoiReview(true);
    const { data, error } = await supabase
      .from('reviews')
      .upsert({
        evenement_id: ev.id,
        auteur_id: userId,
        note: noteReview,
        texte: texteReview.trim() || null,
      }, { onConflict: 'evenement_id,auteur_id' })
      .select().single();

    if (error) {
      console.log('Erreur review:', error);
      Alert.alert('Erreur', 'Impossible d\'envoyer l\'avis. Vérifie que tu as bien participé à cet événement.');
    } else {
      setMaReview(data);
      setModalReview(false);
      await chargerReviews();
      Alert.alert('Merci !', 'Ton avis a été publié.');
    }
    setEnvoiReview(false);
  };

  const contacterOrganisateur = async () => {
    if (!userId || !ev.profiles) return;
    setContactEnCours(true);
    try {
      const nomConv = `Message à ${ev.profiles.prenom} — ${ev.titre}`;
      const { data: conv, error } = await supabase
        .from('conversations').insert({ nom: nomConv, type: 'individuel' }).select().single();
      if (error || !conv) { Alert.alert('Erreur', 'Impossible de créer la conversation.'); return; }
      await supabase.from('conversation_membres').insert({ conversation_id: conv.id, user_id: userId });
      await supabase.from('conversation_membres').insert({ conversation_id: conv.id, user_id: ev.auteur_id });
      navigation.navigate('Conversation', { convId: conv.id });
    } catch { Alert.alert('Erreur', 'Une erreur est survenue.'); }
    setContactEnCours(false);
  };

  const soumettreSignalement = async () => {
    if (!raisonSignalement) { Alert.alert('Raison requise'); return; }
    setEnvoiSignalement(true);
    const { error } = await supabase.from('signalements').insert({
      evenement_id: ev.id, auteur_id: userId,
      raison: raisonSignalement, details: detailsSignalement.trim() || null,
    });
    if (error) Alert.alert('Erreur', 'Impossible d\'envoyer le signalement.');
    else {
      setDejaSignale(true);
      setModalSignalement(false);
      Alert.alert('Signalement envoyé', 'Merci. Notre équipe va examiner cet événement.');
    }
    setEnvoiSignalement(false);
  };

  const handleSupprimerEvenement = () => {
    Alert.alert(
      'Supprimer l\'événement',
      'L\'événement sera supprimé de la carte mais restera dans l\'historique des participants.',
      [
        { text: 'Annuler' },
        {
          text: 'Supprimer', style: 'destructive',
          onPress: async () => {
            const ok = await supprimerEvenement(ev.id);
            if (ok) {
              Alert.alert('Supprimé', 'L\'événement a été supprimé.');
              navigation.goBack();
            } else {
              Alert.alert('Erreur', 'Impossible de supprimer l\'événement.');
            }
          },
        },
      ]
    );
  };

  const noteMoyenne = reviews.length > 0
    ? (reviews.reduce((acc, r) => acc + r.note, 0) / reviews.length).toFixed(1)
    : null;

  const labelBouton = () => {
    if (estPasse) return 'Événement terminé';
    if (statut === 'accepte') return 'Inscrit ✓ — Appuie pour quitter';
    if (statut === 'en_attente') return 'Demande envoyée — En attente';
    if (statut === 'refuse') return 'Demande refusée';
    if (ev.validation_requise) return 'Demander à rejoindre';
    return 'Je participe';
  };

  const couleurBouton = () => {
    if (estPasse) return '#888';
    if (statut === 'accepte') return '#22C55E';
    if (statut === 'en_attente') return '#F59E0B';
    if (statut === 'refuse') return '#EF4444';
    return '#111';
  };

  const iconeBouton = () => {
    if (estPasse) return 'time-outline';
    if (statut === 'accepte') return 'checkmark-circle';
    if (statut === 'en_attente') return 'time-outline';
    if (statut === 'refuse') return 'close-circle-outline';
    if (ev.validation_requise) return 'shield-checkmark-outline';
    return 'people-outline';
  };

  const totalParticipantsHistorique = historiqueOrganisateur.reduce(
    (acc, e) => acc + (e.participants_count || 0), 0
  );

  const eventsPasses = historiqueOrganisateur.filter(e => calculerEstPasse(e));

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 32 }}>
          <Ionicons name="chevron-back" size={22} color="#2563EB" />
        </TouchableOpacity>
        <Text style={[styles.headerTitre, { color: theme.text, fontSize: t(17) }]}>Détail</Text>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          {estCreateur && (
            <TouchableOpacity onPress={handleSupprimerEvenement}>
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
            </TouchableOpacity>
          )}
          {!estCreateur && !dejaSignale && (
            <TouchableOpacity onPress={() => setModalSignalement(true)}>
              <Ionicons name="flag-outline" size={20} color={theme.text3} />
            </TouchableOpacity>
          )}
          {dejaSignale && <Ionicons name="flag" size={20} color="#EF4444" />}
          <TouchableOpacity onPress={() => ajouterFavori(ev)}>
            <Ionicons
              name={estFavori(ev.id) ? 'bookmark' : 'bookmark-outline'}
              size={22}
              color={estFavori(ev.id) ? '#F59E0B' : theme.text3}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Card principale */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={[styles.catBanner, { backgroundColor: cat.claire }]}>
            <Ionicons name={icon} size={24} color={cat.forte} />
          </View>
          <Text style={[styles.titre, { color: theme.text, fontSize: t(20) }]}>{ev.titre}</Text>

          {noteMoyenne && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Etoiles note={parseFloat(noteMoyenne)} taille={14} />
              <Text style={{ color: theme.text3, fontSize: t(13) }}>
                {noteMoyenne} ({reviews.length} avis)
              </Text>
            </View>
          )}

          <View style={styles.badgesRow}>
            <View style={[styles.badge, {
              backgroundColor: ev.type === 'fixe' ? '#DCFCE7' : '#DBEAFE',
              flexDirection: 'row', alignItems: 'center', gap: 4,
            }]}>
              <Ionicons
                name={ev.type === 'fixe' ? 'location-outline' : 'timer-outline'}
                size={11}
                color={ev.type === 'fixe' ? '#22C55E' : '#2563EB'}
              />
              <Text style={[styles.badgeTexte, {
                color: ev.type === 'fixe' ? '#15803D' : '#1E40AF', fontSize: t(12),
              }]}>
                {ev.type === 'fixe' ? 'Lieu fixe' : 'Temporaire'}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: cat.claire }]}>
              <Text style={[styles.badgeTexte, { color: cat.texte, fontSize: t(12) }]}>{ev.categorie}</Text>
            </View>
            {ev.validation_requise && (
              <View style={[styles.badge, { backgroundColor: '#FEF3C7', flexDirection: 'row', gap: 4 }]}>
                <Ionicons name="shield-checkmark-outline" size={11} color="#92400E" />
                <Text style={[styles.badgeTexte, { color: '#92400E', fontSize: t(11) }]}>Validation</Text>
              </View>
            )}
            {estPasse && (
              <View style={[styles.badge, { backgroundColor: '#F5F5F5' }]}>
                <Text style={[styles.badgeTexte, { color: '#888', fontSize: t(11) }]}>Terminé</Text>
              </View>
            )}
          </View>

          {/* Créateur */}
          {ev.profiles && (
            <View style={[styles.createurWrap, { borderTopColor: theme.border }]}>
              <View style={styles.createurTop}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('ProfilPublic', { userId: ev.auteur_id })}
                >
                  {ev.profiles.avatar_url ? (
                    <Image source={{ uri: ev.profiles.avatar_url }} style={styles.createurAvatar} />
                  ) : (
                    <View style={[styles.createurAvatarDefaut, { backgroundColor: '#2563EB' }]}>
                      <Text style={{ color: '#fff', fontSize: 14, fontWeight: '500' }}>
                        {(ev.profiles.prenom || '?')[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('ProfilPublic', { userId: ev.auteur_id })}
                  >
                    <Text style={{ color: '#2563EB', fontSize: t(14), fontWeight: '500' }}>
                      {ev.profiles.prenom || 'Organisateur'}
                    </Text>
                  </TouchableOpacity>
                  {ev.profiles.arrondissement && (
                    <Text style={{ color: theme.text3, fontSize: t(12), marginTop: 1 }}>
                      {ev.profiles.arrondissement}
                    </Text>
                  )}
                  <View style={{ flexDirection: 'row', gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
                    {ev.profiles.email_verifie && (
                      <View style={[styles.createurBadge, { backgroundColor: '#DBEAFE' }]}>
                        <Ionicons name="mail" size={10} color="#2563EB" />
                        <Text style={{ color: '#1E40AF', fontSize: t(10) }}>Email vérifié</Text>
                      </View>
                    )}
                    {ev.profiles.telephone_verifie && (
                      <View style={[styles.createurBadge, { backgroundColor: '#DCFCE7' }]}>
                        <Ionicons name="checkmark-circle" size={10} color="#22C55E" />
                        <Text style={{ color: '#15803D', fontSize: t(10) }}>Tél vérifié</Text>
                      </View>
                    )}
                    {(ev.profiles.score_confiance || 0) >= 70 && (
                      <View style={[styles.createurBadge, { backgroundColor: '#FEF3C7' }]}>
                        <Ionicons name="shield-checkmark" size={10} color="#F59E0B" />
                        <Text style={{ color: '#92400E', fontSize: t(10) }}>Profil de confiance</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {ev.profiles.bio && (
                <Text style={[styles.createurBio, { color: theme.text3, fontSize: t(13) }]}>
                  {ev.profiles.bio}
                </Text>
              )}

              {ev.profiles.centres_interet && ev.profiles.centres_interet.length > 0 && (
                <View style={styles.centresRow}>
                  {ev.profiles.centres_interet.slice(0, 4).map((c, i) => {
                    const couleur = CATEGORIES_COULEURS[c] || { claire: '#F5F5F5', forte: '#888', texte: '#444' };
                    return (
                      <View key={i} style={[styles.centreBadge, { backgroundColor: couleur.claire }]}>
                        <Text style={{ color: couleur.texte, fontSize: t(11) }}>{c}</Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {historiqueOrganisateur.length > 0 && (
                <View style={[styles.statsOrgaWrap, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                  <View style={styles.statsOrgaRow}>
                    {[
                      { val: String(historiqueOrganisateur.length + 1), label: 'événements', bg: '#DBEAFE', c: '#1E40AF', icon: 'calendar-outline' },
                      { val: String(totalParticipantsHistorique + nbParticipants), label: 'participants', bg: '#DCFCE7', c: '#15803D', icon: 'people-outline' },
                      { val: String(eventsPasses.length), label: 'passés', bg: '#F5F5F5', c: '#888', icon: 'time-outline' },
                    ].map((s, i) => (
                      <View key={i} style={[styles.statsOrgaItem, { backgroundColor: s.bg }]}>
                        <Ionicons name={s.icon} size={12} color={s.c} />
                        <Text style={{ color: s.c, fontSize: t(15), fontWeight: '500' }}>{s.val}</Text>
                        <Text style={{ color: s.c, fontSize: t(9), textAlign: 'center' }}>{s.label}</Text>
                      </View>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={[styles.voirHistoriqueBtn, { borderTopColor: theme.border }]}
                    onPress={() => setVoirHistorique(!voirHistorique)}
                  >
                    <Ionicons name="list-outline" size={14} color="#2563EB" />
                    <Text style={{ color: '#2563EB', fontSize: t(13), flex: 1 }}>
                      {voirHistorique ? 'Masquer l\'historique' : `Voir les ${historiqueOrganisateur.length} autres événements`}
                    </Text>
                    <Ionicons name={voirHistorique ? 'chevron-up' : 'chevron-down'} size={14} color="#2563EB" />
                  </TouchableOpacity>

                  {voirHistorique && historiqueOrganisateur.map((e, i) => {
                    const catH = CATEGORIES_COULEURS[e.categorie] || { claire: '#F5F5F5', forte: '#888', texte: '#444' };
                    const iconH = CAT_ICONES[e.categorie] || 'construct-outline';
                    const estPasseH = calculerEstPasse(e);
                    return (
                      <TouchableOpacity
                        key={e.id}
                        style={[styles.historiqueItem, { borderTopColor: theme.border, opacity: estPasseH ? 0.6 : 1 }]}
                        onPress={() => navigation.push('DetailEvenement', { evenement: e })}
                      >
                        <View style={[styles.historiqueIcone, { backgroundColor: catH.claire }]}>
                          <Ionicons name={iconH} size={14} color={catH.forte} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: theme.text, fontSize: t(13), fontWeight: '500' }} numberOfLines={1}>
                            {e.titre}
                          </Text>
                          <Text style={{ color: theme.text3, fontSize: t(11), marginTop: 2 }} numberOfLines={1}>
                            {e.lieu}
                          </Text>
                          {e.note_moyenne && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                              <Etoiles note={e.note_moyenne} taille={10} />
                              <Text style={{ color: theme.text3, fontSize: t(10) }}>{e.note_moyenne}</Text>
                            </View>
                          )}
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          <View style={[styles.createurBadge, { backgroundColor: '#DCFCE7' }]}>
                            <Ionicons name="people-outline" size={9} color="#22C55E" />
                            <Text style={{ color: '#15803D', fontSize: t(10) }}>{e.participants_count || 0}</Text>
                          </View>
                          {estPasseH && (
                            <View style={[styles.createurBadge, { backgroundColor: '#F5F5F5' }]}>
                              <Text style={{ color: '#888', fontSize: t(9) }}>Terminé</Text>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {!estCreateur && userId && (
                <TouchableOpacity
                  style={[styles.contacterBtn, { backgroundColor: '#DBEAFE' }]}
                  onPress={contacterOrganisateur}
                  disabled={contactEnCours}
                >
                  {contactEnCours ? (
                    <ActivityIndicator size="small" color="#2563EB" />
                  ) : (
                    <>
                      <Ionicons name="chatbubble-outline" size={15} color="#2563EB" />
                      <Text style={{ color: '#1E40AF', fontSize: t(13), fontWeight: '500' }}>
                        Contacter l'organisateur
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Infos */}
        <View style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {ev.type !== 'fixe' && ev.date_evenement && (
            <View style={[styles.infoLigne, { borderBottomWidth: 0.5, borderBottomColor: theme.border }]}>
              <View style={[styles.infoIcone, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="calendar-outline" size={16} color="#2563EB" />
              </View>
              <Text style={[styles.infoTexte, { color: theme.text, fontSize: t(14) }]}>
                {new Date(ev.date_evenement).toLocaleDateString('fr-FR', {
                  weekday: 'long', day: 'numeric', month: 'long',
                })} à {new Date(ev.date_evenement).toLocaleTimeString('fr-FR', {
                  hour: '2-digit', minute: '2-digit',
                })}
              </Text>
            </View>
          )}
          {infoFin && (
            <View style={[styles.infoLigne, { borderBottomWidth: 0.5, borderBottomColor: theme.border }]}>
              <View style={[styles.infoIcone, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="flag-outline" size={16} color="#EF4444" />
              </View>
              <Text style={[styles.infoTexte, { color: theme.text, fontSize: t(14) }]}>{infoFin}</Text>
            </View>
          )}
          {ev.duree && (
            <View style={[styles.infoLigne, { borderBottomWidth: 0.5, borderBottomColor: theme.border }]}>
              <View style={[styles.infoIcone, { backgroundColor: '#F3E8FF' }]}>
                <Ionicons name="hourglass-outline" size={16} color="#A855F7" />
              </View>
              <Text style={[styles.infoTexte, { color: theme.text, fontSize: t(14) }]}>{ev.duree}</Text>
            </View>
          )}
          <View style={[styles.infoLigne, { borderBottomWidth: 0.5, borderBottomColor: theme.border }]}>
            <View style={[styles.infoIcone, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="location-outline" size={16} color="#22C55E" />
            </View>
            <Text style={[styles.infoTexte, { color: theme.text, fontSize: t(14) }]}>{ev.lieu || 'Paris'}</Text>
          </View>
          <View style={styles.infoLigne}>
            <View style={[styles.infoIcone, { backgroundColor: '#FCE7F3' }]}>
              <Ionicons name="people-outline" size={16} color="#EC4899" />
            </View>
            <Text style={[styles.infoTexte, { color: theme.text, fontSize: t(14) }]}>
              {ev.sans_max
                ? `${nbParticipants} participant${nbParticipants > 1 ? 's' : ''}`
                : `${nbParticipants} / ${ev.max_participants || '?'} participants`
              }
            </Text>
          </View>
        </View>

        {/* Description */}
        {ev.description ? (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitre, { color: theme.text3, fontSize: t(11) }]}>DESCRIPTION</Text>
            <Text style={[styles.description, { color: theme.text2, fontSize: t(14) }]}>{ev.description}</Text>
          </View>
        ) : null}

        {/* Avertissement */}
        <View style={[styles.avertissement, { backgroundColor: '#DBEAFE', borderColor: '#BFDBFE' }]}>
          <Ionicons name="shield-checkmark-outline" size={16} color="#2563EB" />
          <Text style={[styles.avertissementTexte, { color: '#1E40AF', fontSize: t(12) }]}>
            Événement en lieu public. Ne communique jamais ton adresse personnelle.
          </Text>
        </View>

        {/* Règles */}
        <TouchableOpacity
          style={[styles.reglesBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={() => Alert.alert('Règles Luma', '1. Lieux publics uniquement\n2. Respect de tous\n3. Pas d\'adresse personnelle\n4. Signaler tout contenu inapproprié')}
        >
          <Ionicons name="document-text-outline" size={14} color={theme.text3} />
          <Text style={{ color: theme.text3, fontSize: t(12) }}>Règles de la communauté</Text>
          <Ionicons name="chevron-forward" size={13} color={theme.text3} />
        </TouchableOpacity>

        {/* Demandes en attente */}
        {estCreateur && demandesEnAttente.length > 0 && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitre, { color: theme.text3, fontSize: t(11) }]}>
              DEMANDES EN ATTENTE ({demandesEnAttente.length})
            </Text>
            {demandesEnAttente.map((demande, i) => (
              <View key={demande.id} style={[styles.demandeRow, i > 0 && { borderTopWidth: 0.5, borderTopColor: theme.border }]}>
                <View style={[styles.demandeAvatar, { backgroundColor: '#F3E8FF' }]}>
                  <Text style={{ color: '#A855F7', fontSize: 13, fontWeight: '500' }}>
                    {(demande.profiles?.prenom || '?')[0].toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontSize: t(13), fontWeight: '500' }}>
                    {demande.profiles?.prenom || 'Utilisateur'}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 5, marginTop: 3, flexWrap: 'wrap' }}>
                    {demande.profiles?.telephone_verifie && (
                      <View style={[styles.createurBadge, { backgroundColor: '#DCFCE7' }]}>
                        <Ionicons name="checkmark-circle" size={10} color="#22C55E" />
                        <Text style={{ color: '#15803D', fontSize: t(10) }}>Tél vérifié</Text>
                      </View>
                    )}
                    <View style={[styles.createurBadge, { backgroundColor: '#DBEAFE' }]}>
                      <Ionicons name="shield-outline" size={10} color="#2563EB" />
                      <Text style={{ color: '#1E40AF', fontSize: t(10) }}>{demande.profiles?.score_confiance || 0}%</Text>
                    </View>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={[styles.demandeBtn, { backgroundColor: '#DCFCE7' }]}
                    onPress={() => gererDemande(demande.id, demande.profiles?.id, true)}
                  >
                    <Ionicons name="checkmark" size={18} color="#22C55E" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.demandeBtn, { backgroundColor: '#FEE2E2' }]}
                    onPress={() => gererDemande(demande.id, demande.profiles?.id, false)}
                  >
                    <Ionicons name="close" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Reviews — visibles par tous, bouton uniquement pour participants après l'événement */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={[styles.sectionTitre, { color: theme.text3, fontSize: t(11), marginBottom: 0 }]}>
              AVIS & NOTES{reviews.length > 0 && ` (${reviews.length})`}
            </Text>
            {/* Bouton avis — uniquement si participé ET événement terminé */}
            {aParticipe && estPasse && !estCreateur && (
              <TouchableOpacity
                style={[styles.btnAvis, { backgroundColor: maReview ? '#DCFCE7' : '#DBEAFE' }]}
                onPress={() => setModalReview(true)}
              >
                <Ionicons
                  name={maReview ? 'checkmark-circle' : 'star-outline'}
                  size={14}
                  color={maReview ? '#22C55E' : '#2563EB'}
                />
                <Text style={{ color: maReview ? '#15803D' : '#1E40AF', fontSize: t(12), fontWeight: '500' }}>
                  {maReview ? 'Mon avis ✓' : 'Laisser un avis'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {reviews.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 16, gap: 6 }}>
              <Ionicons name="star-outline" size={24} color={theme.text3} />
              <Text style={{ color: theme.text3, fontSize: t(13), fontStyle: 'italic' }}>
                Aucun avis pour le moment
              </Text>
              {aParticipe && estPasse && !estCreateur && (
                <Text style={{ color: theme.text3, fontSize: t(12) }}>
                  Sois le premier à laisser un avis !
                </Text>
              )}
              {aParticipe && !estPasse && (
                <Text style={{ color: theme.text3, fontSize: t(12) }}>
                  Tu pourras laisser un avis après l'événement.
                </Text>
              )}
            </View>
          ) : (
            <>
              <View style={[styles.noteMoyenneCard, { backgroundColor: theme.bg }]}>
                <Text style={{ color: theme.text, fontSize: t(28), fontWeight: '500' }}>{noteMoyenne}</Text>
                <View style={{ gap: 4 }}>
                  <Etoiles note={parseFloat(noteMoyenne)} taille={16} />
                  <Text style={{ color: theme.text3, fontSize: t(12) }}>{reviews.length} avis</Text>
                </View>
              </View>
              {reviews.map((r, i) => (
                <View key={r.id} style={[styles.reviewRow, i > 0 && { borderTopWidth: 0.5, borderTopColor: theme.border }]}>
                  <TouchableOpacity onPress={() => navigation.navigate('ProfilPublic', { userId: r.auteur_id })}>
                    {r.profiles?.avatar_url ? (
                      <Image source={{ uri: r.profiles.avatar_url }} style={styles.reviewAvatar} />
                    ) : (
                      <View style={[styles.reviewAvatarDefaut, { backgroundColor: '#F3E8FF' }]}>
                        <Text style={{ color: '#A855F7', fontSize: 13, fontWeight: '500' }}>
                          {(r.profiles?.prenom || '?')[0].toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <TouchableOpacity onPress={() => navigation.navigate('ProfilPublic', { userId: r.auteur_id })}>
                        <Text style={{ color: '#2563EB', fontSize: t(13), fontWeight: '500' }}>
                          {r.profiles?.prenom || 'Utilisateur'}
                        </Text>
                      </TouchableOpacity>
                      <Etoiles note={r.note} taille={12} />
                    </View>
                    {r.texte && (
                      <Text style={{ color: theme.text2, fontSize: t(13), lineHeight: 18 }}>{r.texte}</Text>
                    )}
                    <Text style={{ color: theme.text3, fontSize: t(11), marginTop: 4 }}>
                      {new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          )}
        </View>

        {/* Commentaires */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitre, { color: theme.text3, fontSize: t(11) }]}>
            QUESTIONS & COMMENTAIRES{commentaires.length > 0 && ` (${commentaires.length})`}
          </Text>
          {chargement ? (
            <ActivityIndicator color="#2563EB" style={{ padding: 16 }} />
          ) : commentaires.length === 0 ? (
            <View style={styles.videCommentaires}>
              <Ionicons name="chatbubble-outline" size={24} color={theme.text3} />
              <Text style={[styles.videCommentairesTexte, { color: theme.text3, fontSize: t(13) }]}>
                Sois le premier à poser une question !
              </Text>
            </View>
          ) : (
            commentaires.map((c, i) => (
              <View key={c.id} style={[styles.commentaire, i > 0 && { borderTopWidth: 0.5, borderTopColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.navigate('ProfilPublic', { userId: c.auteur_id })}>
                  {c.profiles?.avatar_url ? (
                    <Image source={{ uri: c.profiles.avatar_url }} style={styles.commentaireAvatar} />
                  ) : (
                    <View style={[styles.commentaireAvatarDefaut, { backgroundColor: '#F3E8FF' }]}>
                      <Text style={{ color: '#A855F7', fontSize: 13, fontWeight: '500' }}>
                        {(c.profiles?.prenom || '?')[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
                <View style={styles.commentaireContenu}>
                  <View style={styles.commentaireTop}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <TouchableOpacity onPress={() => navigation.navigate('ProfilPublic', { userId: c.auteur_id })}>
                        <Text style={{ color: '#2563EB', fontSize: t(13), fontWeight: '500' }}>
                          {c.profiles?.prenom || 'Utilisateur'}
                        </Text>
                      </TouchableOpacity>
                      {c.profiles?.telephone_verifie && (
                        <Ionicons name="checkmark-circle" size={12} color="#22C55E" />
                      )}
                    </View>
                    <Text style={{ color: theme.text3, fontSize: t(11) }}>
                      {new Date(c.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                  <Text style={[styles.commentaireTexte, { color: theme.text2, fontSize: t(13) }]}>
                    {c.texte}
                  </Text>
                </View>
              </View>
            ))
          )}
          <View style={styles.champCommentaire}>
            <TextInput
              style={[styles.inputCommentaire, {
                backgroundColor: theme.bg, color: theme.text,
                borderColor: theme.border, fontSize: t(13),
              }]}
              placeholder="Poser une question ou commenter..."
              placeholderTextColor={theme.text3}
              value={commentaire}
              onChangeText={setCommentaire}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.envoyerBtn, { backgroundColor: commentaire.trim() ? '#111' : theme.border }]}
              onPress={envoyerCommentaire}
              disabled={!commentaire.trim() || envoi}
            >
              {envoi ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={16} color="#fff" />}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Bouton participation */}
      {!estCreateur && (
        <View style={[styles.bas, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
          <TouchableOpacity
            style={[styles.btnPrincipal, { backgroundColor: couleurBouton() }]}
            onPress={rejoindre}
            disabled={estPasse}
          >
            <Ionicons name={iconeBouton()} size={20} color="#fff" />
            <Text style={[styles.btnTexte, { fontSize: t(14) }]}>{labelBouton()}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Modal signalement */}
      <Modal visible={modalSignalement} transparent animationType="slide" onRequestClose={() => setModalSignalement(false)}>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalSignalement(false)} />
          <View style={[styles.modalSheet, { backgroundColor: theme.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitre, { color: theme.text, fontSize: t(17) }]}>Signaler cet événement</Text>
              <TouchableOpacity onPress={() => setModalSignalement(false)}>
                <Ionicons name="close" size={22} color={theme.text3} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContenu}>
              <Text style={[styles.modalLabel, { color: theme.text3, fontSize: t(11) }]}>RAISON *</Text>
              {RAISONS_SIGNALEMENT.map((r) => (
                <TouchableOpacity
                  key={r.key}
                  style={[styles.raisonBtn, {
                    backgroundColor: raisonSignalement === r.key ? r.bg : theme.bg,
                    borderColor: raisonSignalement === r.key ? r.couleur : theme.border,
                    borderWidth: raisonSignalement === r.key ? 1.5 : 0.5,
                  }]}
                  onPress={() => setRaisonSignalement(r.key)}
                >
                  <View style={[styles.raisonIcone, { backgroundColor: r.bg }]}>
                    <Ionicons name={r.icon} size={16} color={r.couleur} />
                  </View>
                  <Text style={{ color: raisonSignalement === r.key ? r.couleur : theme.text, fontSize: t(14), flex: 1 }}>
                    {r.label}
                  </Text>
                  {raisonSignalement === r.key && <Ionicons name="checkmark-circle" size={18} color={r.couleur} />}
                </TouchableOpacity>
              ))}
              <Text style={[styles.modalLabel, { color: theme.text3, fontSize: t(11), marginTop: 12 }]}>DÉTAILS (optionnel)</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: theme.bg, color: theme.text, borderColor: theme.border, fontSize: t(14) }]}
                placeholder="Explique brièvement le problème..."
                placeholderTextColor={theme.text3}
                value={detailsSignalement}
                onChangeText={setDetailsSignalement}
                multiline
                maxLength={300}
              />
              <TouchableOpacity
                style={[styles.modalBtnEnvoyer, { backgroundColor: '#EF4444', opacity: envoiSignalement || !raisonSignalement ? 0.5 : 1 }]}
                onPress={soumettreSignalement}
                disabled={envoiSignalement || !raisonSignalement}
              >
                {envoiSignalement
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <><Ionicons name="flag" size={18} color="#fff" /><Text style={{ color: '#fff', fontSize: t(15), fontWeight: '500' }}>Envoyer le signalement</Text></>
                }
              </TouchableOpacity>
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal review */}
      <Modal visible={modalReview} transparent animationType="slide" onRequestClose={() => setModalReview(false)}>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalReview(false)} />
          <View style={[styles.modalSheet, { backgroundColor: theme.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitre, { color: theme.text, fontSize: t(17) }]}>
                {maReview ? 'Modifier mon avis' : 'Laisser un avis'}
              </Text>
              <TouchableOpacity onPress={() => setModalReview(false)}>
                <Ionicons name="close" size={22} color={theme.text3} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContenu}>
              <Text style={{ color: theme.text, fontSize: t(14), fontWeight: '500', textAlign: 'center', marginBottom: 16 }}>
                {ev.titre}
              </Text>
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ color: theme.text3, fontSize: t(12), marginBottom: 12 }}>
                  Quelle note donnes-tu à cet événement ?
                </Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <TouchableOpacity key={i} onPress={() => setNoteReview(i)}>
                      <Ionicons
                        name={i <= noteReview ? 'star' : 'star-outline'}
                        size={36}
                        color={i <= noteReview ? '#F59E0B' : theme.text3}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
                {noteReview > 0 && (
                  <Text style={{ color: '#F59E0B', fontSize: t(13), fontWeight: '500', marginTop: 8 }}>
                    {['', 'Décevant', 'Passable', 'Bien', 'Très bien', 'Excellent !'][noteReview]}
                  </Text>
                )}
              </View>
              <Text style={[styles.modalLabel, { color: theme.text3, fontSize: t(11) }]}>COMMENTAIRE (optionnel)</Text>
              <TextInput
                style={[styles.modalInput, {
                  backgroundColor: theme.bg, color: theme.text,
                  borderColor: theme.border, fontSize: t(14), minHeight: 100,
                }]}
                placeholder="Décris ton expérience..."
                placeholderTextColor={theme.text3}
                value={texteReview}
                onChangeText={setTexteReview}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[styles.modalBtnEnvoyer, {
                  backgroundColor: '#F59E0B',
                  opacity: envoiReview || noteReview === 0 ? 0.5 : 1,
                }]}
                onPress={soumettreReview}
                disabled={envoiReview || noteReview === 0}
              >
                {envoiReview
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <><Ionicons name="star" size={18} color="#fff" /><Text style={{ color: '#fff', fontSize: t(15), fontWeight: '500' }}>{maReview ? 'Modifier l\'avis' : 'Publier l\'avis'}</Text></>
                }
              </TouchableOpacity>
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 56, borderBottomWidth: 0.5 },
  headerTitre: { fontWeight: '500', flex: 1, textAlign: 'center' },
  scroll: { padding: 12, paddingBottom: 100, gap: 10 },
  card: { borderRadius: 14, padding: 16, borderWidth: 0.5 },
  catBanner: { width: 52, height: 52, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  titre: { fontWeight: '500', marginBottom: 10 },
  badgesRow: { flexDirection: 'row', gap: 7, flexWrap: 'wrap', marginBottom: 12 },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  badgeTexte: { fontWeight: '500' },
  createurWrap: { paddingTop: 14, borderTopWidth: 0.5 },
  createurTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  createurAvatar: { width: 44, height: 44, borderRadius: 22 },
  createurAvatarDefaut: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  createurBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2 },
  createurBio: { lineHeight: 19, marginBottom: 10 },
  centresRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 12 },
  centreBadge: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 },
  statsOrgaWrap: { borderRadius: 12, borderWidth: 0.5, marginBottom: 12, overflow: 'hidden' },
  statsOrgaRow: { flexDirection: 'row', padding: 12, gap: 8 },
  statsOrgaItem: { flex: 1, borderRadius: 10, padding: 10, alignItems: 'center', gap: 4 },
  voirHistoriqueBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderTopWidth: 0.5 },
  historiqueItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderTopWidth: 0.5 },
  historiqueIcone: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  contacterBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, padding: 11 },
  infoCard: { borderRadius: 14, borderWidth: 0.5, overflow: 'hidden' },
  infoLigne: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 },
  infoIcone: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  infoTexte: {},
  sectionTitre: { fontWeight: '700', letterSpacing: 0.4, marginBottom: 12 },
  description: { lineHeight: 22 },
  avertissement: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderRadius: 12, padding: 12, borderWidth: 0.5 },
  avertissementTexte: { flex: 1, lineHeight: 18 },
  reglesBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12, borderWidth: 0.5 },
  demandeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  demandeAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  demandeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  btnAvis: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  noteMoyenneCard: { flexDirection: 'row', alignItems: 'center', gap: 16, borderRadius: 12, padding: 14, marginBottom: 12 },
  reviewRow: { flexDirection: 'row', gap: 10, paddingVertical: 10 },
  reviewAvatar: { width: 36, height: 36, borderRadius: 18, flexShrink: 0 },
  reviewAvatarDefaut: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  videCommentaires: { alignItems: 'center', gap: 8, paddingVertical: 20 },
  videCommentairesTexte: { fontStyle: 'italic' },
  commentaire: { flexDirection: 'row', gap: 10, paddingVertical: 10 },
  commentaireAvatar: { width: 36, height: 36, borderRadius: 18, flexShrink: 0 },
  commentaireAvatarDefaut: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  commentaireContenu: { flex: 1 },
  commentaireTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  commentaireTexte: { lineHeight: 19 },
  champCommentaire: { flexDirection: 'row', gap: 8, marginTop: 14, alignItems: 'flex-end' },
  inputCommentaire: { flex: 1, borderRadius: 12, padding: 11, maxHeight: 100, borderWidth: 0.5 },
  envoyerBtn: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  bas: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 32, borderTopWidth: 0.5 },
  btnPrincipal: { borderRadius: 14, padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnTexte: { color: '#fff', fontWeight: '500' },
  modalContainer: { flex: 1, justifyContent: 'flex-end' },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 0.5 },
  modalTitre: { fontWeight: '500' },
  modalContenu: { padding: 20 },
  modalLabel: { fontWeight: '700', letterSpacing: 0.04, marginBottom: 10 },
  raisonBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 12, marginBottom: 8 },
  raisonIcone: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modalInput: { borderRadius: 12, padding: 12, borderWidth: 0.5, marginBottom: 16, textAlignVertical: 'top' },
  modalBtnEnvoyer: { borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});