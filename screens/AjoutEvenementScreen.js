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
import { useApp } from '../AppContext';
import { useEvenements } from '../EvenementsContext';
import { supabase } from '../supabase';

const PARIS = { latitude: 48.8566, longitude: 2.3522 };
const CATEGORIES_LISTE = ['Sport', 'Musique', 'Apéro', 'Entraide', 'Art', 'Marché', 'Nature & Bien-être', 'Famille', 'Cours', 'Cinéma', 'Théâtre', 'Gaming'];

export default function AjoutEvenementScreen({ navigation }) {
  const { facteurTexte, profil, CATEGORIES_COULEURS, CAT_ICONES } = useApp();
  const { chargerEvenements } = useEvenements();
  const t = (s) => s * facteurTexte;

  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [lieu, setLieu] = useState('');
  const [categorie, setCategorie] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState('');
  const [sansMax, setSansMax] = useState(false);
  const [latitude, setLatitude] = useState(PARIS.latitude);
  const [longitude, setLongitude] = useState(PARIS.longitude);
  const [chargement, setChargement] = useState(false);
  const [rechercheAdresse, setRechercheAdresse] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [locChargement, setLocChargement] = useState(false);
  const mapRef = useRef(null);

  const formatDate = (d) => d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const formatHeure = (d) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const centrerSurMoi = async () => {
    setLocChargement(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission refusée'); setLocChargement(false); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = loc.coords.latitude;
      const lon = loc.coords.longitude;
      setLatitude(lat);
      setLongitude(lon);
      mapRef.current?.animateToRegion({ latitude: lat, longitude: lon, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 600);
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
      const r = await fetch(url, { headers: { 'User-Agent': 'LumaApp/1.0' } });
      const data = await r.json();
      if (data?.address) {
        const rue = data.address.road || '';
        const num = data.address.house_number || '';
        setLieu([num, rue].filter(Boolean).join(' ') || data.address.neighbourhood || 'Paris');
        setRechercheAdresse([num, rue].filter(Boolean).join(' ') || '');
      }
    } catch {}
    setLocChargement(false);
  };

  const rechercherLieu = useCallback(async (texte) => {
    setRechercheAdresse(texte);
    setLieu(texte);
    if (texte.length < 2) { setSuggestions([]); return; }
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(texte + ' Paris')}&format=json&limit=5`;
      const r = await fetch(url, { headers: { 'User-Agent': 'LumaApp/1.0' } });
      const data = await r.json();
      setSuggestions(data || []);
    } catch { setSuggestions([]); }
  }, []);

  const choisirSuggestion = (s) => {
    const nomCourt = s.display_name.split(',').slice(0, 2).join(', ');
    setLieu(nomCourt);
    setRechercheAdresse(nomCourt);
    setLatitude(parseFloat(s.lat));
    setLongitude(parseFloat(s.lon));
    setSuggestions([]);
    mapRef.current?.animateToRegion({ latitude: parseFloat(s.lat), longitude: parseFloat(s.lon), latitudeDelta: 0.01, longitudeDelta: 0.01 }, 500);
  };

  const publier = async () => {
    if (!titre.trim()) { Alert.alert('Titre requis'); return; }
    if (!categorie) { Alert.alert('Catégorie requise'); return; }
    if (!lieu.trim()) { Alert.alert('Lieu requis'); return; }
    if (!profil?.id) { Alert.alert('Connexion requise'); return; }
    if (profil.score_confiance < 10) { Alert.alert('Profil incomplet', 'Vérifie ton email pour créer des événements.'); return; }

    setChargement(true);
    try {
      const { error } = await supabase.from('evenements').insert({
        titre: titre.trim(), description: description.trim() || null,
        lieu: lieu.trim(), latitude, longitude, categorie,
        date_evenement: date.toISOString(),
        max_participants: sansMax ? null : parseInt(maxParticipants) || null,
        sans_max: sansMax, participants_count: 0,
        auteur_id: profil.id, suspendu: false,
      });
      if (error) { Alert.alert('Erreur', error.message); setChargement(false); return; }
      chargerEvenements();
      Alert.alert('Événement créé ! 🎉', 'Il est maintenant visible sur la carte.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) { Alert.alert('Erreur', String(e?.message || e)); }
    setChargement(false);
  };

  const cat = CATEGORIES_COULEURS[categorie] || { forte: '#2563EB', claire: '#DBEAFE' };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="close" size={22} color="#111" />
        </TouchableOpacity>
        <Text style={[styles.headerTitre, { fontSize: t(16) }]}>Créer un événement</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Titre */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { fontSize: t(11) }]}>TITRE</Text>
          <View style={styles.inputField}>
            <TextInput
              style={[styles.input, { fontSize: t(15) }]}
              placeholder="Nom de l'événement..."
              placeholderTextColor="#aaa"
              value={titre}
              onChangeText={setTitre}
              maxLength={80}
              returnKeyType="next"
            />
          </View>
          <Text style={{ color: '#ddd', fontSize: t(11), marginTop: 4, textAlign: 'right' }}>{titre.length}/80</Text>
        </View>

        {/* Catégorie */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { fontSize: t(11) }]}>CATÉGORIE</Text>
          <View style={styles.catsGrid}>
            {CATEGORIES_LISTE.map(c => {
              const cc = CATEGORIES_COULEURS[c] || { forte: '#888', claire: '#f5f5f5' };
              const actif = categorie === c;
              return (
                <TouchableOpacity
                  key={c}
                  style={[styles.catChip, { backgroundColor: actif ? cc.forte : '#f5f5f3' }]}
                  onPress={() => setCategorie(c)}
                  activeOpacity={0.8}
                >
                  <Ionicons name={CAT_ICONES[c] || 'apps-outline'} size={14} color={actif ? '#fff' : cc.forte} />
                  <Text style={{ color: actif ? '#fff' : '#666', fontSize: t(12), fontWeight: actif ? '600' : '400' }}>{c}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Date */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { fontSize: t(11) }]}>DATE & HEURE</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={[styles.dateBtn, { flex: 2 }]} onPress={() => setShowDatePicker(true)} activeOpacity={0.8}>
              <Ionicons name="calendar-outline" size={16} color="#111" />
              <Text style={[styles.dateBtnTxt, { fontSize: t(14) }]}>{formatDate(date)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.dateBtn, { flex: 1 }]} onPress={() => setShowTimePicker(true)} activeOpacity={0.8}>
              <Ionicons name="time-outline" size={16} color="#111" />
              <Text style={[styles.dateBtnTxt, { fontSize: t(14) }]}>{formatHeure(date)}</Text>
            </TouchableOpacity>
          </View>
          {showDatePicker && (
            <DateTimePicker value={date} mode="date" minimumDate={new Date()}
              onChange={(e, d) => { setShowDatePicker(false); if (d) setDate(prev => { const n = new Date(d); n.setHours(prev.getHours(), prev.getMinutes()); return n; }); }} />
          )}
          {showTimePicker && (
            <DateTimePicker value={date} mode="time"
              onChange={(e, d) => { setShowTimePicker(false); if (d) setDate(prev => { const n = new Date(prev); n.setHours(d.getHours(), d.getMinutes()); return n; }); }} />
          )}
        </View>

        {/* Lieu */}
        <View style={styles.inputGroup}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={[styles.label, { fontSize: t(11) }]}>LIEU</Text>
            <TouchableOpacity onPress={centrerSurMoi} style={styles.locBtn} disabled={locChargement} activeOpacity={0.8}>
              {locChargement
                ? <ActivityIndicator size="small" color="#2563EB" />
                : <><Ionicons name="navigate-outline" size={14} color="#2563EB" /><Text style={{ color: '#2563EB', fontSize: t(12), fontWeight: '500' }}>Ma position</Text></>
              }
            </TouchableOpacity>
          </View>
          <View style={styles.inputField}>
            <Ionicons name="location-outline" size={17} color="#aaa" />
            <TextInput
              style={[styles.input, { fontSize: t(14) }]}
              placeholder="Rue, quartier, lieu..."
              placeholderTextColor="#aaa"
              value={rechercheAdresse}
              onChangeText={rechercherLieu}
            />
          </View>
          {suggestions.length > 0 && (
            <View style={styles.suggestionsWrap}>
              {suggestions.map((s, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.suggestionItem, i < suggestions.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.05)' }]}
                  onPress={() => choisirSuggestion(s)}
                >
                  <Ionicons name="location-outline" size={13} color="#2563EB" />
                  <Text style={{ color: '#111', fontSize: t(13), flex: 1 }} numberOfLines={2}>
                    {s.display_name.split(',').slice(0, 3).join(', ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Mini carte */}
          <View style={styles.miniCarte}>
            <MapView
              ref={mapRef}
              style={StyleSheet.absoluteFill}
              initialRegion={{ latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
              showsPointsOfInterest={false}
              scrollEnabled
              zoomEnabled
              onPress={(e) => {
                const { latitude: lat, longitude: lon } = e.nativeEvent.coordinate;
                setLatitude(lat);
                setLongitude(lon);
              }}
            >
              <Marker coordinate={{ latitude, longitude }} tracksViewChanges={false}>
                <View style={[styles.markerPoi, { backgroundColor: cat.forte }]}>
                  <Ionicons name="location" size={14} color="#fff" />
                </View>
              </Marker>
            </MapView>
            <View style={styles.carteHint}>
              <Text style={{ color: '#fff', fontSize: t(11), fontWeight: '500' }}>Appuie pour ajuster</Text>
            </View>
          </View>
        </View>

        {/* Description */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { fontSize: t(11) }]}>DESCRIPTION <Text style={{ color: '#ddd', fontWeight: '400' }}>(optionnel)</Text></Text>
          <TextInput
            style={[styles.inputMulti, { fontSize: t(14) }]}
            placeholder="Décris l'événement..."
            placeholderTextColor="#aaa"
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={500}
          />
          <Text style={{ color: '#ddd', fontSize: t(11), marginTop: 4, textAlign: 'right' }}>{description.length}/500</Text>
        </View>

        {/* Participants */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { fontSize: t(11) }]}>PLACES DISPONIBLES</Text>
          <TouchableOpacity
            style={[styles.sansMaxRow, sansMax && { backgroundColor: '#DBEAFE' }]}
            onPress={() => setSansMax(v => !v)}
            activeOpacity={0.8}
          >
            <View style={[styles.sansMaxCheck, { backgroundColor: sansMax ? '#2563EB' : '#f0f0ee', borderColor: sansMax ? '#2563EB' : '#ddd' }]}>
              {sansMax && <Ionicons name="checkmark" size={13} color="#fff" />}
            </View>
            <Text style={[styles.sansMaxTxt, { fontSize: t(14), color: sansMax ? '#1D4ED8' : '#111' }]}>
              Illimité — ouvert à tous
            </Text>
          </TouchableOpacity>

          {!sansMax && (
            <View style={[styles.inputField, { marginTop: 10 }]}>
              <Ionicons name="people-outline" size={17} color="#aaa" />
              <TextInput
                style={[styles.input, { fontSize: t(15) }]}
                placeholder="Nombre de places max"
                placeholderTextColor="#aaa"
                value={maxParticipants}
                onChangeText={setMaxParticipants}
                keyboardType="number-pad"
                returnKeyType="done"
              />
            </View>
          )}
        </View>

        {/* Bouton publier */}
        <TouchableOpacity
          style={[styles.btnPublier, { opacity: chargement ? 0.7 : 1 }]}
          onPress={publier}
          disabled={chargement}
          activeOpacity={0.85}
        >
          {chargement
            ? <ActivityIndicator color="#fff" size="small" />
            : <><Ionicons name="checkmark-circle-outline" size={20} color="#fff" /><Text style={[styles.btnPublierTxt, { fontSize: t(15) }]}>Publier l'événement</Text></>
          }
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf8' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 54 : 16, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.06)', backgroundColor: '#fafaf8' },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f0f0ee', alignItems: 'center', justifyContent: 'center' },
  headerTitre: { fontWeight: '600', color: '#111' },
  scroll: { padding: 20 },
  inputGroup: { marginBottom: 20 },
  label: { fontWeight: '700', color: '#aaa', letterSpacing: 0.08, marginBottom: 8 },
  inputField: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 2, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.06)' },
  input: { flex: 1, color: '#111', paddingVertical: 13 },
  inputMulti: { backgroundColor: '#fff', borderRadius: 14, padding: 14, minHeight: 90, textAlignVertical: 'top', color: '#111', borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.06)' },
  catsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 14, padding: 13, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.06)' },
  dateBtnTxt: { color: '#111', fontWeight: '500', flex: 1 },
  locBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  suggestionsWrap: { backgroundColor: '#fff', borderRadius: 14, marginTop: 6, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.06)', overflow: 'hidden' },
  suggestionItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12 },
  miniCarte: { height: 160, borderRadius: 16, overflow: 'hidden', marginTop: 12, position: 'relative' },
  markerPoi: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  carteHint: { position: 'absolute', bottom: 8, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  sansMaxRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f5f5f3', borderRadius: 14, padding: 14 },
  sansMaxCheck: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  sansMaxTxt: { fontWeight: '500' },
  btnPublier: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#111', borderRadius: 16, padding: 16, marginTop: 8 },
  btnPublierTxt: { color: '#fff', fontWeight: '700' },
});