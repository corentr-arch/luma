import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal, FlatList,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useRef, useCallback } from 'react';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useEvenements } from '../EvenementsContext';
import { useApp } from '../AppContext';

const CATEGORIES = [
  { nom: 'Sport',              icon: 'football-outline' },
  { nom: 'Musique',            icon: 'musical-notes-outline' },
  { nom: 'Apéro',              icon: 'wine-outline' },
  { nom: 'Entraide',           icon: 'heart-outline' },
  { nom: 'Art',                icon: 'color-palette-outline' },
  { nom: 'Marché',             icon: 'storefront-outline' },
  { nom: 'Nature & Bien-être', icon: 'leaf-outline' },
  { nom: 'Famille',            icon: 'people-outline' },
  { nom: 'Cours',              icon: 'school-outline' },
];

const DUREES_OPTIONS = [
  { label: '30 min',       minutes: 30 },
  { label: '1 heure',      minutes: 60 },
  { label: '1h30',         minutes: 90 },
  { label: '2 heures',     minutes: 120 },
  { label: '3 heures',     minutes: 180 },
  { label: '4 heures',     minutes: 240 },
  { label: 'Demi-journée', minutes: 480 },
  { label: 'Journée',      minutes: 1440 },
];

const PARIS = { latitude: 48.8566, longitude: 2.3522 };

