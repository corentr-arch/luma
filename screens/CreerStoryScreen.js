import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Image, Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, Dimensions, PanResponder, Animated, ScrollView,
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
  { key: 'spot',      label: '⚡ Spot',       couleur: '#EF4444', bg: '#FEE2E2' },
  { key: 'lieu',      label: '📍 Lieu',       couleur: '#8B5CF6', bg: '#F3E8FF' },
  { key: 'evenement', label: '🎉 Événement',  couleur: '#2563EB', bg: '#DBEAFE' },
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
  const [type, setType] = useState(lieuPrechoisit ? 'lieu' : evenementPrechoisit ? 'evenement' : 'spot');
  const [adresse, setAdresse] = useState(lieuPrechoisit ? (lieuPrechoisit.adresse || lieuPrechoisit.nom || '') : '');
  const [coordonnees, setCoordonnees] = useState(
    lieuPrechoisit?.latitude ? { latitude: parseFloat(lieuPrechoisit.latitude), longitude: parseFloat(lieuPrechoisit.longitude) } : null
  );
  const [suggestions, setSuggestions] = useState([]);
  const [adresseLocale, setAdresseLocale] = useState('');
  const [locChargement, setLocChargement] = useState(true);
  const [chargement, setChargement] = useState(false);
  const [etape, setEtape] = useState('media');
  const [editTexte, setEditTexte] = useState(false);
  const [textePlace, setTextePlace] = useState(false);

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
      onPanResponderMove: Animated.event([null, { dx: textePosX, dy: textePosY }], { useNativeDriver: false }),
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
    if (!perm.granted) { Alert.alert('Permission requise', "Autorise l'accès à ta caméra dans les réglages"); return; }
    setFacingCamera('back');
    setShowCamera(true);
  };

  const capturer = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85, skipProcessing: false });
      let uriFinal = photo.uri;
      if (facingCamera === 'front') {
        const resultat = await ImageManipulator.manipulateAsync(photo.uri, [{ flip: ImageManipulator.FlipType.Horizontal }], { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG });
        uriFinal = resultat.uri;
      }
      setShowCamera(false);
      mediaRef.current = { uri: uriFinal, type: 'image' };
      setMediaAffiche({ uri: uriFinal, type: 'image' });
      setEtape('edit');
    } catch { Alert.alert('Erreur', 'Impossible de prendre la photo'); }
  };

  const choisirDepuisGalerie = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission requise'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'], allowsEditing: false, quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      mediaRef.current = result.assets[0];
      setMediaAffiche(result.assets[0]);
      setEtape('edit');
    }
  };

  const validerTexte = () => {
    if (texte.trim()) {
      offsetX.current = 0; offsetY.current = 0;
      textePosX.setValue(0); textePosY.setValue(0);
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
      const isVideo = currentMedia.type === 'video';
      const ext = isVideo ? 'mp4' : 'jpg';
      const nomFichier = `${userFrais.id}/${Date.now()}.${ext}`;
      const formData = new FormData();
      formData.append('file', { uri: currentMedia.uri, name: `story.${ext}`, type: isVideo ? 'video/mp4' : 'image/jpeg' });
      const { error: uploadError } = await supabase.storage.from('stories').upload(nomFichier, formData, { contentType: isVideo ? 'video/mp4' : 'image/jpeg', upsert: true });
      if (uploadError) { Alert.alert('Erreur upload', uploadError.message); setChargement(false); return; }
      const { data: urlData } = supabase.storage.from('stories').getPublicUrl(nomFichier);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { error: storyError } = await supabase.from('stories').insert({
        user_id: userFrais.id, type, media_url: urlData.publicUrl,
        media_type: isVideo ? 'video' : 'image', texte: texte.trim() || null,
        latitude: lat, longitude: lon, adresse: adresseFinale || null,
        lieu_id: lieuPrechoisit?.id || null, evenement_id: evenementPrechoisit?.id || null,
        expires_at: expiresAt, actif: true, nb_vues: 0, nb_likes: 0,
      });
      if (storyError) { Alert.alert('Erreur', storyError.message); setChargement(false); return; }
      Alert.alert('Story publiée ! 🎉', 'Ta story est visible pendant 24h', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) { Alert.alert('Erreur', String(e?.message || e)); }
    setChargement(false);
  };

  // ── Caméra ────────────────────────────────────────────────────────────────
  if (showCamera) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject} facing={facingCamera} mirror={false} />
        <TouchableOpacity style={styles.camClose} onPress={() => setShowCamera(false)}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.camFlip} onPress={() => setFacingCamera(f => f === 'back' ? 'front' : 'back')}>
          <Ionicons name="camera-reverse" size={24} color="#fff" />
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

  // ── Étape 1 — Choix média ─────────────────────────────────────────────────
  if (etape === 'media') {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitre}>Nouvelle story</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Adresse */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>📍 OÙ ES-TU ?</Text>
            {lieuPrechoisit ? (
              <View style={[styles.inputField, { borderColor: '#8B5CF6' }]}>
                <Ionicons name="location" size={17} color="#8B5CF6" />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#8B5CF6', fontSize: t(14), fontWeight: '600' }}>{lieuPrechoisit.nom}</Text>
                  {lieuPrechoisit.adresse && <Text style={{ color: 'rgba(139,92,246,0.6)', fontSize: t(11), marginTop: 2 }}>{lieuPrechoisit.adresse}</Text>}
                </View>
                <View style={styles.autoBadge}><Text style={{ color: '#8B5CF6', fontSize: 10, fontWeight: '700' }}>AUTO</Text></View>
              </View>
            ) : (
              <>
                <View style={styles.inputField}>
                  <Ionicons name="location-outline" size={17} color="#aaa" />
                  <TextInput
                    style={[styles.textInput, { fontSize: t(14) }]}
                    placeholder={locChargement ? 'Détection...' : 'Rue, quartier, lieu...'}
                    placeholderTextColor="#666"
                    value={adresse}
                    onChangeText={rechercherAdresse}
                    returnKeyType="search"
                  />
                  {locChargement && <ActivityIndicator size="small" color="#666" />}
                  {adresse.length > 0 && !locChargement && (
                    <TouchableOpacity onPress={() => { setAdresse(''); setSuggestions([]); setCoordonnees(null); }}>
                      <Ionicons name="close-circle" size={17} color="#666" />
                    </TouchableOpacity>
                  )}
                </View>
                {suggestions.length > 0 && (
                  <View style={styles.suggestionsWrap}>
                    {suggestions.map((s, i) => (
                      <TouchableOpacity
                        key={i}
                        style={[styles.suggestionItem, i < suggestions.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.1)' }]}
                        onPress={() => choisirSuggestion(s)}
                      >
                        <Ionicons name="location-outline" size={13} color="#2563EB" />
                        <Text style={{ color: '#fff', fontSize: t(13), flex: 1 }} numberOfLines={2}>
                          {s.display_name.split(',').slice(0, 3).join(', ')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {coordonnees && adresse.trim().length > 0 && suggestions.length === 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, paddingHorizontal: 4 }}>
                    <Ionicons name="checkmark-circle" size={13} color="#22C55E" />
                    <Text style={{ color: '#22C55E', fontSize: t(12) }}>Adresse géolocalisée</Text>
                  </View>
                )}
              </>
            )}
          </View>

          {/* Type */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>TYPE DE STORY</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {TYPES.map(tp => (
                <TouchableOpacity
                  key={tp.key}
                  style={[styles.typePill, { borderColor: tp.couleur, backgroundColor: type === tp.key ? tp.couleur : 'rgba(255,255,255,0.05)' }]}
                  onPress={() => setType(tp.key)}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: type === tp.key ? '#fff' : 'rgba(255,255,255,0.6)', fontSize: t(12), fontWeight: type === tp.key ? '600' : '400' }}>
                    {tp.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Média */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>MÉDIA</Text>
            <TouchableOpacity style={styles.mediaBtn} onPress={ouvrirCamera} activeOpacity={0.85}>
              <View style={[styles.mediaBtnIcone, { backgroundColor: '#2563EB' }]}>
                <Ionicons name="camera" size={26} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mediaBtnLabel}>Caméra</Text>
                <Text style={styles.mediaBtnDesc}>Prendre une photo ou vidéo</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.mediaBtn, { marginTop: 10, backgroundColor: 'rgba(255,255,255,0.05)' }]} onPress={choisirDepuisGalerie} activeOpacity={0.85}>
              <View style={[styles.mediaBtnIcone, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                <Ionicons name="images" size={26} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mediaBtnLabel}>Galerie</Text>
                <Text style={styles.mediaBtnDesc}>Choisir depuis mes photos</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Étape 2 — Édition style Instagram ─────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* Média */}
      {mediaAffiche && (
        <Image source={{ uri: mediaAffiche.uri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
      )}

      {/* Overlays dégradés */}
      <View style={styles.gradientHaut} pointerEvents="none" />
      <View style={styles.gradientBas} pointerEvents="none" />

      {/* Texte déplaçable */}
      {textePlace && texte.trim().length > 0 && !editTexte && (
        <Animated.View
          style={[styles.texteFlottant, { transform: [{ translateX: textePosX }, { translateY: textePosY }], top: H / 2 - 40 }]}
          {...panResponder.panHandlers}
        >
          <Text style={[styles.texteFlottantTxt, { color: couleurTexte, fontSize: tailleTexte }]}>{texte}</Text>
        </Animated.View>
      )}

      {/* Header édition */}
      <View style={styles.headerEdit}>
        <TouchableOpacity onPress={() => setEtape('media')} style={styles.editBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <TouchableOpacity
            style={[styles.editBtn, editTexte && { backgroundColor: '#fff' }]}
            onPress={() => editTexte ? validerTexte() : setEditTexte(true)}
          >
            <Ionicons name="text" size={19} color={editTexte ? '#111' : '#fff'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.publierBtn, { opacity: chargement ? 0.7 : 1 }]}
            onPress={publier}
            disabled={chargement}
            activeOpacity={0.85}
          >
            {chargement
              ? <ActivityIndicator color="#fff" size="small" />
              : <><Text style={{ color: '#fff', fontSize: t(15), fontWeight: '700' }}>Publier</Text><Ionicons name="arrow-forward" size={15} color="#fff" /></>
            }
          </TouchableOpacity>
        </View>
      </View>

      {/* Éditeur texte */}
      {editTexte && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <View style={styles.texteOverlay} />
          <View style={styles.texteEditorWrap}>
            <TextInput
              style={[styles.texteEditorInput, { color: couleurTexte, fontSize: tailleTexte }]}
              placeholder="Ajouter du texte..."
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={texte}
              onChangeText={setTexte}
              maxLength={150}
              multiline
              autoFocus
              textAlign="center"
              selectionColor={couleurTexte}
            />
          </View>
          <View style={styles.texteControles}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, justifyContent: 'center' }}>
              <TouchableOpacity style={styles.tailleBtnSmall} onPress={() => setTailleTexte(s => Math.max(16, s - 4))}>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>A</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.tailleBtnBig} onPress={() => setTailleTexte(s => Math.min(52, s + 4))}>
                <Text style={{ color: '#fff', fontSize: 24, fontWeight: '600' }}>A</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' }}>
              {COULEURS_TEXTE.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.couleurBtn, { backgroundColor: c }, couleurTexte === c && styles.couleurBtnActif]}
                  onPress={() => setCouleurTexte(c)}
                />
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.texteOkBtn} onPress={validerTexte} activeOpacity={0.85}>
              <Text style={{ color: '#fff', fontSize: t(15), fontWeight: '700' }}>OK</Text>
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

      {/* Hint drag */}
      {textePlace && !editTexte && (
        <View style={styles.dragHint}>
          <Text style={styles.dragHintTxt}>✋ Glisse le texte</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 56 : 20, paddingBottom: 16 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  headerTitre: { color: '#fff', fontSize: 17, fontWeight: '600' },
  section: { paddingHorizontal: 20, paddingBottom: 20 },
  sectionLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700', letterSpacing: 0.08, marginBottom: 10, textTransform: 'uppercase' },
  inputField: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 13, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)' },
  textInput: { flex: 1, color: '#fff', minHeight: 22 },
  autoBadge: { backgroundColor: 'rgba(139,92,246,0.15)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: '#8B5CF6' },
  suggestionsWrap: { backgroundColor: 'rgba(30,30,30,0.98)', borderRadius: 12, marginTop: 6, overflow: 'hidden' },
  suggestionItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12 },
  typePill: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 20, borderWidth: 1.5 },
  mediaBtn: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },
  mediaBtnIcone: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  mediaBtnLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
  mediaBtnDesc: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  camClose: { position: 'absolute', top: 60, left: 20, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 30, zIndex: 10 },
  camFlip: { position: 'absolute', top: 60, right: 20, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 30, zIndex: 10 },
  camIndicateur: { position: 'absolute', top: 68, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, zIndex: 10 },
  camCapture: { position: 'absolute', bottom: 60, alignSelf: 'center', width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff', zIndex: 10 },
  camCaptureInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
  gradientHaut: { position: 'absolute', top: 0, left: 0, right: 0, height: 200, zIndex: 5, backgroundColor: 'transparent' },
  gradientBas: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 180, zIndex: 5, backgroundColor: 'transparent' },
  headerEdit: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 52 : 20, paddingBottom: 12, zIndex: 20 },
  editBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)' },
  publierBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2563EB', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  texteFlottant: { position: 'absolute', zIndex: 15, alignItems: 'center', left: 0, right: 0, paddingHorizontal: 20 },
  texteFlottantTxt: { fontWeight: '700', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  texteOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 30 },
  texteEditorWrap: { position: 'absolute', top: '30%', left: 20, right: 20, zIndex: 31, alignItems: 'center' },
  texteEditorInput: { fontWeight: '700', textAlign: 'center', minWidth: 100, maxWidth: W - 40, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  texteControles: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 32, paddingBottom: Platform.OS === 'ios' ? 36 : 16, paddingHorizontal: 16, gap: 14 },
  tailleBtnSmall: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  tailleBtnBig: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  couleurBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  couleurBtnActif: { borderWidth: 3, borderColor: '#fff', transform: [{ scale: 1.2 }] },
  texteOkBtn: { alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 20, paddingHorizontal: 28, paddingVertical: 11, borderWidth: 1.5, borderColor: '#fff' },
  typeBadge: { position: 'absolute', top: 110, left: 16, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, zIndex: 15 },
  adresseBadge: { position: 'absolute', bottom: 40, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, zIndex: 15, justifyContent: 'center' },
  dragHint: { position: 'absolute', bottom: 80, left: 0, right: 0, alignItems: 'center', zIndex: 10 },
  dragHintTxt: { color: 'rgba(255,255,255,0.65)', fontSize: 13, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
});