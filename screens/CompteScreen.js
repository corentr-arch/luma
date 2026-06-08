import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../AppContext';
import { supabase } from '../supabase';

const CATEGORIES_DISPONIBLES = [
  'Sport', 'Musique', 'Apéro', 'Entraide', 'Art',
  'Marché', 'Nature & Bien-être', 'Famille', 'Cours',
];

const ARRONDISSEMENTS = [
  'Paris 1er', 'Paris 2e', 'Paris 3e', 'Paris 4e', 'Paris 5e',
  'Paris 6e', 'Paris 7e', 'Paris 8e', 'Paris 9e', 'Paris 10e',
  'Paris 11e', 'Paris 12e', 'Paris 13e', 'Paris 14e', 'Paris 15e',
  'Paris 16e', 'Paris 17e', 'Paris 18e', 'Paris 19e', 'Paris 20e',
  'Banlieue / Autre',
];

export default function CompteScreen({ navigation }) {
  const { theme, facteurTexte, profil, setProfil, CATEGORIES_COULEURS } = useApp();
  const [prenom, setPrenom] = useState('');
  const [bio, setBio] = useState('');
  const [arrondissement, setArrondissement] = useState('');
  const [centresInteret, setCentresInteret] = useState([]);
  const [modifie, setModifie] = useState(false);
  const [sauvegarde, setSauvegarde] = useState(false);
  const [uploadEnCours, setUploadEnCours] = useState(false);
  const [nbEvenementsActifs, setNbEvenementsActifs] = useState(0);
  const [isOrganisateur, setIsOrganisateur] = useState(false);
  const t = (size) => size * facteurTexte;

  useEffect(() => {
    if (profil) {
      setPrenom(profil.prenom || '');
      setBio(profil.bio || '');
      setArrondissement(profil.arrondissement || '');
      setCentresInteret(profil.centres_interet || []);
      setIsOrganisateur(profil.is_organisateur || false);
    }
    chargerStats();
  }, [profil]);

  const chargerStats = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { count } = await supabase
      .from('evenements')
      .select('id', { count: 'exact' })
      .eq('auteur_id', user.id)
      .eq('suspendu', false);
    setNbEvenementsActifs(count || 0);
  };

  const detecterModification = (champ, valeur) => {
    if (!profil) return;
    const original = {
      prenom: profil.prenom || '',
      bio: profil.bio || '',
      arrondissement: profil.arrondissement || '',
      centresInteret: profil.centres_interet || [],
    };
    const actuel = {
      prenom, bio, arrondissement, centresInteret,
      [champ]: valeur,
    };
    setModifie(
      actuel.prenom !== original.prenom ||
      actuel.bio !== original.bio ||
      actuel.arrondissement !== original.arrondissement ||
      JSON.stringify(actuel.centresInteret) !== JSON.stringify(original.centresInteret)
    );
  };

  const sauvegarder = async () => {
    setSauvegarde(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSauvegarde(false); return; }

    const { data, error } = await supabase
      .from('profiles')
      .update({
        prenom: prenom.trim(),
        bio: bio.trim(),
        arrondissement,
        centres_interet: centresInteret,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      Alert.alert('Erreur', 'Impossible de sauvegarder.');
    } else {
      setProfil(data);
      setModifie(false);
      Alert.alert('Sauvegardé !', 'Ton profil a été mis à jour.');
    }
    setSauvegarde(false);
  };

  const choisirPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'Active l\'accès aux photos dans les réglages.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (result.canceled || !result.assets[0]) return;

    setUploadEnCours(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const base64 = result.assets[0].base64;
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(`${user.id}/avatar.jpg`, byteArray, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        Alert.alert('Erreur upload', uploadError.message);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(`${user.id}/avatar.jpg`);

      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      await supabase.from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id);

      setProfil(prev => ({ ...prev, avatar_url: avatarUrl }));
      Alert.alert('Photo mise à jour !');
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de télécharger la photo.');
    }
    setUploadEnCours(false);
  };

  const toggleCentreInteret = (cat) => {
    const nouveaux = centresInteret.includes(cat)
      ? centresInteret.filter(c => c !== cat)
      : [...centresInteret, cat];
    setCentresInteret(nouveaux);
    detecterModification('centresInteret', nouveaux);
  };

  const scoreConfiance = profil?.score_confiance || 0;
  const initiales = profil?.prenom
    ? profil.prenom.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const limiteEvenements = isOrganisateur ? '∞' : '3';
  const couleurLimite = isOrganisateur
    ? '#22C55E'
    : nbEvenementsActifs >= 3 ? '#EF4444' : nbEvenementsActifs === 2 ? '#F59E0B' : '#2563EB';

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 32 }}>
          <Ionicons name="chevron-back" size={22} color="#2563EB" />
        </TouchableOpacity>
        <Text style={[styles.headerTitre, { color: theme.text, fontSize: t(17) }]}>Mon compte</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={choisirPhoto} disabled={uploadEnCours}>
            {profil?.avatar_url ? (
              <Image source={{ uri: profil.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarDefaut, { backgroundColor: '#2563EB' }]}>
                <Text style={{ color: '#fff', fontSize: 32, fontWeight: '500' }}>{initiales}</Text>
              </View>
            )}
            <View style={[styles.avatarEdit, { backgroundColor: '#111' }]}>
              {uploadEnCours
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="camera" size={14} color="#fff" />
              }
            </View>
          </TouchableOpacity>
          <Text style={[styles.avatarNom, { color: theme.text, fontSize: t(20) }]}>
            {profil?.prenom || 'Utilisateur'}
          </Text>
          <Text style={{ color: theme.text3, fontSize: t(13) }}>
            {profil?.handle || ''}
          </Text>

          {/* Badges */}
          <View style={styles.badgesRow}>
            {profil?.email_verifie && (
              <View style={[styles.badge, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="mail" size={11} color="#2563EB" />
                <Text style={{ color: '#1E40AF', fontSize: t(11), fontWeight: '500' }}>Email vérifié</Text>
              </View>
            )}
            {profil?.telephone_verifie && (
              <View style={[styles.badge, { backgroundColor: '#DCFCE7' }]}>
                <Ionicons name="checkmark-circle" size={11} color="#22C55E" />
                <Text style={{ color: '#15803D', fontSize: t(11), fontWeight: '500' }}>Tél vérifié</Text>
              </View>
            )}
            {isOrganisateur && (
              <View style={[styles.badge, { backgroundColor: '#F3E8FF' }]}>
                <Ionicons name="star" size={11} color="#A855F7" />
                <Text style={{ color: '#7E22CE', fontSize: t(11), fontWeight: '500' }}>Organisateur</Text>
              </View>
            )}
          </View>
        </View>

        {/* Score de confiance */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.cardTitreRow}>
            <Ionicons name="shield-checkmark-outline" size={14} color={theme.text3} />
            <Text style={[styles.cardTitre, { color: theme.text3, fontSize: t(11) }]}>SCORE DE CONFIANCE</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={[styles.scoreBar, { backgroundColor: theme.bg }]}>
              <View style={[styles.scoreRempli, {
                width: `${scoreConfiance}%`,
                backgroundColor: scoreConfiance >= 70 ? '#22C55E' : scoreConfiance >= 40 ? '#F59E0B' : '#EF4444',
              }]} />
            </View>
            <Text style={{ color: theme.text, fontSize: t(16), fontWeight: '500' }}>
              {scoreConfiance}%
            </Text>
          </View>
          <Text style={{ color: theme.text3, fontSize: t(12), marginTop: 6 }}>
            Augmente ton score en vérifiant ton email et ton téléphone.
          </Text>
        </View>

        {/* Statut événements */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.cardTitreRow}>
            <Ionicons name="calendar-outline" size={14} color={theme.text3} />
            <Text style={[styles.cardTitre, { color: theme.text3, fontSize: t(11) }]}>MES ÉVÉNEMENTS ACTIFS</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontSize: t(14) }}>
                {nbEvenementsActifs} / {limiteEvenements} événements actifs
              </Text>
              {!isOrganisateur && (
                <Text style={{ color: theme.text3, fontSize: t(12), marginTop: 3 }}>
                  {nbEvenementsActifs >= 3
                    ? 'Limite atteinte — supprime un événement pour en créer un nouveau.'
                    : `Il te reste ${3 - nbEvenementsActifs} emplacement${3 - nbEvenementsActifs > 1 ? 's' : ''}.`
                  }
                </Text>
              )}
              {isOrganisateur && (
                <Text style={{ color: '#22C55E', fontSize: t(12), marginTop: 3 }}>
                  Compte organisateur — limite illimitée ✓
                </Text>
              )}
            </View>
            <View style={[styles.compteurBadge, { backgroundColor: couleurLimite + '20', borderColor: couleurLimite }]}>
              <Text style={{ color: couleurLimite, fontSize: t(18), fontWeight: '700' }}>
                {nbEvenementsActifs}
              </Text>
              <Text style={{ color: couleurLimite, fontSize: t(10) }}>/{limiteEvenements}</Text>
            </View>
          </View>
          {!isOrganisateur && nbEvenementsActifs >= 3 && (
            <View style={[styles.alerteLimite, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="warning-outline" size={14} color="#EF4444" />
              <Text style={{ color: '#EF4444', fontSize: t(12), flex: 1 }}>
                Tu as atteint la limite. Supprime ou attends la fin d'un événement.
              </Text>
            </View>
          )}
        </View>

        {/* Prénom */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.cardTitreRow}>
            <Ionicons name="person-outline" size={14} color={theme.text3} />
            <Text style={[styles.cardTitre, { color: theme.text3, fontSize: t(11) }]}>PRÉNOM</Text>
            {!profil?.email_verifie && (
              <View style={[styles.verouilleBadge, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="lock-closed" size={10} color="#F59E0B" />
                <Text style={{ color: '#92400E', fontSize: t(10) }}>Email non vérifié</Text>
              </View>
            )}
          </View>
          <TextInput
            style={[styles.input, {
              color: profil?.email_verifie ? theme.text : theme.text3,
              borderColor: theme.border,
              fontSize: t(15),
              backgroundColor: profil?.email_verifie ? 'transparent' : theme.bg,
            }]}
            value={prenom}
            onChangeText={(v) => {
              if (!profil?.email_verifie) return;
              setPrenom(v);
              detecterModification('prenom', v);
            }}
            editable={profil?.email_verifie}
            placeholder="Ton prénom"
            placeholderTextColor={theme.text3}
            maxLength={50}
          />
        </View>

        {/* Bio */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.cardTitreRow}>
            <Ionicons name="chatbubble-outline" size={14} color={theme.text3} />
            <Text style={[styles.cardTitre, { color: theme.text3, fontSize: t(11) }]}>BIO</Text>
          </View>
          <TextInput
            style={[styles.inputMulti, { color: theme.text, borderColor: theme.border, fontSize: t(14) }]}
            value={bio}
            onChangeText={(v) => { setBio(v); detecterModification('bio', v); }}
            placeholder="Présente-toi en quelques mots..."
            placeholderTextColor={theme.text3}
            multiline
            maxLength={300}
          />
          <Text style={{ color: theme.text3, fontSize: t(11), marginTop: 4, textAlign: 'right' }}>
            {bio.length}/300
          </Text>
        </View>

        {/* Arrondissement */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.cardTitreRow}>
            <Ionicons name="location-outline" size={14} color={theme.text3} />
            <Text style={[styles.cardTitre, { color: theme.text3, fontSize: t(11) }]}>QUARTIER</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {ARRONDISSEMENTS.map((arr) => (
                <TouchableOpacity
                  key={arr}
                  style={[styles.chip, {
                    backgroundColor: arrondissement === arr ? '#111' : theme.bg,
                    borderColor: arrondissement === arr ? '#111' : theme.border,
                  }]}
                  onPress={() => { setArrondissement(arr); detecterModification('arrondissement', arr); }}
                >
                  <Text style={{
                    color: arrondissement === arr ? '#fff' : theme.text3,
                    fontSize: t(12),
                    fontWeight: arrondissement === arr ? '500' : '400',
                  }}>
                    {arr}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Centres d'intérêt */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.cardTitreRow}>
            <Ionicons name="heart-outline" size={14} color={theme.text3} />
            <Text style={[styles.cardTitre, { color: theme.text3, fontSize: t(11) }]}>CENTRES D'INTÉRÊT</Text>
          </View>
          <View style={styles.categoriesGrid}>
            {CATEGORIES_DISPONIBLES.map((cat) => {
              const c = CATEGORIES_COULEURS[cat] || { claire: '#F5F5F5', forte: '#888', texte: '#444' };
              const actif = centresInteret.includes(cat);
              return (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catChip, {
                    backgroundColor: actif ? c.forte : c.claire,
                    borderColor: actif ? c.forte : 'transparent',
                  }]}
                  onPress={() => toggleCentreInteret(cat)}
                >
                  <Text style={{
                    color: actif ? '#fff' : c.texte,
                    fontSize: t(12),
                    fontWeight: actif ? '500' : '400',
                  }}>
                    {cat}
                  </Text>
                  {actif && <Ionicons name="checkmark" size={12} color="#fff" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Bouton sauvegarder */}
        {modifie && (
          <TouchableOpacity
            style={[styles.btnSauvegarder, { backgroundColor: '#111', opacity: sauvegarde ? 0.7 : 1 }]}
            onPress={sauvegarder}
            disabled={sauvegarde}
          >
            {sauvegarde ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                <Text style={{ color: '#fff', fontSize: t(15), fontWeight: '500' }}>Sauvegarder</Text>
              </>
            )}
          </TouchableOpacity>
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
  scroll: { padding: 16, paddingBottom: 40 },
  avatarSection: { alignItems: 'center', gap: 8, marginBottom: 16 },
  avatar: { width: 90, height: 90, borderRadius: 45 },
  avatarDefaut: { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center' },
  avatarEdit: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  avatarNom: { fontWeight: '500', marginTop: 4 },
  badgesRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  card: { borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 0.5 },
  cardTitreRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  cardTitre: { fontWeight: '700', letterSpacing: 0.04, flex: 1 },
  verouilleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2 },
  scoreBar: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  scoreRempli: { height: '100%', borderRadius: 4 },
  compteurBadge: { width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, flexDirection: 'row', gap: 1 },
  alerteLimite: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 10, marginTop: 10 },
  input: { borderRadius: 10, padding: 12, borderWidth: 0.5, fontSize: 14 },
  inputMulti: { borderRadius: 10, padding: 12, borderWidth: 0.5, minHeight: 80, textAlignVertical: 'top' },
  chip: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1 },
  categoriesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1 },
  btnSauvegarder: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, padding: 15, marginBottom: 12 },
});