export default function AjoutEvenementScreen({ navigation }) {
  const { ajouterEvenement } = useEvenements();
  const { theme, facteurTexte, CATEGORIES_COULEURS } = useApp();

  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [categorie, setCategorie] = useState('');
  const [type, setType] = useState('temporaire');

  const [lieu, setLieu] = useState('');
  const [latitude, setLatitude] = useState(PARIS.latitude);
  const [longitude, setLongitude] = useState(PARIS.longitude);
  const [lieuValide, setLieuValide] = useState(false);
  const [rechercheAdresse, setRechercheAdresse] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [afficherSuggestions, setAfficherSuggestions] = useState(false);
  const [geocodageEnCours, setGeocodageEnCours] = useState(false);
  const [localisationEnCours, setLocalisationEnCours] = useState(false);
  const [modalCarte, setModalCarte] = useState(false);

  const [dateEvenement, setDateEvenement] = useState(new Date());
  const [dateFin, setDateFin] = useState(null);
  const [dureeMinutes, setDureeMinutes] = useState(60);
  const [modeDuree, setModeDuree] = useState('duree');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showFinPicker, setShowFinPicker] = useState(false);
  const [showFinTimePicker, setShowFinTimePicker] = useState(false);

  const [maxParticipants, setMaxParticipants] = useState('');
  const [sansMax, setSansMax] = useState(false);
  const [validationRequise, setValidationRequise] = useState(false);
  const [visibilite, setVisibilite] = useState('public');

  const [chargement, setChargement] = useState(false);
  const [etape, setEtape] = useState(1);
  const [modalCategorie, setModalCategorie] = useState(false);
  const [modalDuree, setModalDuree] = useState(false);

  const mapModalRef = useRef(null);
  const searchDebounce = useRef(null);
  const t = (size) => size * facteurTexte;

  // ── Autocomplétion adresse via API Adresse gouv.fr ──────────────────────────
  const rechercherAdresses = useCallback(async (texte) => {
    if (!texte || texte.length < 3) {
      setSuggestions([]);
      setAfficherSuggestions(false);
      return;
    }

    setGeocodageEnCours(true);
    try {
      const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(texte)}&limit=6&autocomplete=1`;
      const res = await fetch(url);
      const json = await res.json();

      const resultats = (json.features || []).map(f => ({
        label: f.properties.label,
        adresse: f.properties.name,
        ville: f.properties.city || f.properties.municipality,
        codePostal: f.properties.postcode,
        latitude: f.geometry.coordinates[1],
        longitude: f.geometry.coordinates[0],
        score: f.properties.score,
      }));

      setSuggestions(resultats);
      setAfficherSuggestions(resultats.length > 0);
    } catch {}
    setGeocodageEnCours(false);
  }, []);

  const handleChangerAdresse = (texte) => {
    setRechercheAdresse(texte);
    setLieu(texte);
    if (texte.length === 0) {
      setLieuValide(false);
      setSuggestions([]);
      setAfficherSuggestions(false);
      return;
    }

    // Debounce 300ms
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => rechercherAdresses(texte), 300);
  };

  const selectionnerSuggestion = (suggestion) => {
    setLieu(suggestion.label);
    setRechercheAdresse(suggestion.label);
    setLatitude(suggestion.latitude);
    setLongitude(suggestion.longitude);
    setLieuValide(true);
    setSuggestions([]);
    setAfficherSuggestions(false);

    // Centre la carte sur la suggestion
    if (mapModalRef.current) {
      mapModalRef.current.animateToRegion({
        latitude: suggestion.latitude,
        longitude: suggestion.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 600);
    }
  };

  // ── Géolocalisation ─────────────────────────────────────────────────────────
  const localiserUser = async () => {
    setLocalisationEnCours(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Active la localisation dans les réglages.');
        setLocalisationEnCours(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      setLatitude(lat);
      setLongitude(lng);

      // Géocodage inversé via API Adresse
      const res = await fetch(`https://api-adresse.data.gouv.fr/reverse/?lon=${lng}&lat=${lat}`);
      const json = await res.json();
      const premier = json.features?.[0];
      if (premier) {
        const adresse = premier.properties.label;
        setLieu(adresse);
        setRechercheAdresse(adresse);
        setLieuValide(true);
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de récupérer ta position.');
    }
    setLocalisationEnCours(false);
  };

  // ── Géocodage inversé quand on pose un point sur la carte ───────────────────
  const geocoderCoordonnees = async (lat, lng) => {
    setGeocodageEnCours(true);
    try {
      const res = await fetch(`https://api-adresse.data.gouv.fr/reverse/?lon=${lng}&lat=${lat}`);
      const json = await res.json();
      const premier = json.features?.[0];
      if (premier) {
        const adresse = premier.properties.label;
        setLieu(adresse);
        setRechercheAdresse(adresse);
        setLieuValide(true);
      }
    } catch {}
    setGeocodageEnCours(false);
  };

  const calculerDateFin = () => {
    if (type === 'fixe') return null;
    if (modeDuree === 'fin_precise') return dateFin;
    if (dureeMinutes) {
      const fin = new Date(dateEvenement);
      fin.setMinutes(fin.getMinutes() + dureeMinutes);
      return fin;
    }
    return null;
  };

  const validerEtape1 = () => {
    if (!titre.trim()) { Alert.alert('Titre requis', 'Donne un nom à ton événement.'); return; }
    if (!categorie) { Alert.alert('Catégorie requise', 'Choisis une catégorie.'); return; }
    setEtape(2);
  };

  const soumettre = async () => {
    if (!titre.trim()) { Alert.alert('Titre requis'); return; }
    if (!categorie) { Alert.alert('Catégorie requise'); return; }
    if (!lieuValide || !lieu.trim()) {
      Alert.alert('Lieu requis', 'Sélectionne une adresse dans les suggestions ou utilise ta position.');
      return;
    }
    if (type === 'temporaire' && modeDuree === 'fin_precise' && !dateFin) {
      Alert.alert('Heure de fin requise');
      return;
    }

    const dateFinCalculee = calculerDateFin();
    setChargement(true);

    const result = await ajouterEvenement({
      titre: titre.trim(),
      description: description.trim(),
      categorie,
      type,
      lieu: lieu.trim(),
      latitude,
      longitude,
      dateEvenement: type === 'fixe' ? null : dateEvenement.toISOString(),
      dateFin: dateFinCalculee ? dateFinCalculee.toISOString() : null,
      dureeMinutes: modeDuree === 'duree' ? dureeMinutes : null,
      duree: modeDuree === 'duree'
        ? (DUREES_OPTIONS.find(d => d.minutes === dureeMinutes)?.label || '')
        : dateFin ? `Jusqu'à ${dateFin.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : '',
      max: sansMax ? null : parseInt(maxParticipants) || null,
      sansMax,
      validationRequise,
      visibilite,
    });

    setChargement(false);

    if (result.succes) {
      Alert.alert('Événement créé !', 'Il est maintenant visible sur la carte.', [
        { text: 'Super !', onPress: () => navigation.goBack() },
      ]);
    } else if (result.erreur === 'limite_atteinte') {
      Alert.alert('🚫 Limite atteinte', result.message, [{ text: 'Compris' }]);
    } else {
      Alert.alert('Erreur', 'Impossible de créer l\'événement. Vérifie ta connexion.');
    }
  };

  const cat = categorie ? (CATEGORIES_COULEURS[categorie] || { claire: '#F5F5F5', forte: '#888' }) : null;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => etape > 1 ? setEtape(1) : navigation.goBack()} style={{ width: 32 }}>
          <Ionicons name="chevron-back" size={22} color="#2563EB" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitre, { color: theme.text, fontSize: t(17) }]}>
            Créer un événement
          </Text>
          <Text style={{ color: theme.text3, fontSize: t(12) }}>Étape {etape} / 2</Text>
        </View>
        <View style={styles.etapesRow}>
          {[1, 2].map(i => (
            <View key={i} style={[styles.etapeDot, {
              backgroundColor: i <= etape ? '#111' : theme.border,
              width: i === etape ? 20 : 8,
            }]} />
          ))}
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* ── ÉTAPE 1 ── */}
          {etape === 1 && (
            <View style={{ gap: 12 }}>
              <Text style={[styles.etapeTitre, { color: theme.text, fontSize: t(20) }]}>L'essentiel</Text>

              <View style={[styles.avertissement, { backgroundColor: '#DBEAFE', borderColor: '#BFDBFE' }]}>
                <Ionicons name="shield-checkmark-outline" size={16} color="#2563EB" />
                <Text style={[styles.avertissementTexte, { color: '#1E40AF', fontSize: t(12) }]}>
                  Tous les événements Luma se déroulent en lieu public. Ne communique jamais ton adresse personnelle.
                </Text>
              </View>

              <View style={[styles.avertissement, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                <Ionicons name="information-circle-outline" size={16} color="#F59E0B" />
                <Text style={[styles.avertissementTexte, { color: '#92400E', fontSize: t(12) }]}>
                  Tu peux avoir jusqu'à 3 événements actifs simultanément. Les comptes organisateurs ont une limite étendue.
                </Text>
              </View>

              {/* Type */}
              <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[styles.champLabel, { color: theme.text3, fontSize: t(11) }]}>TYPE</Text>
                <View style={styles.typeRow}>
                  {[
                    { key: 'temporaire', label: 'Temporaire', icon: 'timer-outline', desc: 'Événement avec date' },
                    { key: 'fixe', label: 'Lieu fixe', icon: 'location-outline', desc: 'Toujours visible' },
                  ].map(tp => (
                    <TouchableOpacity
                      key={tp.key}
                      style={[styles.typeBtn, {
                        backgroundColor: type === tp.key ? '#111' : theme.bg,
                        borderColor: type === tp.key ? '#111' : theme.border,
                      }]}
                      onPress={() => setType(tp.key)}
                    >
                      <Ionicons name={tp.icon} size={18} color={type === tp.key ? '#fff' : theme.text3} />
                      <Text style={{ color: type === tp.key ? '#fff' : theme.text, fontSize: t(13), fontWeight: '500' }}>
                        {tp.label}
                      </Text>
                      <Text style={{ color: type === tp.key ? 'rgba(255,255,255,0.6)' : theme.text3, fontSize: t(11) }}>
                        {tp.desc}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Titre */}
              <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[styles.champLabel, { color: theme.text3, fontSize: t(11) }]}>TITRE *</Text>
                <TextInput
                  style={[styles.input, { color: theme.text, fontSize: t(15), borderColor: theme.border }]}
                  placeholder="Ex : Yoga dans le parc"
                  placeholderTextColor={theme.text3}
                  value={titre}
                  onChangeText={setTitre}
                  maxLength={80}
                />
                <Text style={{ color: theme.text3, fontSize: t(11), marginTop: 4, textAlign: 'right' }}>
                  {titre.length}/80
                </Text>
              </View>

              {/* Catégorie */}
              <TouchableOpacity
                style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => setModalCategorie(true)}
              >
                <Text style={[styles.champLabel, { color: theme.text3, fontSize: t(11) }]}>CATÉGORIE *</Text>
                {categorie ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
                    <View style={[styles.catIcone, { backgroundColor: cat.claire }]}>
                      <Ionicons name={CATEGORIES.find(c => c.nom === categorie)?.icon || 'construct-outline'} size={18} color={cat.forte} />
                    </View>
                    <Text style={{ color: theme.text, fontSize: t(15), fontWeight: '500' }}>{categorie}</Text>
                    <Ionicons name="chevron-forward" size={14} color={theme.text3} style={{ marginLeft: 'auto' }} />
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                    <Text style={{ color: theme.text3, fontSize: t(14) }}>Choisir une catégorie</Text>
                    <Ionicons name="chevron-forward" size={14} color={theme.text3} />
                  </View>
                )}
              </TouchableOpacity>

              {/* Description */}
              <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[styles.champLabel, { color: theme.text3, fontSize: t(11) }]}>
                  DESCRIPTION <Text style={{ color: theme.text3, fontWeight: '400' }}>(optionnel)</Text>
                </Text>
                <TextInput
                  style={[styles.inputMulti, { color: theme.text, fontSize: t(14), borderColor: theme.border }]}
                  placeholder="Décris ton événement en quelques mots..."
                  placeholderTextColor={theme.text3}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  maxLength={300}
                />
                <Text style={{ color: theme.text3, fontSize: t(11), marginTop: 4, textAlign: 'right' }}>
                  {description.length}/300
                </Text>
              </View>

              {/* Date */}
              {type === 'temporaire' && (
                <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Text style={[styles.champLabel, { color: theme.text3, fontSize: t(11) }]}>DATE ET HEURE DE DÉBUT</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <TouchableOpacity
                      style={[styles.dateBtn, { backgroundColor: theme.bg, borderColor: theme.border, flex: 1 }]}
                      onPress={() => setShowDatePicker(true)}
                    >
                      <Ionicons name="calendar-outline" size={15} color="#2563EB" />
                      <Text style={{ color: theme.text, fontSize: t(13) }}>
                        {dateEvenement.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.dateBtn, { backgroundColor: theme.bg, borderColor: theme.border }]}
                      onPress={() => setShowTimePicker(true)}
                    >
                      <Ionicons name="time-outline" size={15} color="#2563EB" />
                      <Text style={{ color: theme.text, fontSize: t(13) }}>
                        {dateEvenement.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {showDatePicker && (
                    <DateTimePicker value={dateEvenement} mode="date" minimumDate={new Date()}
                      onChange={(e, d) => { setShowDatePicker(false); if (d) setDateEvenement(d); }} />
                  )}
                  {showTimePicker && (
                    <DateTimePicker value={dateEvenement} mode="time"
                      onChange={(e, d) => { setShowTimePicker(false); if (d) setDateEvenement(d); }} />
                  )}

                  <View style={[styles.sep, { backgroundColor: theme.border, marginVertical: 12 }]} />
                  <Text style={[styles.champLabel, { color: theme.text3, fontSize: t(11) }]}>DURÉE</Text>

                  <View style={[styles.modeRow, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                    {[
                      { key: 'duree', label: 'Durée', icon: 'hourglass-outline' },
                      { key: 'fin_precise', label: 'Heure de fin', icon: 'flag-outline' },
                    ].map(m => (
                      <TouchableOpacity
                        key={m.key}
                        style={[styles.modeBtn, modeDuree === m.key && { backgroundColor: '#111' }]}
                        onPress={() => setModeDuree(m.key)}
                      >
                        <Ionicons name={m.icon} size={13} color={modeDuree === m.key ? '#fff' : theme.text3} />
                        <Text style={{ color: modeDuree === m.key ? '#fff' : theme.text3, fontSize: t(12), fontWeight: modeDuree === m.key ? '500' : '400' }}>
                          {m.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {modeDuree === 'duree' ? (
                    <TouchableOpacity
                      style={[styles.dureeBtn, { backgroundColor: theme.bg, borderColor: theme.border }]}
                      onPress={() => setModalDuree(true)}
                    >
                      <Ionicons name="hourglass-outline" size={16} color="#2563EB" />
                      <Text style={{ color: theme.text, fontSize: t(14), flex: 1 }}>
                        {DUREES_OPTIONS.find(d => d.minutes === dureeMinutes)?.label || 'Choisir'}
                      </Text>
                      <Ionicons name="chevron-forward" size={14} color={theme.text3} />
                    </TouchableOpacity>
                  ) : (
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                      <TouchableOpacity style={[styles.dateBtn, { flex: 1, backgroundColor: theme.bg, borderColor: theme.border }]} onPress={() => setShowFinPicker(true)}>
                        <Ionicons name="calendar-outline" size={15} color="#EF4444" />
                        <Text style={{ color: theme.text, fontSize: t(13) }}>{dateFin ? dateFin.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'Date fin'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.dateBtn, { flex: 1, backgroundColor: theme.bg, borderColor: theme.border }]} onPress={() => setShowFinTimePicker(true)}>
                        <Ionicons name="flag-outline" size={15} color="#EF4444" />
                        <Text style={{ color: theme.text, fontSize: t(13) }}>{dateFin ? dateFin.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'Heure fin'}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {showFinPicker && (
                    <DateTimePicker value={dateFin || dateEvenement} mode="date" minimumDate={dateEvenement}
                      onChange={(e, d) => {
                        setShowFinPicker(false);
                        if (d) { const nd = dateFin ? new Date(dateFin) : new Date(dateEvenement); nd.setFullYear(d.getFullYear(), d.getMonth(), d.getDate()); setDateFin(nd); }
                      }} />
                  )}
                  {showFinTimePicker && (
                    <DateTimePicker value={dateFin || dateEvenement} mode="time"
                      onChange={(e, d) => {
                        setShowFinTimePicker(false);
                        if (d) { const nd = dateFin ? new Date(dateFin) : new Date(dateEvenement); nd.setHours(d.getHours(), d.getMinutes()); setDateFin(nd); }
                      }} />
                  )}

                  {modeDuree === 'duree' && dureeMinutes && (
                    <View style={[styles.finRecap, { backgroundColor: '#DCFCE7', marginTop: 10 }]}>
                      <Ionicons name="checkmark-circle-outline" size={13} color="#22C55E" />
                      <Text style={{ color: '#15803D', fontSize: t(12) }}>
                        {`Se termine à ${(() => { const fin = new Date(dateEvenement); fin.setMinutes(fin.getMinutes() + dureeMinutes); return fin.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); })()}`}
                      </Text>
                    </View>
                  )}
                  {modeDuree === 'fin_precise' && dateFin && (
                    <View style={[styles.finRecap, { backgroundColor: '#DCFCE7', marginTop: 10 }]}>
                      <Ionicons name="checkmark-circle-outline" size={13} color="#22C55E" />
                      <Text style={{ color: '#15803D', fontSize: t(12) }}>
                        {`Se termine le ${dateFin.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à ${dateFin.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <TouchableOpacity
                style={[styles.btnSuivant, { backgroundColor: '#111' }]}
                onPress={validerEtape1}
              >
                <Text style={{ color: '#fff', fontSize: t(15), fontWeight: '500' }}>Suivant — Le lieu</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          {/* ── ÉTAPE 2 ── */}
          {etape === 2 && (
            <View style={{ gap: 12 }}>
              <Text style={[styles.etapeTitre, { color: theme.text, fontSize: t(20) }]}>
                Le lieu & les options
              </Text>

              {/* Adresse avec autocomplétion */}
              <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[styles.champLabel, { color: theme.text3, fontSize: t(11) }]}>ADRESSE *</Text>
                <Text style={{ color: theme.text3, fontSize: t(12), marginBottom: 8 }}>
                  Tape une adresse — les suggestions apparaîtront automatiquement.
                </Text>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      style={[styles.input, {
                        color: theme.text,
                        fontSize: t(14),
                        borderColor: lieuValide ? '#22C55E' : theme.border,
                      }]}
                      placeholder="Ex : Parc Montsouris, Paris"
                      placeholderTextColor={theme.text3}
                      value={rechercheAdresse}
                      onChangeText={handleChangerAdresse}
                      returnKeyType="search"
                      autoCorrect={false}
                    />

                    {/* Suggestions dropdown */}
                    {afficherSuggestions && suggestions.length > 0 && (
                      <View style={[styles.suggestionsWrap, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        {suggestions.map((s, i) => (
                          <TouchableOpacity
                            key={i}
                            style={[styles.suggestionItem, {
                              borderBottomColor: theme.border,
                              borderBottomWidth: i < suggestions.length - 1 ? 0.5 : 0,
                            }]}
                            onPress={() => selectionnerSuggestion(s)}
                          >
                            <Ionicons name="location-outline" size={14} color="#2563EB" />
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: theme.text, fontSize: t(13), fontWeight: '500' }} numberOfLines={1}>
                                {s.adresse}
                              </Text>
                              <Text style={{ color: theme.text3, fontSize: t(11) }} numberOfLines={1}>
                                {s.ville}{s.codePostal ? ` · ${s.codePostal}` : ''}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>

                  <TouchableOpacity
                    style={[styles.locBtn, { backgroundColor: '#DBEAFE' }]}
                    onPress={localiserUser}
                    disabled={localisationEnCours}
                  >
                    {localisationEnCours
                      ? <ActivityIndicator size="small" color="#2563EB" />
                      : <Ionicons name="navigate" size={18} color="#2563EB" />
                    }
                  </TouchableOpacity>
                </View>

                {geocodageEnCours && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    <ActivityIndicator size="small" color="#2563EB" />
                    <Text style={{ color: theme.text3, fontSize: t(12) }}>Recherche en cours...</Text>
                  </View>
                )}

                {lieuValide ? (
                  <View style={[styles.finRecap, { backgroundColor: '#DCFCE7', marginTop: 8 }]}>
                    <Ionicons name="checkmark-circle" size={14} color="#22C55E" />
                    <Text style={{ color: '#15803D', fontSize: t(12), flex: 1 }} numberOfLines={1}>{lieu}</Text>
                  </View>
                ) : rechercheAdresse.length > 0 ? (
                  <View style={[styles.finRecap, { backgroundColor: '#FEF3C7', marginTop: 8 }]}>
                    <Ionicons name="information-circle-outline" size={14} color="#F59E0B" />
                    <Text style={{ color: '#92400E', fontSize: t(12) }}>
                      Sélectionne une adresse dans les suggestions
                    </Text>
                  </View>
                ) : null}

                {/* Aperçu carte */}
                <TouchableOpacity
                  style={styles.carteApercu}
                  onPress={() => setModalCarte(true)}
                  activeOpacity={0.85}
                >
                  <MapView
                    style={StyleSheet.absoluteFillObject}
                    region={{ latitude, longitude, latitudeDelta: 0.008, longitudeDelta: 0.008 }}
                    scrollEnabled={false}
                    zoomEnabled={false}
                    rotateEnabled={false}
                    pitchEnabled={false}
                    pointerEvents="none"
                    showsPointsOfInterest={false}
                  >
                    <Marker coordinate={{ latitude, longitude }} />
                  </MapView>
                  <View style={styles.carteAgrandir}>
                    <Ionicons name="expand-outline" size={16} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: t(12), fontWeight: '500' }}>Affiner sur la carte</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Participants */}
              <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[styles.champLabel, { color: theme.text3, fontSize: t(11) }]}>PARTICIPANTS</Text>
                <TouchableOpacity style={styles.toggleLigne} onPress={() => setSansMax(!sansMax)}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontSize: t(13), fontWeight: '500' }}>Illimité</Text>
                    <Text style={{ color: theme.text3, fontSize: t(11) }}>Pas de limite de participants</Text>
                  </View>
                  <View style={[styles.toggle, { backgroundColor: sansMax ? '#111' : '#E0E0E0' }]}>
                    <View style={[styles.toggleKnob, { transform: [{ translateX: sansMax ? 18 : 2 }] }]} />
                  </View>
                </TouchableOpacity>
                {!sansMax && (
                  <TextInput
                    style={[styles.input, { color: theme.text, fontSize: t(14), borderColor: theme.border, marginTop: 8 }]}
                    placeholder="Nombre maximum de participants"
                    placeholderTextColor={theme.text3}
                    value={maxParticipants}
                    onChangeText={setMaxParticipants}
                    keyboardType="numeric"
                  />
                )}
              </View>

              {/* Options */}
              <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[styles.champLabel, { color: theme.text3, fontSize: t(11) }]}>OPTIONS</Text>
                <TouchableOpacity style={styles.toggleLigne} onPress={() => setValidationRequise(!validationRequise)}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontSize: t(13), fontWeight: '500' }}>Validation requise</Text>
                    <Text style={{ color: theme.text3, fontSize: t(11) }}>Tu valides chaque participant manuellement</Text>
                  </View>
                  <View style={[styles.toggle, { backgroundColor: validationRequise ? '#2563EB' : '#E0E0E0' }]}>
                    <View style={[styles.toggleKnob, { transform: [{ translateX: validationRequise ? 18 : 2 }] }]} />
                  </View>
                </TouchableOpacity>
                <View style={[styles.toggleLigne, { borderTopWidth: 0.5, borderTopColor: theme.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontSize: t(13), fontWeight: '500' }}>Visibilité</Text>
                    <Text style={{ color: theme.text3, fontSize: t(11) }}>
                      {visibilite === 'public' ? 'Visible par tout le monde' : 'Visible uniquement par tes contacts'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.visibiliteBtn, { backgroundColor: '#DBEAFE' }]}
                    onPress={() => setVisibilite(v => v === 'public' ? 'amis' : 'public')}
                  >
                    <Ionicons name={visibilite === 'public' ? 'globe-outline' : 'people-outline'} size={14} color="#2563EB" />
                    <Text style={{ color: '#1E40AF', fontSize: t(12), fontWeight: '500' }}>
                      {visibilite === 'public' ? 'Public' : 'Amis'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Bouton créer */}
              <TouchableOpacity
                style={[styles.btnCreer, { backgroundColor: '#111', opacity: chargement ? 0.7 : 1 }]}
                onPress={soumettre}
                disabled={chargement}
              >
                {chargement ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="rocket-outline" size={20} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: t(15), fontWeight: '500' }}>Créer l'événement</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal carte plein écran */}
      <Modal visible={modalCarte} animationType="slide" onRequestClose={() => setModalCarte(false)}>
        <View style={styles.modalCarteContainer}>
          <View style={[styles.modalCarteHeader, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setModalCarte(false)} style={{ width: 32 }}>
              <Ionicons name="chevron-back" size={22} color="#2563EB" />
            </TouchableOpacity>
            <Text style={[styles.modalCarteTitre, { color: theme.text, fontSize: t(16) }]}>
              Placer le marqueur
            </Text>
            <TouchableOpacity
              style={[styles.modalCarteValider, { backgroundColor: lieuValide ? '#111' : '#888' }]}
              onPress={() => {
                if (!lieuValide) {
                  Alert.alert('Adresse requise', 'Sélectionne une adresse dans les suggestions ou tape une adresse.');
                  return;
                }
                setModalCarte(false);
              }}
            >
              <Text style={{ color: '#fff', fontSize: t(13), fontWeight: '500' }}>Valider</Text>
            </TouchableOpacity>
          </View>

          {/* Barre de recherche dans la carte */}
          <View style={[styles.modalCarteRecherche, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons name="search-outline" size={15} color={theme.text3} />
            <TextInput
              style={[styles.modalCarteInput, { color: theme.text, fontSize: t(14) }]}
              placeholder="Rechercher une adresse..."
              placeholderTextColor={theme.text3}
              value={rechercheAdresse}
              onChangeText={(v) => {
                setRechercheAdresse(v);
                if (v.length === 0) { setLieuValide(false); setSuggestions([]); setAfficherSuggestions(false); return; }
                if (searchDebounce.current) clearTimeout(searchDebounce.current);
                searchDebounce.current = setTimeout(() => rechercherAdresses(v), 300);
              }}
              returnKeyType="search"
              autoCorrect={false}
            />
            {geocodageEnCours
              ? <ActivityIndicator size="small" color="#2563EB" />
              : <TouchableOpacity onPress={() => rechercherAdresses(rechercheAdresse)}>
                  <Ionicons name="arrow-forward-circle" size={24} color="#2563EB" />
                </TouchableOpacity>
            }
          </View>

          {/* Suggestions dans la carte */}
          {afficherSuggestions && suggestions.length > 0 && (
            <View style={[styles.suggestionsWrapModal, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {suggestions.map((s, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.suggestionItem, {
                    borderBottomColor: theme.border,
                    borderBottomWidth: i < suggestions.length - 1 ? 0.5 : 0,
                  }]}
                  onPress={() => selectionnerSuggestion(s)}
                >
                  <Ionicons name="location-outline" size={14} color="#2563EB" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontSize: t(13), fontWeight: '500' }} numberOfLines={1}>
                      {s.adresse}
                    </Text>
                    <Text style={{ color: theme.text3, fontSize: t(11) }} numberOfLines={1}>
                      {s.ville}{s.codePostal ? ` · ${s.codePostal}` : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={[styles.modalCarteInstruction, { backgroundColor: 'rgba(37,99,235,0.9)' }]}>
            <Ionicons name="finger-print-outline" size={14} color="#fff" />
            <Text style={{ color: '#fff', fontSize: t(12) }}>
              Appuie sur la carte pour déplacer le marqueur
            </Text>
          </View>

          <MapView
            ref={mapModalRef}
            style={{ flex: 1 }}
            initialRegion={{ latitude, longitude, latitudeDelta: 0.008, longitudeDelta: 0.008 }}
            showsUserLocation
            showsPointsOfInterest={false}
            onPress={(e) => {
              const { latitude: lat, longitude: lng } = e.nativeEvent.coordinate;
              setLatitude(lat);
              setLongitude(lng);
              setSuggestions([]);
              setAfficherSuggestions(false);
              geocoderCoordonnees(lat, lng);
            }}
          >
            <Marker coordinate={{ latitude, longitude }} />
          </MapView>

          {lieuValide && (
            <View style={[styles.modalCarteAdresse, { backgroundColor: theme.card }]}>
              <Ionicons name="location" size={16} color="#22C55E" />
              <Text style={{ color: theme.text, fontSize: t(13), flex: 1 }} numberOfLines={2}>{lieu}</Text>
              <View style={[styles.valideTag, { backgroundColor: '#DCFCE7' }]}>
                <Ionicons name="checkmark-circle" size={13} color="#22C55E" />
                <Text style={{ color: '#15803D', fontSize: t(11), fontWeight: '500' }}>Validé</Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.modalCarteLoc, { backgroundColor: 'rgba(255,255,255,0.95)' }]}
            onPress={localiserUser}
            disabled={localisationEnCours}
          >
            {localisationEnCours
              ? <ActivityIndicator size="small" color="#2563EB" />
              : <Ionicons name="navigate" size={22} color="#2563EB" />
            }
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Modal catégorie */}
      <Modal visible={modalCategorie} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalCategorie(false)}>
          <View style={[styles.modalSheet, { backgroundColor: theme.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitre, { color: theme.text, fontSize: t(17) }]}>Catégorie</Text>
              <TouchableOpacity onPress={() => setModalCategorie(false)}>
                <Ionicons name="close" size={22} color={theme.text3} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={CATEGORIES}
              keyExtractor={(item) => item.nom}
              numColumns={2}
              contentContainerStyle={{ padding: 12, gap: 8 }}
              columnWrapperStyle={{ gap: 8 }}
              renderItem={({ item }) => {
                const c = CATEGORIES_COULEURS[item.nom] || { claire: '#F5F5F5', forte: '#888', texte: '#444' };
                const actif = categorie === item.nom;
                return (
                  <TouchableOpacity
                    style={[styles.catChoix, { backgroundColor: actif ? c.forte : c.claire, flex: 1 }]}
                    onPress={() => { setCategorie(item.nom); setModalCategorie(false); }}
                  >
                    <Ionicons name={item.icon} size={22} color={actif ? '#fff' : c.forte} />
                    <Text style={{ color: actif ? '#fff' : c.texte, fontSize: t(13), fontWeight: '500', textAlign: 'center' }}>
                      {item.nom}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal durée */}
      <Modal visible={modalDuree} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalDuree(false)}>
          <View style={[styles.modalSheet, { backgroundColor: theme.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitre, { color: theme.text, fontSize: t(17) }]}>Durée</Text>
              <TouchableOpacity onPress={() => setModalDuree(false)}>
                <Ionicons name="close" size={22} color={theme.text3} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={DUREES_OPTIONS}
              keyExtractor={(item) => String(item.minutes)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalOption, {
                    borderBottomColor: theme.border,
                    backgroundColor: dureeMinutes === item.minutes ? '#DBEAFE' : 'transparent',
                  }]}
                  onPress={() => { setDureeMinutes(item.minutes); setModalDuree(false); }}
                >
                  <Text style={{
                    color: dureeMinutes === item.minutes ? '#1E40AF' : theme.text,
                    fontSize: t(15),
                    fontWeight: dureeMinutes === item.minutes ? '500' : '400',
                  }}>
                    {item.label}
                  </Text>
                  {dureeMinutes === item.minutes && <Ionicons name="checkmark" size={18} color="#2563EB" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, paddingTop: 56, borderBottomWidth: 0.5 },
  headerTitre: { fontWeight: '500' },
  etapesRow: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  etapeDot: { height: 8, borderRadius: 4 },
  scroll: { padding: 16, paddingBottom: 40 },
  etapeTitre: { fontWeight: '500', marginBottom: 4 },
  avertissement: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderRadius: 12, padding: 12, borderWidth: 1 },
  avertissementTexte: { flex: 1, lineHeight: 18 },
  card: { borderRadius: 14, padding: 14, borderWidth: 0.5 },
  champLabel: { fontWeight: '700', letterSpacing: 0.04, marginBottom: 6 },
  input: { borderRadius: 10, padding: 12, borderWidth: 0.5, fontSize: 14 },
  inputMulti: { borderRadius: 10, padding: 12, borderWidth: 0.5, minHeight: 70, textAlignVertical: 'top' },
  suggestionsWrap: { borderRadius: 10, borderWidth: 0.5, marginTop: 4, overflow: 'hidden', zIndex: 100 },
  suggestionsWrapModal: { position: 'absolute', top: 130, left: 12, right: 12, zIndex: 100, borderRadius: 12, borderWidth: 0.5, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 8 },
  suggestionItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  typeRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  typeBtn: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center', gap: 6, borderWidth: 1.5 },
  catIcone: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, padding: 11, borderWidth: 0.5 },
  modeRow: { flexDirection: 'row', borderRadius: 10, padding: 3, borderWidth: 0.5, marginBottom: 8 },
  modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 8, paddingVertical: 8 },
  dureeBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 12, borderWidth: 0.5 },
  finRecap: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, padding: 10 },
  sep: { height: 0.5 },
  locBtn: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  carteApercu: { height: 140, borderRadius: 12, overflow: 'hidden', marginTop: 12, position: 'relative' },
  carteAgrandir: { position: 'absolute', bottom: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  toggleLigne: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  toggle: { width: 40, height: 24, borderRadius: 12, justifyContent: 'center' },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', position: 'absolute', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 2 },
  visibiliteBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  btnSuivant: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, padding: 15 },
  btnCreer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, padding: 16 },
  modalCarteContainer: { flex: 1 },
  modalCarteHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 56, borderBottomWidth: 0.5 },
  modalCarteTitre: { fontWeight: '500', flex: 1, textAlign: 'center' },
  modalCarteValider: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  modalCarteRecherche: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, borderRadius: 12, padding: 12, borderWidth: 0.5 },
  modalCarteInput: { flex: 1 },
  modalCarteInstruction: { position: 'absolute', top: 180, left: 0, right: 0, zIndex: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 7 },
  modalCarteAdresse: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderTopWidth: 0.5, borderTopColor: '#E0E0E0' },
  valideTag: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  modalCarteLoc: { position: 'absolute', bottom: 80, right: 16, width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '75%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 0.5 },
  modalTitre: { fontWeight: '500' },
  modalOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 0.5 },
  catChoix: { borderRadius: 14, padding: 14, alignItems: 'center', gap: 8, minHeight: 90, justifyContent: 'center' },
});