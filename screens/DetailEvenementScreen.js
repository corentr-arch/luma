import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal, Image, Platform, Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { useApp } from '../AppContext';
import { useEvenements } from '../EvenementsContext';
import { supabase } from '../supabase';
import BoutonSignaler from '../components/BoutonSignaler';

export default function DetailEvenementScreen({ route, navigation }) {
  const { evenement: evenementParam } = route.params;
  const { facteurTexte, profil, ajouterFavori, estFavori, CATEGORIES_COULEURS, CAT_ICONES } = useApp();
  const { chargerEvenements } = useEvenements();
  const t = (s) => s * facteurTexte;

  const [evenement, setEvenement] = useState(evenementParam);
  const [chargement, setChargement] = useState(false);
  const [participation, setParticipation] = useState(false);
  const [commentaire, setCommentaire] = useState('');
  const [commentaires, setCommentaires] = useState([]);
  const [envoi, setEnvoi] = useState(false);
  const [auteur, setAuteur] = useState(null);

  const cat = CATEGORIES_COULEURS[evenement?.categorie] || { forte: '#2563EB', claire: '#DBEAFE', texte: '#1E40AF' };
  const estAuteur = profil?.id && evenement?.auteur_id === profil.id;
  const placesRestantes = evenement?.sans_max ? null : (evenement?.max || 0) - (evenement?.participants || 0);
  const complet = !evenement?.sans_max && placesRestantes <= 0;

  useEffect(() => {
    chargerDetails();
    chargerCommentaires();
    verifierParticipation();
  }, [evenement?.id]);

  const chargerDetails = async () => {
    if (!evenement?.id) return;
    try {
      const { data } = await supabase.from('evenements').select('*, participants:participants_count, max:max_participants, profiles:auteur_id(id, prenom, avatar_url, score_confiance)').eq('id', evenement.id).single();
      if (data) { setEvenement(data); if (data.profiles) setAuteur(data.profiles); }
    } catch {}
  };

  const chargerCommentaires = async () => {
    if (!evenement?.id) return;
    try {
      const { data } = await supabase.from('commentaires').select('*, profiles:auteur_id(id, prenom, avatar_url)').eq('evenement_id', evenement.id).order('created_at', { ascending: false }).limit(20);
      if (data) setCommentaires(data);
    } catch {}
  };

  const verifierParticipation = async () => {
    if (!profil?.id || !evenement?.id) return;
    try {
      const { data } = await supabase.from('participations').select('id').eq('evenement_id', evenement.id).eq('user_id', profil.id).single();
      setParticipation(!!data);
    } catch {}
  };

  const toggleParticipation = async () => {
    if (!profil?.id) { Alert.alert('Connexion requise'); return; }
    setChargement(true);
    try {
      if (participation) {
        await supabase.from('participations').delete().eq('evenement_id', evenement.id).eq('user_id', profil.id);
        await supabase.from('evenements').update({ participants_count: Math.max(0, (evenement.participants || 1) - 1) }).eq('id', evenement.id);
        setParticipation(false);
        setEvenement(prev => ({ ...prev, participants: Math.max(0, (prev.participants || 1) - 1) }));
      } else {
        if (complet) { Alert.alert('Complet', 'Il n\'y a plus de places disponibles.'); setChargement(false); return; }
        await supabase.from('participations').insert({ evenement_id: evenement.id, user_id: profil.id });
        await supabase.from('evenements').update({ participants_count: (evenement.participants || 0) + 1 }).eq('id', evenement.id);
        setParticipation(true);
        setEvenement(prev => ({ ...prev, participants: (prev.participants || 0) + 1 }));
        Alert.alert('Inscrit ! 🎉', 'Tu participeras à cet événement.');
        if (evenement.auteur_id && evenement.auteur_id !== profil.id) {
          supabase.rpc('creer_notification', {
            destinataire_id: evenement.auteur_id,
            p_titre: `${profil.prenom || 'Quelqu\'un'} participe à ton événement`,
            p_corps: evenement.titre || '',
            p_type: 'participation',
            p_evenement_id: evenement.id,
          }).then(() => {});
        }
      }
      chargerEvenements();
    } catch (e) { Alert.alert('Erreur', String(e?.message || e)); }
    setChargement(false);
  };

  const supprimerEvenement = () => {
    Alert.alert('Supprimer l\'événement ?', 'Cette action est irréversible.', [
      { text: 'Annuler' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        try {
          await supabase.from('evenements').delete().eq('id', evenement.id);
          chargerEvenements();
          navigation.goBack();
        } catch { Alert.alert('Erreur', 'Impossible de supprimer.'); }
      }},
    ]);
  };

  const envoyerCommentaire = async () => {
    if (!commentaire.trim() || !profil?.id || envoi) return;
    setEnvoi(true);
    try {
      const { data } = await supabase.from('commentaires').insert({
        evenement_id: evenement.id, auteur_id: profil.id, contenu: commentaire.trim(),
      }).select('*, profiles:auteur_id(id, prenom, avatar_url)').single();
      if (data) {
        setCommentaires(prev => [data, ...prev]);
        setCommentaire('');
        if (evenement.auteur_id && evenement.auteur_id !== profil.id) {
          supabase.rpc('creer_notification', {
            destinataire_id: evenement.auteur_id,
            p_titre: `${profil.prenom || 'Quelqu\'un'} a commenté ton événement`,
            p_corps: data.contenu.slice(0, 100),
            p_type: 'commentaire',
            p_evenement_id: evenement.id,
          }).then(() => {});
        }
      }
    } catch {}
    setEnvoi(false);
  };

  const formatDateEvenement = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const auj = new Date(); auj.setHours(0, 0, 0, 0);
    const dem = new Date(auj); dem.setDate(dem.getDate() + 1);
    if (d >= auj && d < dem) return `Aujourd'hui à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    if (d >= dem && d < new Date(dem.getTime() + 86400000)) return `Demain à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  };

  if (!evenement) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color="#2563EB" />
          <Text style={{ color: '#2563EB', fontSize: t(16) }}>Retour</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <TouchableOpacity onPress={() => Share.share({ message: `Luma — ${evenement.titre}` })} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="share-outline" size={22} color="#111" />
          </TouchableOpacity>
          {!estAuteur && <BoutonSignaler type="evenement" id={evenement.id} couleur="#aaa" />}
          {estAuteur && (
            <TouchableOpacity onPress={supprimerEvenement} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: cat.claire }]}>
          <View style={[styles.heroIcone, { backgroundColor: cat.forte }]}>
            <Ionicons name={CAT_ICONES[evenement.categorie] || 'calendar-outline'} size={30} color="#fff" />
          </View>
          <View style={[styles.catTag, { backgroundColor: cat.forte }]}>
            <Text style={{ color: '#fff', fontSize: t(12), fontWeight: '500' }}>{evenement.categorie}</Text>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={[styles.titre, { fontSize: t(24) }]}>{evenement.titre}</Text>

          {/* Infos */}
          <View style={styles.infosCard}>
            {evenement.date_evenement && (
              <View style={styles.infoRow}>
                <View style={[styles.infoIcone, { backgroundColor: cat.claire }]}>
                  <Ionicons name="calendar-outline" size={16} color={cat.forte} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoLabel, { fontSize: t(11) }]}>DATE</Text>
                  <Text style={[styles.infoVal, { fontSize: t(14) }]}>{formatDateEvenement(evenement.date_evenement)}</Text>
                </View>
              </View>
            )}

            {evenement.lieu && (
              <View style={[styles.infoRow, styles.infoSep]}>
                <View style={[styles.infoIcone, { backgroundColor: '#f0f0ee' }]}>
                  <Ionicons name="location-outline" size={16} color="#666" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoLabel, { fontSize: t(11) }]}>LIEU</Text>
                  <Text style={[styles.infoVal, { fontSize: t(14) }]}>{evenement.lieu}</Text>
                </View>
              </View>
            )}

            <View style={[styles.infoRow, styles.infoSep]}>
              <View style={[styles.infoIcone, { backgroundColor: '#DCFCE7' }]}>
                <Ionicons name="people-outline" size={16} color="#15803D" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoLabel, { fontSize: t(11) }]}>PARTICIPANTS</Text>
                <Text style={[styles.infoVal, { fontSize: t(14) }]}>
                  {evenement.sans_max
                    ? `${evenement.participants || 0} inscrits`
                    : `${evenement.participants || 0}/${evenement.max} places`}
                </Text>
                {!evenement.sans_max && placesRestantes !== null && placesRestantes <= 5 && placesRestantes > 0 && (
                  <Text style={{ color: '#F59E0B', fontSize: t(11), marginTop: 2, fontWeight: '500' }}>
                    ⚡ Plus que {placesRestantes} place{placesRestantes > 1 ? 's' : ''} !
                  </Text>
                )}
                {complet && <Text style={{ color: '#EF4444', fontSize: t(11), marginTop: 2, fontWeight: '500' }}>Complet</Text>}
              </View>
              <View style={[styles.placesJauge, { backgroundColor: '#f0f0ee' }]}>
                {!evenement.sans_max && evenement.max > 0 && (
                  <View style={[styles.placesRempli, {
                    width: `${Math.min(100, ((evenement.participants || 0) / evenement.max) * 100)}%`,
                    backgroundColor: complet ? '#EF4444' : cat.forte,
                  }]} />
                )}
              </View>
            </View>
          </View>

          {/* Auteur */}
          {auteur && (
            <TouchableOpacity
              style={styles.auteurCard}
              onPress={() => navigation.navigate('ProfilPublic', { userId: auteur.id })}
              activeOpacity={0.7}
            >
              {auteur.avatar_url ? (
                <Image source={{ uri: auteur.avatar_url }} style={styles.auteurAvatar} />
              ) : (
                <View style={[styles.auteurAvatar, styles.auteurAvatarDefaut]}>
                  <Text style={{ color: '#2563EB', fontWeight: '700', fontSize: 16 }}>
                    {(auteur.prenom || '?')[0].toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.auteurLabel, { fontSize: t(11) }]}>ORGANISÉ PAR</Text>
                <Text style={[styles.auteurNom, { fontSize: t(14) }]}>{auteur.prenom}</Text>
              </View>
              {auteur.score_confiance >= 70 && (
                <View style={styles.fiableBadge}>
                  <Ionicons name="shield-checkmark" size={12} color="#15803D" />
                  <Text style={{ color: '#15803D', fontSize: t(11), fontWeight: '500' }}>Fiable</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={15} color="#ddd" />
            </TouchableOpacity>
          )}

          {/* Description */}
          {evenement.description && (
            <View style={styles.descCard}>
              <Text style={[styles.sectionTitre, { fontSize: t(13) }]}>DESCRIPTION</Text>
              <Text style={{ color: '#555', fontSize: t(14), lineHeight: 22 }}>{evenement.description}</Text>
            </View>
          )}

          {/* Bouton participer */}
          <TouchableOpacity
            style={[styles.btnParticiper, {
              backgroundColor: participation ? '#f0f0ee' : complet ? '#f0f0ee' : cat.forte,
              opacity: chargement ? 0.7 : 1,
            }]}
            onPress={toggleParticipation}
            disabled={chargement || (!participation && complet)}
            activeOpacity={0.85}
          >
            {chargement ? (
              <ActivityIndicator color={participation ? '#111' : '#fff'} size="small" />
            ) : (
              <>
                <Ionicons
                  name={participation ? 'checkmark-circle' : complet ? 'close-circle' : 'add-circle-outline'}
                  size={20}
                  color={participation ? '#22C55E' : complet ? '#aaa' : '#fff'}
                />
                <Text style={[styles.btnParticiperTxt, { fontSize: t(15), color: participation ? '#22C55E' : complet ? '#aaa' : '#fff' }]}>
                  {participation ? 'Tu participes ✓' : complet ? 'Complet' : 'Participer'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Boutons secondaires */}
          <View style={styles.btnsRow}>
            <TouchableOpacity style={styles.btnSec} onPress={() => ajouterFavori(evenement)} activeOpacity={0.8}>
              <Ionicons name={estFavori(evenement.id) ? 'bookmark' : 'bookmark-outline'} size={18} color={estFavori(evenement.id) ? '#F59E0B' : '#111'} />
              <Text style={[styles.btnSecTxt, { fontSize: t(12) }]}>Favori</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSec} onPress={() => { /* navigation carte */ }} activeOpacity={0.8}>
              <Ionicons name="map-outline" size={18} color="#111" />
              <Text style={[styles.btnSecTxt, { fontSize: t(12) }]}>Carte</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSec} onPress={() => navigation.navigate('CreerStory', { evenement })} activeOpacity={0.8}>
              <Ionicons name="camera-outline" size={18} color="#111" />
              <Text style={[styles.btnSecTxt, { fontSize: t(12) }]}>Story</Text>
            </TouchableOpacity>
          </View>

          {/* Commentaires */}
          <View style={styles.commSection}>
            <Text style={[styles.sectionTitre, { fontSize: t(13) }]}>COMMENTAIRES · {commentaires.length}</Text>

            <View style={styles.commInput}>
              {profil?.avatar_url ? (
                <Image source={{ uri: profil.avatar_url }} style={styles.commAvatar} />
              ) : (
                <View style={[styles.commAvatar, { backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ color: '#2563EB', fontSize: 13, fontWeight: '700' }}>
                    {(profil?.prenom || 'U')[0].toUpperCase()}
                  </Text>
                </View>
              )}
              <TextInput
                style={[styles.commTextInput, { fontSize: t(14) }]}
                placeholder="Ajouter un commentaire..."
                placeholderTextColor="#aaa"
                value={commentaire}
                onChangeText={setCommentaire}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                onPress={envoyerCommentaire}
                disabled={!commentaire.trim() || envoi}
                style={[styles.commEnvoi, { backgroundColor: commentaire.trim() ? cat.forte : '#f0f0ee' }]}
              >
                {envoi
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="send" size={15} color={commentaire.trim() ? '#fff' : '#aaa'} />
                }
              </TouchableOpacity>
            </View>

            {commentaires.map((comm, i) => (
              <View key={comm.id || i} style={styles.commItem}>
                {comm.profiles?.avatar_url ? (
                  <Image source={{ uri: comm.profiles.avatar_url }} style={styles.commAvatar} />
                ) : (
                  <View style={[styles.commAvatar, { backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ color: '#2563EB', fontSize: 13, fontWeight: '700' }}>
                      {(comm.profiles?.prenom || '?')[0].toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.commBulle}>
                  <Text style={[styles.commAuteur, { fontSize: t(12) }]}>{comm.profiles?.prenom || 'Utilisateur'}</Text>
                  <Text style={[styles.commContenu, { fontSize: t(13) }]}>{comm.contenu}</Text>
                </View>
              </View>
            ))}

            {commentaires.length === 0 && (
              <View style={styles.commVide}>
                <Ionicons name="chatbubble-outline" size={24} color="#ddd" />
                <Text style={{ color: '#aaa', fontSize: t(13), marginTop: 6 }}>Aucun commentaire</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf8' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 54 : 16, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.06)', backgroundColor: '#fafaf8' },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  scroll: { paddingBottom: 48 },
  hero: { alignItems: 'center', paddingVertical: 28, gap: 12 },
  heroIcone: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  catTag: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  body: { padding: 16 },
  titre: { fontWeight: '700', color: '#111', letterSpacing: -0.5, marginBottom: 14, lineHeight: 30 },
  infosCard: { backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.06)' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  infoSep: { borderTopWidth: 0.5, borderTopColor: 'rgba(0,0,0,0.05)', marginTop: 12, paddingTop: 12 },
  infoIcone: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  infoLabel: { fontWeight: '700', color: '#aaa', letterSpacing: 0.06, marginBottom: 3 },
  infoVal: { fontWeight: '500', color: '#111' },
  placesJauge: { height: 4, width: 60, borderRadius: 2, overflow: 'hidden', alignSelf: 'center' },
  placesRempli: { height: '100%', borderRadius: 2 },
  auteurCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.06)' },
  auteurAvatar: { width: 42, height: 42, borderRadius: 21, flexShrink: 0 },
  auteurAvatarDefaut: { backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  auteurLabel: { fontWeight: '700', color: '#aaa', letterSpacing: 0.06, marginBottom: 2 },
  auteurNom: { fontWeight: '500', color: '#111' },
  fiableBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DCFCE7', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  descCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.06)' },
  sectionTitre: { fontWeight: '700', color: '#aaa', letterSpacing: 0.06, marginBottom: 10 },
  btnParticiper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, padding: 16, marginBottom: 10 },
  btnParticiperTxt: { fontWeight: '700' },
  btnsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  btnSec: { flex: 1, flexDirection: 'column', alignItems: 'center', gap: 5, backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.06)' },
  btnSecTxt: { color: '#111', fontWeight: '500' },
  commSection: { backgroundColor: '#fff', borderRadius: 18, padding: 14, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.06)' },
  commInput: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 16 },
  commAvatar: { width: 32, height: 32, borderRadius: 16, flexShrink: 0 },
  commTextInput: { flex: 1, backgroundColor: '#f0f0ee', borderRadius: 14, padding: 10, maxHeight: 80, color: '#111' },
  commEnvoi: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  commItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  commBulle: { flex: 1, backgroundColor: '#f5f5f3', borderRadius: 14, padding: 10 },
  commAuteur: { fontWeight: '600', color: '#111', marginBottom: 3 },
  commContenu: { color: '#555', lineHeight: 19 },
  commVide: { alignItems: 'center', padding: 20, gap: 6 },
});