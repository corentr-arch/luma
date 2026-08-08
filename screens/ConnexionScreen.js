import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Image, Modal, Platform, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../AppContext';
import { supabase } from '../supabase';
import StoryViewer from '../components/StoryViewer';

const CATEGORIES_DISPONIBLES = [
  'Sport', 'Musique', 'Apéro', 'Entraide', 'Art',
  'Marché', 'Nature & Bien-être', 'Famille', 'Cours', 'Cinéma', 'Théâtre', 'Gaming',
];

const ARRONDISSEMENTS = [
  'Paris 1er', 'Paris 2e', 'Paris 3e', 'Paris 4e', 'Paris 5e',
  'Paris 6e', 'Paris 7e', 'Paris 8e', 'Paris 9e', 'Paris 10e',
  'Paris 11e', 'Paris 12e', 'Paris 13e', 'Paris 14e', 'Paris 15e',
  'Paris 16e', 'Paris 17e', 'Paris 18e', 'Paris 19e', 'Paris 20e',
  'Banlieue / Autre',
];

const CAT_COULEURS = {
  'Sport': { forte: '#2563EB', claire: '#DBEAFE' },
  'Musique': { forte: '#A855F7', claire: '#F3E8FF' },
  'Apéro': { forte: '#F59E0B', claire: '#FEF3C7' },
  'Entraide': { forte: '#22C55E', claire: '#DCFCE7' },
  'Art': { forte: '#EC4899', claire: '#FCE7F3' },
  'Marché': { forte: '#EF4444', claire: '#FEE2E2' },
  'Nature & Bien-être': { forte: '#10B981', claire: '#D1FAE5' },
  'Famille': { forte: '#F97316', claire: '#FFEDD5' },
  'Cours': { forte: '#6366F1', claire: '#EEF2FF' },
  'Cinéma': { forte: '#9F1239', claire: '#FFF1F2' },
  'Théâtre': { forte: '#4F46E5', claire: '#EEF2FF' },
  'Gaming': { forte: '#7C3AED', claire: '#EDE9FE' },
};

