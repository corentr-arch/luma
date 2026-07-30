import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Image, Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, Dimensions, PanResponder, Animated, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useRef, useEffect } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { supabase } from '../supabase';
import { useApp } from '../AppContext';

const { width: W, height: H } = Dimensions.get('window');

const TYPES = [
  { key: 'spot',      label: '⚡ Spot',      couleur: '#EF4444' },
  { key: 'lieu',      label: '📍 Lieu',      couleur: '#8B5CF6' },
  { key: 'evenement', label: '🎉 Événement', couleur: '#2563EB' },
];

export default function CreerStoryScreen({ navigation, route }) {
  const { facteurTexte } = useApp();
  const t = (s) => s * facteurTexte;

  const lieuPrechoisit = route.params?.lieu || null;
  const evenementPrechoisit = route.params?.evenement || null;

  const mediaRef = useRef(null);
  const [mediaAffiche, setMediaAffiche] = useState(null);
  const [texte, setTexte] = useState('');
  const [type, setType] = useState(
    lieuPrechoisit ? 'lieu' : evenementPrechoisit ? 'evenement' : 'spot'
  );
  const [adresse, setAdresse] = useState(
    lieuPrechoisit ? (lieuPrechoisit.adresse || lieuPrechoisit.nom || '') : ''
  );
  const [coordonnees, setCoordonnees] = useState(
    lieuPrechoisit?.latitude
      ? { latitude: parseFloat(lieuPrechoisit.latitude), longitude: parseFloat(lieuPrechoisit.longitude) }
      : null
  );
  const [suggestions, setSuggestions] = useState([]);
  const [adresseLocale, setAdresseLocale] = useState('');
  const [locChargement, setLocChargement] = useState(true);
  const [chargement, setChargement] = useState(false);
  const [etape, setEtape] = useState('media');
  const [editTexte, setEditTexte] = useState(false);

  const textePosX = useRef(new Animated.Value(W / 2 - 100)).current;
  const textePosY = useRef(new Animated.Value(H * 0.35)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: Animated.event(
        [null, { dx: textePosX, dy: textePosY }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        textePosX.extractOffset();
        textePosY.extractOffset();
      },
    })
  ).current;

  useEffect(() => {
    if (lieuPrechoisit) { setLocChargement(false); return; }
    (async () => {
      setLocChargement(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const lat = loc.coords.latitude;
          const lon = loc.coords.longitude;
          setCoordonnees({ latitude: lat, longitude: lon });
          const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
          const r = await fetch(url, { headers: { 'User-Agent': 'LumaApp/1.0' } });
          const data = await r.json();
          if (data?.address) {
            const rue = data.address.road || data.address.pedestrian || data.address.street || '';
            const num = data.address.house_number || '';
            const quartier = data.address.neighbourhood || data.address.suburb || '';
            const adresseTrouvee = [num, rue].filter(Boolean).join(' ') || quartier || 'Paris';
            setAdresseLocale(adresseTrouvee);
            setAdresse(adresseTrouvee);
          }
        }
      } catch {}
      setLocChargement(false);
    })();
  }, []);

  const rechercherAdresse = async (texteRecherche) => {
    setAdresse(texteRecherche);
    if (texteRecherche.length < 2) { setSuggestions([]); return; }
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(texteRecherche + ' Paris')}&format=json&limit=5&addressdetails=1`;
      const r = await fetch(url, { headers: { 'User-Agent': 'LumaApp/1.0' } });
      const data = await r.json();
      setSuggestions(data || []);
    } catch { setSuggestions([]); }
  };

  const choisirSuggestion = (s) => {
    const nomCourt = s.display_name.split(',').slice(0, 2).join(', ').trim();
    setAdresse(nomCourt);
    setCoordonnees({ latitude: parseFloat(s.lat), longitude: parseFloat(s.lon) });
    setSuggestions([]);
  };

  // ✅ PAS de flip — iOS gère déjà l'orientation correctement
  const prendreMedia = async (sourceCamera) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', "Autorise l'accès à ta caméra");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: false,
      quality: 0.85,
      // Pas de cameraType forcé — l'utilisateur choisit dans l'interface native iOS
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      mediaRef.current = asset;
      setMediaAffiche(asset);
      setEtape('edit');
    }
  };

  const choisirDepuisGalerie = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', "Autorise l'accès à ta galerie");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: false,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      mediaRef.current = asset;
      setMediaAffiche(asset);
      setEtape('edit');
    }
  };

  const publier = async () => {
    const currentMedia = mediaRef.current;
    if (!currentMedia) {
      Alert.alert('Erreur', 'Aucun média sélectionné');
      return;
    }
    const { data: { user: userFrais } } = await supabase.auth.getUser();
    if (!userFrais) {
      Alert.alert('Erreur', 'Session expirée, reconnecte-toi');
      return;
    }
    setChargement(true);
    try {
      let lat = 48.8566, lon = 2.3522;
      const adresseFinale = adresse.trim() || lieuPrechoisit?.adresse || adresseLocale || '';
      if (coordonnees) {
        lat = coordonnees.latitude;
        lon = coordonnees.longitude;
      } else if (adresseFinale) {
        try {
          const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(adresseFinale + ' Paris')}&format=json&limit=1`;
          const r = await fetch(url, { headers: { 'User-Agent': 'LumaApp/1.0' } });
          const data = await r.json();
          if (data?.[0]) { lat = parseFloat(data[0].lat); lon = parseFloat(data[0].lon); }
        } catch {}
      }

      const isVideo = currentMedia.type === 'video';
      const ext = isVideo ? 'mp4' : 'jpg';
      const nomFichier = `${userFrais.id}/${Date.now()}.${ext}`;
      const formData = new FormData();
      formData.append('file', {
        uri: currentMedia.uri,
        name: `story.${ext}`,
        type: isVideo ? 'video/mp4' : 'image/jpeg',
      });

      const { error: uploadError } = await supabase.storage
        .from('stories')
        .upload(nomFichier, formData, {
          contentType: isVideo ? 'video/mp4' : 'image/jpeg',
          upsert: true,
        });

      if (uploadError) { Alert.alert('Erreur upload', uploadError.message); setChargement(false); return; }

      const { data: urlData } = supabase.storage.from('stories').getPublicUrl(nomFichier);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const { error: storyError } = await supabase.from('stories').insert({
        user_id: userFrais.id,
        type,
        media_url: urlData.publicUrl,
        media_type: isVideo ? 'video' : 'image',
        texte: texte.trim() || null,
        latitude: lat,
        longitude: lon,
        adresse: adresseFinale || null,
        lieu_id: lieuPrechoisit?.id || null,
        evenement_id: evenementPrechoisit?.id || null,
        expires_at: expiresAt,
        actif: true,
        nb_vues: 0,
        nb_likes: 0,
      });

      if (storyError) { Alert.alert('Erreur', storyError.message); setChargement(false); return; }

      Alert.alert('Story publiée ! 🎉', 'Ta story est visible pendant 24h', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (e) {
      Alert.alert('Erreur', String(e?.message || e));
    }
    setChargement(false);
  };

  // ── Étape 1 ───────────────────────────────────────────────────────────────
  if (etape === 'media') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitre}>Nouvelle story</Text>
          <View style={{ width: 34 }} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

          {/* Adresse */}
          <View style={styles.section}>
            <Text style={styles.sectionTitre}>📍 OÙ ES-TU ?</Text>
            {lieuPrechoisit ? (
              <View style={[styles.adresseWrap, { borderColor: '#8B5CF6' }]}>
                <Ionicons name="location" size={18} color="#8B5CF6" />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#8B5CF6', fontSize: t(14), fontWeight: '600' }}>{lieuPrechoisit.nom}</Text>
                  {lieuPrechoisit.adresse && (
                    <Text style={{ color: '#9CA3AF', fontSize: t(11), marginTop: 2 }}>{lieuPrechoisit.adresse}</Text>
                  )}
                </View>
                <View style={styles.lieuBadge}>
                  <Text style={{ color: '#8B5CF6', fontSize: 10, fontWeight: '700' }}>AUTO</Text>
                </View>
              </View>
            ) : (
              <>
                <View style={styles.adresseWrap}>
                  <Ionicons name="location-outline" size={18} color="#9CA3AF" />
                  <TextInput
                    style={styles.adresseInput}
                    placeholder={locChargement ? 'Détection...' : 'Rue, quartier, lieu...'}
                    placeholderTextColor="#6B7280"
                    value={adresse}
                    onChangeText={rechercherAdresse}
                    returnKeyType="search"
                  />
                  {locChargement && <ActivityIndicator size="small" color="#6B7280" />}
                  {adresse.length > 0 && !locChargement && (
                    <TouchableOpacity onPress={() => { setAdresse(''); setSuggestions([]); setCoordonnees(null); }}>
                      <Ionicons name="close-circle" size={18} color="#6B7280" />
                    </TouchableOpacity>
                  )}
                </View>
                {suggestions.length > 0 && (
                  <View style={styles.suggestionsWrap}>
                    {suggestions.map((s, i) => (
                      <TouchableOpacity
                        key={i}
                        style={[styles.suggestionItem, i < suggestions.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: '#2D3748' }]}
                        onPress={() => choisirSuggestion(s)}
                      >
                        <Ionicons name="location-outline" size={14} color="#2563EB" />
                        <Text style={{ color: '#fff', fontSize: t(13), flex: 1 }} numberOfLines={2}>
                          {s.display_name.split(',').slice(0, 3).join(', ')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {coordonnees && adresse.trim().length > 0 && suggestions.length === 0 && (
                  <View style={styles.adresseConfirmee}>
                    <Ionicons name="checkmark-circle" size={14} color="#059669" />
                    <Text style={{ color: '#059669', fontSize: t(12) }}>Adresse géolocalisée ✓</Text>
                  </View>
                )}
              </>
            )}
          </View>

          {/* Type */}
          <View style={styles.section}>
            <Text style={styles.sectionTitre}>TYPE DE STORY</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {TYPES.map(tp => (
                <TouchableOpacity
                  key={tp.key}
                  style={[styles.typePill, {
                    backgroundColor: type === tp.key ? tp.couleur : '#1F2937',
                    borderColor: type === tp.key ? tp.couleur : '#374151',
                  }]}
                  onPress={() => setType(tp.key)}
                >
                  <Text style={{ color: '#fff', fontSize: t(12), fontWeight: type === tp.key ? '600' : '400' }}>
                    {tp.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ✅ Média simplifié — 2 boutons seulement */}
          <View style={styles.section}>
            <Text style={styles.sectionTitre}>MÉDIA</Text>

            <TouchableOpacity style={styles.mediaBtn} onPress={prendreMedia}>
              <View style={styles.mediaBtnIcone}>
                <Ionicons name="camera" size={28} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mediaBtnLabel}>Photo / Vidéo</Text>
                <Text style={styles.mediaBtnDesc}>Ouvre l'appareil photo</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#6B7280" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.mediaBtn, { marginTop: 10, backgroundColor: '#1F2937' }]}
              onPress={choisirDepuisGalerie}
            >
              <View style={[styles.mediaBtnIcone, { backgroundColor: '#374151' }]}>
                <Ionicons name="images" size={28} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mediaBtnLabel}>Galerie</Text>
                <Text style={styles.mediaBtnDesc}>Choisir une photo ou vidéo existante</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Étape 2 — Édition ─────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {mediaAffiche && (
        <Image
          source={{ uri: mediaAffiche.uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
        />
      )}

      {texte.length > 0 && !editTexte && (
        <Animated.View
          style={[styles.texteFlottant, { transform: [{ translateX: textePosX }, { translateY: textePosY }] }]}
          {...panResponder.panHandlers}
        >
          <Text style={styles.texteFlottantTexte}>{texte}</Text>
        </Animated.View>
      )}

      <View style={styles.headerEdition}>
        <TouchableOpacity onPress={() => setEtape('media')} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <TouchableOpacity
            style={[styles.editBtn, editTexte && { backgroundColor: '#fff' }]}
            onPress={() => setEditTexte(v => !v)}
          >
            <Ionicons name="text" size={18} color={editTexte ? '#111' : '#fff'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.publierBtn, { opacity: chargement ? 0.7 : 1 }]}
            onPress={publier}
            disabled={chargement}
          >
            {chargement
              ? <ActivityIndicator color="#fff" size="small" />
              : <>
                  <Text style={{ color: '#fff', fontSize: t(15), fontWeight: '700' }}>Publier</Text>
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
                </>
            }
          </TouchableOpacity>
        </View>
      </View>

      {editTexte && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.texteEditWrap}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
            <TextInput
              style={styles.texteEditInput}
              placeholder="Écris quelque chose..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={texte}
              onChangeText={setTexte}
              maxLength={150}
              multiline
              autoFocus
            />
            <TouchableOpacity style={styles.texteEditOk} onPress={() => setEditTexte(false)}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>OK</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 4 }}>{texte.length}/150</Text>
        </KeyboardAvoidingView>
      )}

      {texte.length > 0 && !editTexte && (
        <View style={styles.dragHint}>
          <Text style={styles.dragHintTexte}>✋ Glisse le texte</Text>
        </View>
      )}

      <View style={[styles.typeBadge, { backgroundColor: TYPES.find(tp => tp.key === type)?.couleur }]}>
        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>
          {TYPES.find(tp => tp.key === type)?.label}
        </Text>
      </View>

      {(adresse.trim().length > 0 || lieuPrechoisit || adresseLocale) && (
        <View style={styles.adresseBadge}>
          <Ionicons name="location" size={11} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 11 }} numberOfLines={1}>
            {lieuPrechoisit?.nom || adresse || adresseLocale}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16,
  },
  headerTitre: { color: '#fff', fontSize: 18, fontWeight: '600' },
  section: { paddingHorizontal: 20, paddingBottom: 20 },
  sectionTitre: { color: '#9CA3AF', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10 },
  adresseWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1F2937', borderRadius: 14,
    padding: 14, borderWidth: 1.5, borderColor: '#374151',
  },
  adresseInput: { flex: 1, color: '#fff', fontSize: 14, minHeight: 24 },
  lieuBadge: {
    backgroundColor: '#8B5CF620', borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: '#8B5CF6',
  },
  suggestionsWrap: {
    backgroundColor: '#1F2937', borderRadius: 12, marginTop: 6,
    borderWidth: 1, borderColor: '#374151', overflow: 'hidden',
  },
  suggestionItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12 },
  adresseConfirmee: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingHorizontal: 4 },
  typePill: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
  mediaBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#1a1a1a', borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: '#333',
  },
  mediaBtnIcone: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#2563EB',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  mediaBtnLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
  mediaBtnDesc: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  headerEdition: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, zIndex: 20,
  },
  editBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
  },
  publierBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#2563EB', borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 10,
  },
  texteFlottant: {
    position: 'absolute', zIndex: 15,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
    maxWidth: W - 40,
  },
  texteFlottantTexte: {
    color: '#fff', fontSize: 22, fontWeight: '700', textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  texteEditWrap: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
    backgroundColor: 'rgba(0,0,0,0.85)',
    padding: 16, paddingBottom: Platform.OS === 'ios' ? 40 : 16,
  },
  texteEditInput: {
    flex: 1, color: '#fff', fontSize: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.3)',
    paddingVertical: 8, minHeight: 44, maxHeight: 120,
  },
  texteEditOk: {
    backgroundColor: '#2563EB', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  dragHint: {
    position: 'absolute', bottom: 100, left: 0, right: 0,
    alignItems: 'center', zIndex: 10,
  },
  dragHintTexte: {
    color: 'rgba(255,255,255,0.7)', fontSize: 13,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  typeBadge: {
    position: 'absolute', top: 110, left: 16,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, zIndex: 15,
  },
  adresseBadge: {
    position: 'absolute', bottom: 40, left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6, zIndex: 15,
    justifyContent: 'center',
  },
});