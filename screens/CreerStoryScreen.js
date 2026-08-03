import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Image, Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, Dimensions, PanResponder, Animated, ScrollView,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useRef, useEffect } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Location from 'expo-location';
import { supabase } from '../supabase';
import { useApp } from '../AppContext';

const { width: W, height: H } = Dimensions.get('window');

const TYPES = [
  { key: 'spot',      label: '⚡ Spot',      couleur: '#EF4444' },
  { key: 'lieu',      label: '📍 Lieu',      couleur: '#8B5CF6' },
  { key: 'evenement', label: '🎉 Événement', couleur: '#2563EB' },
];

const COULEURS_TEXTE = ['#FFFFFF', '#000000', '#FFD700', '#FF6B6B', '#4ECDC4', '#A855F7', '#2563EB'];

export default function CreerStoryScreen({ navigation, route }) {
  const { facteurTexte } = useApp();
  const t = (s) => s * facteurTexte;

  const lieuPrechoisit = route.params?.lieu || null;
  const evenementPrechoisit = route.params?.evenement || null;

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const [showCamera, setShowCamera] = useState(false);
  const [facingCamera, setFacingCamera] = useState('back');

  const mediaRef = useRef(null);
  const [mediaAffiche, setMediaAffiche] = useState(null);
  const [texte, setTexte] = useState('');
  const [couleurTexte, setCouleurTexte] = useState('#FFFFFF');
  const [tailleTexte, setTailleTexte] = useState(28);
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
  const [textePlace, setTextePlace] = useState(false);

  // Position du texte draggable
  const textePosX = useRef(new Animated.Value(0)).current;
  const textePosY = useRef(new Animated.Value(0)).current;
  const offsetX = useRef(0);
  const offsetY = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => textePlace && !editTexte,
      onMoveShouldSetPanResponder: () => textePlace && !editTexte,
      onPanResponderGrant: () => {
        textePosX.setOffset(offsetX.current);
        textePosY.setOffset(offsetY.current);
        textePosX.setValue(0);
        textePosY.setValue(0);
      },
      onPanResponderMove: Animated.event(
        [null, { dx: textePosX, dy: textePosY }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, gesture) => {
        offsetX.current += gesture.dx;
        offsetY.current += gesture.dy;
        textePosX.flattenOffset();
        textePosY.flattenOffset();
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

  const ouvrirCamera = async () => {
    const perm = await requestPermission();
    if (!perm.granted) {
      Alert.alert('Permission requise', "Autorise l'accès à ta caméra dans les réglages");
      return;
    }
    setFacingCamera('back');
    setShowCamera(true);
  };

  const capturer = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
      });
      let uriFinal = photo.uri;
      if (facingCamera === 'front') {
        const resultat = await ImageManipulator.manipulateAsync(
          photo.uri,
          [{ flip: ImageManipulator.FlipType.Horizontal }],
          { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
        );
        uriFinal = resultat.uri;
      }
      setShowCamera(false);
      mediaRef.current = { uri: uriFinal, type: 'image' };
      setMediaAffiche({ uri: uriFinal, type: 'image' });
      setEtape('edit');
    } catch {
      Alert.alert('Erreur', 'Impossible de prendre la photo');
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
      mediaRef.current = result.assets[0];
      setMediaAffiche(result.assets[0]);
      setEtape('edit');
    }
  };

  const validerTexte = () => {
    if (texte.trim()) {
      // Centre le texte au milieu de l'écran
      offsetX.current = 0;
      offsetY.current = 0;
      textePosX.setValue(0);
      textePosY.setValue(0);
      setTextePlace(true);
    }
    setEditTexte(false);
  };

  const publier = async () => {
    const currentMedia = mediaRef.current;
    if (!currentMedia) { Alert.alert('Erreur', 'Aucun média sélectionné'); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { Alert.alert('Erreur', 'Session expirée'); return; }
    const userFrais = session.user;
    setChargement(true);
    try {
      let lat = 48.8566, lon = 2.3522;
      const adresseFinale = adresse.trim() || lieuPrechoisit?.adresse || adresseLocale || '';
      if (coordonnees) { lat = coordonnees.latitude; lon = coordonnees.longitude; }
      else if (adresseFinale) {
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
      formData.append('file', { uri: currentMedia.uri, name: `story.${ext}`, type: isVideo ? 'video/mp4' : 'image/jpeg' });

      const { error: uploadError } = await supabase.storage
        .from('stories').upload(nomFichier, formData, { contentType: isVideo ? 'video/mp4' : 'image/jpeg', upsert: true });
      if (uploadError) { Alert.alert('Erreur upload', uploadError.message); setChargement(false); return; }

      const { data: urlData } = supabase.storage.from('stories').getPublicUrl(nomFichier);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const { error: storyError } = await supabase.from('stories').insert({
        user_id: userFrais.id, type,
        media_url: urlData.publicUrl,
        media_type: isVideo ? 'video' : 'image',
        texte: texte.trim() || null,
        latitude: lat, longitude: lon,
        adresse: adresseFinale || null,
        lieu_id: lieuPrechoisit?.id || null,
        evenement_id: evenementPrechoisit?.id || null,
        expires_at: expiresAt, actif: true, nb_vues: 0, nb_likes: 0,
      });

      if (storyError) { Alert.alert('Erreur', storyError.message); setChargement(false); return; }
      Alert.alert('Story publiée ! 🎉', 'Ta story est visible pendant 24h', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (e) { Alert.alert('Erreur', String(e?.message || e)); }
    setChargement(false);
  };

  // ── Caméra ────────────────────────────────────────────────────────────────
  if (showCamera) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFillObject}
          facing={facingCamera}
          mirror={false}
        />
        <TouchableOpacity style={styles.camBtn} onPress={() => setShowCamera(false)}>
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.camBtn, { left: undefined, right: 20 }]}
          onPress={() => setFacingCamera(f => f === 'back' ? 'front' : 'back')}
        >
          <Ionicons name="camera-reverse" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={styles.camIndicateur}>
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '500' }}>
            {facingCamera === 'front' ? '🤳 Selfie' : '📷 Arrière'}
          </Text>
        </View>
        <TouchableOpacity style={styles.camCapture} onPress={capturer}>
          <View style={styles.camCaptureInner} />
        </TouchableOpacity>
      </View>
    );
  }

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
          <View style={styles.section}>
            <Text style={styles.sectionTitre}>📍 OÙ ES-TU ?</Text>
            {lieuPrechoisit ? (
              <View style={[styles.adresseWrap, { borderColor: '#8B5CF6' }]}>
                <Ionicons name="location" size={18} color="#8B5CF6" />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#8B5CF6', fontSize: t(14), fontWeight: '600' }}>{lieuPrechoisit.nom}</Text>
                  {lieuPrechoisit.adresse && <Text style={{ color: '#9CA3AF', fontSize: t(11), marginTop: 2 }}>{lieuPrechoisit.adresse}</Text>}
                </View>
                <View style={styles.lieuBadge}><Text style={{ color: '#8B5CF6', fontSize: 10, fontWeight: '700' }}>AUTO</Text></View>
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

          <View style={styles.section}>
            <Text style={styles.sectionTitre}>TYPE DE STORY</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {TYPES.map(tp => (
                <TouchableOpacity
                  key={tp.key}
                  style={[styles.typePill, { backgroundColor: type === tp.key ? tp.couleur : '#1F2937', borderColor: type === tp.key ? tp.couleur : '#374151' }]}
                  onPress={() => setType(tp.key)}
                >
                  <Text style={{ color: '#fff', fontSize: t(12), fontWeight: type === tp.key ? '600' : '400' }}>{tp.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitre}>MÉDIA</Text>
            <TouchableOpacity style={styles.mediaBtn} onPress={ouvrirCamera}>
              <View style={styles.mediaBtnIcone}>
                <Ionicons name="camera" size={28} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mediaBtnLabel}>Photo / Vidéo</Text>
                <Text style={styles.mediaBtnDesc}>Prendre avec la caméra</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#6B7280" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.mediaBtn, { marginTop: 10, backgroundColor: '#1F2937' }]} onPress={choisirDepuisGalerie}>
              <View style={[styles.mediaBtnIcone, { backgroundColor: '#374151' }]}>
                <Ionicons name="images" size={28} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mediaBtnLabel}>Galerie</Text>
                <Text style={styles.mediaBtnDesc}>Choisir une photo ou vidéo</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Étape 2 — Édition style Instagram ─────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* Image de fond */}
      {mediaAffiche && (
        <Image source={{ uri: mediaAffiche.uri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
      )}

      {/* Zone tactile pour naviguer — ne capture pas les gestes sur le texte */}
      {!editTexte && !textePlace && (
        <View style={StyleSheet.absoluteFill} />
      )}

      {/* Texte déplaçable */}
      {textePlace && texte.trim().length > 0 && !editTexte && (
        <Animated.View
          style={[
            styles.texteFlottant,
            {
              transform: [{ translateX: textePosX }, { translateY: textePosY }],
              top: H / 2 - 40,
              left: 0,
              right: 0,
            }
          ]}
          {...panResponder.panHandlers}
        >
          <Text style={[styles.texteFlottantTexte, { color: couleurTexte, fontSize: tailleTexte }]}>
            {texte}
          </Text>
        </Animated.View>
      )}

      {/* Header — boutons haut */}
      <View style={styles.headerEdition}>
        <TouchableOpacity onPress={() => setEtape('media')} style={styles.editIconBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          {/* Bouton texte */}
          <TouchableOpacity
            style={[styles.editIconBtn, editTexte && { backgroundColor: '#fff' }]}
            onPress={() => {
              if (editTexte) {
                validerTexte();
              } else {
                setEditTexte(true);
              }
            }}
          >
            <Ionicons name="text" size={20} color={editTexte ? '#111' : '#fff'} />
          </TouchableOpacity>

          {/* Publier */}
          <TouchableOpacity
            style={[styles.publierBtn, { opacity: chargement ? 0.7 : 1 }]}
            onPress={publier}
            disabled={chargement}
          >
            {chargement
              ? <ActivityIndicator color="#fff" size="small" />
              : <><Text style={{ color: '#fff', fontSize: t(15), fontWeight: '700' }}>Publier</Text><Ionicons name="arrow-forward" size={16} color="#fff" /></>
            }
          </TouchableOpacity>
        </View>
      </View>

      {/* Éditeur de texte style Instagram */}
      {editTexte && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={StyleSheet.absoluteFill}
          pointerEvents="box-none"
        >
          {/* Overlay sombre */}
          <View style={styles.texteEditorOverlay} />

          {/* Champ texte centré */}
          <View style={styles.texteEditorWrap}>
            <TextInput
              style={[styles.texteEditorInput, { color: couleurTexte, fontSize: tailleTexte }]}
              placeholder="Ajouter du texte..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={texte}
              onChangeText={setTexte}
              maxLength={150}
              multiline
              autoFocus
              textAlign="center"
              selectionColor={couleurTexte}
            />
          </View>

          {/* Contrôles en bas */}
          <View style={styles.texteControles}>
            {/* Taille du texte */}
            <View style={styles.tailleBtns}>
              <TouchableOpacity
                style={styles.tailleBtn}
                onPress={() => setTailleTexte(s => Math.max(16, s - 4))}
              >
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>A</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.tailleBtn}
                onPress={() => setTailleTexte(s => Math.min(52, s + 4))}
              >
                <Text style={{ color: '#fff', fontSize: 26, fontWeight: '700' }}>A</Text>
              </TouchableOpacity>
            </View>

            {/* Couleurs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.couleursScroll}>
              {COULEURS_TEXTE.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.couleurBtn, { backgroundColor: c }, couleurTexte === c && styles.couleurBtnActif]}
                  onPress={() => setCouleurTexte(c)}
                />
              ))}
            </ScrollView>

            {/* Bouton OK */}
            <TouchableOpacity style={styles.texteOkBtn} onPress={validerTexte}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>OK</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Badge type */}
      <View style={[styles.typeBadge, { backgroundColor: TYPES.find(tp => tp.key === type)?.couleur }]}>
        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>{TYPES.find(tp => tp.key === type)?.label}</Text>
      </View>

      {/* Badge adresse */}
      {(adresse.trim().length > 0 || lieuPrechoisit || adresseLocale) && (
        <View style={styles.adresseBadge}>
          <Ionicons name="location" size={11} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 11 }} numberOfLines={1}>
            {lieuPrechoisit?.nom || adresse || adresseLocale}
          </Text>
        </View>
      )}

      {/* Hint déplacer */}
      {textePlace && !editTexte && (
        <View style={styles.dragHint}>
          <Text style={styles.dragHintTexte}>✋ Glisse le texte</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16 },
  headerTitre: { color: '#fff', fontSize: 18, fontWeight: '600' },
  section: { paddingHorizontal: 20, paddingBottom: 20 },
  sectionTitre: { color: '#9CA3AF', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10 },
  adresseWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1F2937', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#374151' },
  adresseInput: { flex: 1, color: '#fff', fontSize: 14, minHeight: 24 },
  lieuBadge: { backgroundColor: '#8B5CF620', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: '#8B5CF6' },
  suggestionsWrap: { backgroundColor: '#1F2937', borderRadius: 12, marginTop: 6, borderWidth: 1, borderColor: '#374151', overflow: 'hidden' },
  suggestionItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12 },
  adresseConfirmee: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingHorizontal: 4 },
  typePill: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
  mediaBtn: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#1a1a1a', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#333' },
  mediaBtnIcone: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  mediaBtnLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
  mediaBtnDesc: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  camBtn: { position: 'absolute', top: 60, left: 20, padding: 12, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 30, zIndex: 10 },
  camIndicateur: { position: 'absolute', top: 70, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, zIndex: 10 },
  camCapture: { position: 'absolute', bottom: 60, alignSelf: 'center', width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff', zIndex: 10 },
  camCaptureInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
  headerEdition: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, zIndex: 20 },
  editIconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)' },
  publierBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2563EB', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10 },
  texteFlottant: { position: 'absolute', zIndex: 15, alignItems: 'center', paddingHorizontal: 20 },
  texteFlottantTexte: { fontWeight: '700', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  texteEditorOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 30 },
  texteEditorWrap: { position: 'absolute', top: '30%', left: 20, right: 20, zIndex: 31, alignItems: 'center' },
  texteEditorInput: { fontWeight: '700', textAlign: 'center', minWidth: 100, maxWidth: W - 40, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  texteControles: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 32, paddingBottom: Platform.OS === 'ios' ? 34 : 16, paddingHorizontal: 16, gap: 16 },
  tailleBtns: { flexDirection: 'row', alignItems: 'center', gap: 16, justifyContent: 'center' },
  tailleBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  couleursScroll: { gap: 10, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  couleurBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' },
  couleurBtnActif: { borderWidth: 3, borderColor: '#fff', transform: [{ scale: 1.2 }] },
  texteOkBtn: { alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10, borderWidth: 1.5, borderColor: '#fff' },
  typeBadge: { position: 'absolute', top: 110, left: 16, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, zIndex: 15 },
  adresseBadge: { position: 'absolute', bottom: 40, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, zIndex: 15, justifyContent: 'center' },
  dragHint: { position: 'absolute', bottom: 80, left: 0, right: 0, alignItems: 'center', zIndex: 10 },
  dragHintTexte: { color: 'rgba(255,255,255,0.7)', fontSize: 13, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
});