export default function CompteScreen({ navigation }) {
  const { facteurTexte, profil, setProfil, CATEGORIES_COULEURS } = useApp();
  const [prenom, setPrenom] = useState('');
  const [bio, setBio] = useState('');
  const [arrondissement, setArrondissement] = useState('');
  const [centresInteret, setCentresInteret] = useState([]);
  const [modifie, setModifie] = useState(false);
  const [sauvegarde, setSauvegarde] = useState(false);
  const [uploadEnCours, setUploadEnCours] = useState(false);
  const [isOrganisateur, setIsOrganisateur] = useState(false);
  const [nbEvenementsActifs, setNbEvenementsActifs] = useState(0);
  const [nbStories, setNbStories] = useState(0);
  const [nbParticipations, setNbParticipations] = useState(0);
  const [mesStories, setMesStories] = useState([]);
  const [chargementStories, setChargementStories] = useState(false);
  const [storyViewerVisible, setStoryViewerVisible] = useState(false);
  const [storyIndex, setStoryIndex] = useState(0);
  const [mesFavoris, setMesFavoris] = useState([]);
  const [chargementFavoris, setChargementFavoris] = useState(false);
  const t = (size) => size * facteurTexte;

  useEffect(() => {
    if (profil) {
      setPrenom(profil.prenom || '');
      setBio(profil.bio || '');
      setArrondissement(profil.arrondissement || '');
      setCentresInteret(profil.centres_interet || []);
      setIsOrganisateur(profil.is_organisateur || false);
    }
    chargerTout();
  }, [profil]);

  const chargerTout = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await Promise.all([chargerStats(user.id), chargerMesStories(user.id), chargerMesFavoris(user.id)]);
  };

  const chargerStats = async (userId) => {
    const [{ count: evCount }, { count: storiesCount }, { count: partCount }] = await Promise.all([
      supabase.from('evenements').select('id', { count: 'exact', head: true }).eq('auteur_id', userId).eq('suspendu', false),
      supabase.from('stories').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('actif', true),
      supabase.from('participations').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    ]);
    setNbEvenementsActifs(evCount || 0);
    setNbStories(storiesCount || 0);
    setNbParticipations(partCount || 0);
  };

  const chargerMesStories = async (userId) => {
    setChargementStories(true);
    try {
      const { data } = await supabase.from('stories')
        .select('id, media_url, media_type, type, texte, adresse, created_at, expires_at, actif, nb_vues, nb_likes, latitude, longitude, profiles(id, prenom, avatar_url)')
        .eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
      if (data) setMesStories(data);
    } catch {}
    setChargementStories(false);
  };

  const chargerMesFavoris = async (userId) => {
    setChargementFavoris(true);
    try {
      const { data } = await supabase.from('favoris')
        .select('id, evenement_id, evenements(id, titre, lieu, date_evenement, categorie)')
        .eq('user_id', userId).order('created_at', { ascending: false }).limit(30);
      if (data) setMesFavoris(data.filter(f => f.evenements));
    } catch {}
    setChargementFavoris(false);
  };

  const supprimerStory = async (storyId) => {
    Alert.alert('Supprimer la story ?', 'Elle sera supprimée définitivement.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          const story = mesStories.find(s => s.id === storyId);
          if (story?.media_url) {
            const parts = story.media_url.split('/storage/v1/object/public/stories/');
            if (parts[1]) await supabase.storage.from('stories').remove([parts[1]]);
          }
          await supabase.from('stories').update({ actif: false }).eq('id', storyId);
          setMesStories(prev => prev.filter(s => s.id !== storyId));
          setNbStories(n => Math.max(0, n - 1));
        },
      },
    ]);
  };

  const supprimerFavori = async (favoriId) => {
    await supabase.from('favoris').delete().eq('id', favoriId);
    setMesFavoris(prev => prev.filter(f => f.id !== favoriId));
  };

  const detecterModification = (champ, valeur) => {
    if (!profil) return;
    const original = { prenom: profil.prenom || '', bio: profil.bio || '', arrondissement: profil.arrondissement || '', centresInteret: profil.centres_interet || [] };
    const actuel = { prenom, bio, arrondissement, centresInteret, [champ]: valeur };
    setModifie(actuel.prenom !== original.prenom || actuel.bio !== original.bio || actuel.arrondissement !== original.arrondissement || JSON.stringify(actuel.centresInteret) !== JSON.stringify(original.centresInteret));
  };

  const sauvegarder = async () => {
    setSauvegarde(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSauvegarde(false); return; }
    const { data, error } = await supabase.from('profiles').update({
      prenom: prenom.trim(), bio: bio.trim(), arrondissement,
      centres_interet: centresInteret, updated_at: new Date().toISOString(),
    }).eq('id', user.id).select().single();
    if (error) Alert.alert('Erreur', 'Impossible de sauvegarder.');
    else { setProfil(data); setModifie(false); Alert.alert('Sauvegardé !', 'Ton profil a été mis à jour.'); }
    setSauvegarde(false);
  };

  const choisirPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission refusée'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploadEnCours(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const base64 = result.assets[0].base64;
      const byteCharacters = atob(base64);
      const byteArray = new Uint8Array([...byteCharacters].map(c => c.charCodeAt(0)));
      const { error: uploadError } = await supabase.storage.from('avatars').upload(`${user.id}/avatar.jpg`, byteArray, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) { Alert.alert('Erreur upload', uploadError.message); return; }
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(`${user.id}/avatar.jpg`);
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', user.id);
      setProfil(prev => ({ ...prev, avatar_url: avatarUrl }));
      Alert.alert('Photo mise à jour !');
    } catch { Alert.alert('Erreur', 'Impossible de télécharger la photo.'); }
    setUploadEnCours(false);
  };

  const toggleCentreInteret = (cat) => {
    const nouveaux = centresInteret.includes(cat) ? centresInteret.filter(c => c !== cat) : [...centresInteret, cat];
    setCentresInteret(nouveaux);
    detecterModification('centresInteret', nouveaux);
  };

  const scoreConfiance = profil?.score_confiance || 0;
  const initiales = profil?.prenom ? profil.prenom.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U';
  const limiteEvenements = isOrganisateur ? '∞' : '3';
  const isExpired = (story) => new Date(story.expires_at) < new Date();

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color="#2563EB" />
          <Text style={{ color: '#2563EB', fontSize: t(16) }}>Retour</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitre, { fontSize: t(16) }]}>Mon profil</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Avatar hero ── */}
        <View style={styles.heroSection}>
          <TouchableOpacity onPress={choisirPhoto} disabled={uploadEnCours} style={styles.avatarWrap}>
            {profil?.avatar_url ? (
              <Image source={{ uri: profil.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarDefaut]}>
                <Text style={{ color: '#fff', fontSize: 34, fontWeight: '600' }}>{initiales}</Text>
              </View>
            )}
            <View style={styles.avatarEditBtn}>
              {uploadEnCours
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="camera" size={13} color="#fff" />
              }
            </View>
          </TouchableOpacity>

          <Text style={[styles.heroNom, { fontSize: t(22) }]}>{profil?.prenom || 'Utilisateur'}</Text>
          {profil?.handle && <Text style={[styles.heroHandle, { fontSize: t(13) }]}>{profil.handle}</Text>}
          {profil?.bio && <Text style={[styles.heroBio, { fontSize: t(13) }]}>{profil.bio}</Text>}

          {/* Badges */}
          <View style={styles.badgesRow}>
            {profil?.email_verifie && (
              <View style={[styles.badge, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="mail" size={10} color="#1D4ED8" />
                <Text style={{ color: '#1D4ED8', fontSize: t(10), fontWeight: '500' }}>Email vérifié</Text>
              </View>
            )}
            {isOrganisateur && (
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
          </View>
        </View>

        {/* ── Stats ── */}
        <View style={styles.statsRow}>
          {[
            { label: 'Événements', valeur: nbEvenementsActifs, icone: 'calendar-outline', couleur: '#2563EB', bg: '#DBEAFE' },
            { label: 'Stories', valeur: nbStories, icone: 'camera-outline', couleur: '#7E22CE', bg: '#F3E8FF' },
            { label: 'Participations', valeur: nbParticipations, icone: 'people-outline', couleur: '#15803D', bg: '#DCFCE7' },
          ].map((stat, i) => (
            <View key={i} style={styles.statItem}>
              <View style={[styles.statIcone, { backgroundColor: stat.bg }]}>
                <Ionicons name={stat.icone} size={16} color={stat.couleur} />
              </View>
              <Text style={{ color: '#111', fontSize: t(20), fontWeight: '700', marginTop: 6 }}>{stat.valeur}</Text>
              <Text style={{ color: '#aaa', fontSize: t(11), marginTop: 2 }}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Mes Stories ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcone}>
              <Ionicons name="camera-outline" size={14} color="#7E22CE" />
            </View>
            <Text style={[styles.sectionTitre, { fontSize: t(13) }]}>MES STORIES</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('CreerStory')}
              style={styles.sectionAction}
            >
              <Text style={{ color: '#2563EB', fontSize: t(13), fontWeight: '500' }}>Nouvelle</Text>
            </TouchableOpacity>
          </View>

          {chargementStories ? (
            <ActivityIndicator color="#111" style={{ marginVertical: 16 }} />
          ) : mesStories.length === 0 ? (
            <TouchableOpacity style={styles.videSection} onPress={() => navigation.navigate('CreerStory')}>
              <Ionicons name="camera-outline" size={26} color="#ddd" />
              <Text style={{ color: '#aaa', fontSize: t(13), marginTop: 8 }}>Aucune story</Text>
              <Text style={{ color: '#2563EB', fontSize: t(12), marginTop: 4, fontWeight: '500' }}>Créer ma première →</Text>
            </TouchableOpacity>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {mesStories.map((story, i) => {
                  const expired = isExpired(story);
                  return (
                    <TouchableOpacity
                      key={story.id}
                      style={styles.storyThumb}
                      onPress={() => { setStoryIndex(i); setStoryViewerVisible(true); }}
                      onLongPress={() => supprimerStory(story.id)}
                      activeOpacity={0.85}
                    >
                      <Image source={{ uri: story.media_url }} style={styles.storyThumbImg} />
                      {expired && (
                        <View style={styles.storyExpired}>
                          <Text style={{ color: '#fff', fontSize: 9, fontWeight: '600' }}>Expirée</Text>
                        </View>
                      )}
                      <View style={[styles.storyTypeDot, {
                        backgroundColor: story.type === 'spot' ? '#EF4444' : story.type === 'evenement' ? '#2563EB' : '#7C3AED'
                      }]} />
                      <View style={styles.storyVues}>
                        <Ionicons name="eye-outline" size={9} color="#fff" />
                        <Text style={{ color: '#fff', fontSize: 9 }}>{story.nb_vues || 0}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={styles.storyAjouter}
                  onPress={() => navigation.navigate('CreerStory')}
                >
                  <Ionicons name="add" size={26} color="#2563EB" />
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
          {mesStories.length > 0 && (
            <Text style={{ color: '#ddd', fontSize: t(10), marginTop: 8, textAlign: 'center' }}>
              Appuie longuement pour supprimer
            </Text>
          )}
        </View>

        {/* ── Mes Favoris ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcone, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="heart-outline" size={14} color="#DC2626" />
            </View>
            <Text style={[styles.sectionTitre, { fontSize: t(13) }]}>MES FAVORIS</Text>
            {mesFavoris.length > 0 && (
              <View style={[styles.countPill, { backgroundColor: '#FEE2E2' }]}>
                <Text style={{ color: '#DC2626', fontSize: t(10), fontWeight: '600' }}>{mesFavoris.length}</Text>
              </View>
            )}
          </View>

          {chargementFavoris ? (
            <ActivityIndicator color="#111" style={{ marginVertical: 16 }} />
          ) : mesFavoris.length === 0 ? (
            <View style={styles.videSection}>
              <Ionicons name="heart-outline" size={26} color="#ddd" />
              <Text style={{ color: '#aaa', fontSize: t(13), marginTop: 8 }}>Aucun favori</Text>
            </View>
          ) : (
            <View style={{ gap: 8, marginTop: 4 }}>
              {mesFavoris.map(fav => {
                const ev = fav.evenements;
                if (!ev) return null;
                return (
                  <TouchableOpacity
                    key={fav.id}
                    style={styles.favoriItem}
                    onPress={() => navigation.navigate('DetailEvenement', { evenement: ev })}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#111', fontSize: t(13), fontWeight: '500' }} numberOfLines={1}>{ev.titre}</Text>
                      {ev.lieu && <Text style={{ color: '#aaa', fontSize: t(11), marginTop: 2 }} numberOfLines={1}>📍 {ev.lieu}</Text>}
                      {ev.date_evenement && <Text style={{ color: '#2563EB', fontSize: t(11), marginTop: 2 }}>📅 {formatDate(ev.date_evenement)}</Text>}
                    </View>
                    <TouchableOpacity onPress={() => supprimerFavori(fav.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="heart" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* ── Prénom ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcone, { backgroundColor: '#DBEAFE' }]}>
              <Ionicons name="person-outline" size={14} color="#1D4ED8" />
            </View>
            <Text style={[styles.sectionTitre, { fontSize: t(13) }]}>PRÉNOM</Text>
          </View>
          <View style={styles.inputField}>
            <TextInput
              style={[styles.input, { fontSize: t(15), color: profil?.email_verifie ? '#111' : '#aaa' }]}
              value={prenom}
              onChangeText={(v) => { if (!profil?.email_verifie) return; setPrenom(v); detecterModification('prenom', v); }}
              editable={profil?.email_verifie}
              placeholder="Ton prénom"
              placeholderTextColor="#aaa"
              maxLength={50}
            />
          </View>
        </View>

        {/* ── Bio ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcone, { backgroundColor: '#F3E8FF' }]}>
              <Ionicons name="chatbubble-outline" size={14} color="#7E22CE" />
            </View>
            <Text style={[styles.sectionTitre, { fontSize: t(13) }]}>BIO</Text>
            <Text style={{ color: '#ddd', fontSize: t(10), marginLeft: 'auto' }}>{bio.length}/300</Text>
          </View>
          <TextInput
            style={[styles.inputMulti, { fontSize: t(14) }]}
            value={bio}
            onChangeText={(v) => { setBio(v); detecterModification('bio', v); }}
            placeholder="Présente-toi en quelques mots..."
            placeholderTextColor="#aaa"
            multiline
            maxLength={300}
          />
        </View>

        {/* ── Quartier ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcone, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="location-outline" size={14} color="#15803D" />
            </View>
            <Text style={[styles.sectionTitre, { fontSize: t(13) }]}>QUARTIER</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
            <View style={{ flexDirection: 'row', gap: 7 }}>
              {ARRONDISSEMENTS.map(arr => (
                <TouchableOpacity
                  key={arr}
                  style={[styles.chip, arrondissement === arr && styles.chipActif]}
                  onPress={() => { setArrondissement(arr); detecterModification('arrondissement', arr); }}
                >
                  <Text style={[styles.chipTxt, { fontSize: t(12) }, arrondissement === arr && { color: '#fff' }]}>
                    {arr}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* ── Centres d'intérêt ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcone, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="heart-outline" size={14} color="#92400E" />
            </View>
            <Text style={[styles.sectionTitre, { fontSize: t(13) }]}>CENTRES D'INTÉRÊT</Text>
            {centresInteret.length > 0 && (
              <Text style={{ color: '#aaa', fontSize: t(10), marginLeft: 'auto' }}>
                {centresInteret.length} sélectionné{centresInteret.length > 1 ? 's' : ''}
              </Text>
            )}
          </View>
          <View style={styles.catsGrid}>
            {CATEGORIES_DISPONIBLES.map(cat => {
              const c = CAT_COULEURS[cat] || { forte: '#888', claire: '#f5f5f5' };
              const actif = centresInteret.includes(cat);
              return (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catChip, { backgroundColor: actif ? c.forte : '#f5f5f5' }]}
                  onPress={() => toggleCentreInteret(cat)}
                >
                  <Text style={{ color: actif ? '#fff' : '#666', fontSize: t(12), fontWeight: actif ? '600' : '400' }}>
                    {cat}
                  </Text>
                  {actif && <Ionicons name="checkmark" size={12} color="#fff" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Score de confiance ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcone, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="shield-checkmark-outline" size={14} color="#15803D" />
            </View>
            <Text style={[styles.sectionTitre, { fontSize: t(13) }]}>SCORE DE CONFIANCE</Text>
            <Text style={{ color: '#111', fontSize: t(14), fontWeight: '600', marginLeft: 'auto' }}>{scoreConfiance}%</Text>
          </View>
          <View style={styles.scoreBar}>
            <View style={[styles.scoreRempli, {
              width: `${scoreConfiance}%`,
              backgroundColor: scoreConfiance >= 70 ? '#22C55E' : scoreConfiance >= 40 ? '#F59E0B' : '#EF4444',
            }]} />
          </View>
          <Text style={{ color: '#aaa', fontSize: t(12), marginTop: 8 }}>
            Vérifie ton email et ton téléphone pour augmenter ton score.
          </Text>
        </View>

        {/* ── Statut événements ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcone, { backgroundColor: '#DBEAFE' }]}>
              <Ionicons name="calendar-outline" size={14} color="#1D4ED8" />
            </View>
            <Text style={[styles.sectionTitre, { fontSize: t(13) }]}>ÉVÉNEMENTS ACTIFS</Text>
            <View style={[styles.countPill, {
              backgroundColor: isOrganisateur ? '#DCFCE7' : nbEvenementsActifs >= 3 ? '#FEE2E2' : '#DBEAFE',
              marginLeft: 'auto',
            }]}>
              <Text style={{
                fontSize: t(11), fontWeight: '600',
                color: isOrganisateur ? '#15803D' : nbEvenementsActifs >= 3 ? '#DC2626' : '#1D4ED8',
              }}>
                {nbEvenementsActifs}/{limiteEvenements}
              </Text>
            </View>
          </View>
          {!isOrganisateur && nbEvenementsActifs >= 3 && (
            <View style={styles.alerte}>
              <Ionicons name="warning-outline" size={13} color="#DC2626" />
              <Text style={{ color: '#DC2626', fontSize: t(12), flex: 1 }}>
                Limite atteinte. Supprime un événement pour en créer un nouveau.
              </Text>
            </View>
          )}
        </View>

        {/* ── Bouton sauvegarder ── */}
        {modifie && (
          <TouchableOpacity
            style={[styles.btnSauvegarder, { opacity: sauvegarde ? 0.7 : 1 }]}
            onPress={sauvegarder}
            disabled={sauvegarde}
            activeOpacity={0.85}
          >
            {sauvegarde
              ? <ActivityIndicator color="#fff" size="small" />
              : <><Ionicons name="checkmark-circle-outline" size={18} color="#fff" /><Text style={{ color: '#fff', fontSize: t(15), fontWeight: '600' }}>Sauvegarder</Text></>
            }
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {storyViewerVisible && mesStories.length > 0 && (
        <Modal visible animationType="fade" statusBarTranslucent>
          <StoryViewer
            stories={mesStories}
            indexDepart={storyIndex}
            onFermer={() => setStoryViewerVisible(false)}
            onStoryDeleted={(id) => { setMesStories(prev => prev.filter(s => s.id !== id)); setNbStories(n => Math.max(0, n - 1)); }}
            navigation={navigation}
          />
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf8' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 54 : 16, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.06)', backgroundColor: '#fafaf8' },
  backBtn: { flexDirection: 'row', alignItems: 'center', width: 70 },
  headerTitre: { fontWeight: '600', color: '#111' },
  scroll: { padding: 0, paddingBottom: 40 },

  heroSection: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.06)' },
  avatarWrap: { position: 'relative', marginBottom: 14 },
  avatar: { width: 88, height: 88, borderRadius: 44 },
  avatarDefaut: { backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  avatarEditBtn: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fafaf8' },
  heroNom: { fontWeight: '700', color: '#111', letterSpacing: -0.5 },
  heroHandle: { color: '#aaa', marginTop: 3 },
  heroBio: { color: '#666', textAlign: 'center', marginTop: 6, lineHeight: 18, paddingHorizontal: 20 },
  badgesRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginTop: 10 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },

  statsRow: { flexDirection: 'row', paddingVertical: 20, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.06)' },
  statItem: { flex: 1, alignItems: 'center' },
  statIcone: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },

  section: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.06)' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionIcone: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#f0f0ee', alignItems: 'center', justifyContent: 'center' },
  sectionTitre: { fontWeight: '700', color: '#aaa', letterSpacing: 0.06 },
  sectionAction: {},
  countPill: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },

  storyThumb: { width: 70, height: 94, borderRadius: 14, overflow: 'hidden', position: 'relative' },
  storyThumbImg: { width: '100%', height: '100%' },
  storyExpired: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  storyTypeDot: { position: 'absolute', top: 6, left: 6, width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' },
  storyVues: { position: 'absolute', bottom: 5, right: 5, flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8, paddingHorizontal: 4, paddingVertical: 2 },
  storyAjouter: { width: 70, height: 94, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#2563EB', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(37,99,235,0.04)' },

  videSection: { backgroundColor: '#f5f5f3', borderRadius: 14, padding: 20, alignItems: 'center' },
  favoriItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: '#f5f5f3', borderRadius: 13 },

  inputField: { backgroundColor: '#f0f0ee', borderRadius: 13, paddingHorizontal: 14, paddingVertical: 2 },
  input: { paddingVertical: 12 },
  inputMulti: { backgroundColor: '#f0f0ee', borderRadius: 13, padding: 14, minHeight: 80, textAlignVertical: 'top', color: '#111' },

  chip: { backgroundColor: '#f0f0ee', borderRadius: 20, paddingHorizontal: 13, paddingVertical: 8 },
  chipActif: { backgroundColor: '#111' },
  chipTxt: { color: '#666' },

  catsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 13, paddingVertical: 8 },

  scoreBar: { height: 6, backgroundColor: '#f0f0ee', borderRadius: 3, overflow: 'hidden', marginTop: 4 },
  scoreRempli: { height: '100%', borderRadius: 3 },
  alerte: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEE2E2', borderRadius: 10, padding: 10, marginTop: 10 },

  btnSauvegarder: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#111', borderRadius: 14, padding: 15, margin: 20, marginBottom: 0 },
});