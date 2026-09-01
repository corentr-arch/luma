import {
  StyleSheet, View, Text, TouchableOpacity,
  Animated, Share, ScrollView, Modal, TextInput,
} from 'react-native';
import MapView from 'react-native-map-clustering';
import { Marker, Circle } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useEvenements } from '../EvenementsContext';
import { useApp, CATEGORIES, formatDateParis } from '../AppContext';
import { supabase } from '../supabase';
import StoryViewer from '../components/StoryViewer';

const PARIS = { latitude: 48.8566, longitude: 2.3522 };

const RAYONS = [
  { label: '1 km',  valeur: 1000 },
  { label: '5 km',  valeur: 5000 },
  { label: '10 km', valeur: 10000 },
  { label: '20 km', valeur: 20000 },
];

const FILTRES_DATE = [
  { key: 'tous',          label: 'Toutes dates',  icon: 'calendar-outline' },
  { key: 'ce_soir',       label: 'Ce soir',       icon: 'moon-outline' },
  { key: 'demain',        label: 'Demain',        icon: 'sunny-outline' },
  { key: 'ce_weekend',    label: 'Ce week-end',   icon: 'beer-outline' },
  { key: 'cette_semaine', label: 'Cette semaine', icon: 'calendar-number-outline' },
  { key: 'date_precise',  label: 'Date précise',  icon: 'search-outline' },
];

const LIEUX_CATEGORIES = {
  'Salle de concert': { couleur: '#A855F7', icone: 'musical-notes', bg: '#F3E8FF' },
  'Théâtre':          { couleur: '#4F46E5', icone: 'easel',         bg: '#EEF2FF' },
  'Cinéma':           { couleur: '#9F1239', icone: 'film',          bg: '#FFF1F2' },
  'Opéra':            { couleur: '#7C3AED', icone: 'mic',           bg: '#EDE9FE' },
  'Musée':            { couleur: '#D97706', icone: 'image',         bg: '#FFFBEB' },
  'Stade':            { couleur: '#2563EB', icone: 'trophy',        bg: '#DBEAFE' },
  'Salle de sport':   { couleur: '#16A34A', icone: 'fitness',       bg: '#DCFCE7' },
  'Piscine':          { couleur: '#0EA5E9', icone: 'water',         bg: '#E0F2FE' },
  'Marché':           { couleur: '#EF4444', icone: 'storefront',    bg: '#FEE2E2' },
  'Mairie':           { couleur: '#64748B', icone: 'business',      bg: '#F1F5F9' },
};

function getLieuConfig(categorie, sousCategorie) {
  const sc = (sousCategorie || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (sc.includes('concert') || sc.includes('musical')) return LIEUX_CATEGORIES['Salle de concert'];
  if (sc.includes('cinema') || sc.includes('cinéma')) return LIEUX_CATEGORIES['Cinéma'];
  if (sc.includes('theatre') || sc.includes('théâtre')) return LIEUX_CATEGORIES['Théâtre'];
  if (sc.includes('opera') || sc.includes('opéra')) return LIEUX_CATEGORIES['Opéra'];
  if (sc.includes('musee') || sc.includes('musée')) return LIEUX_CATEGORIES['Musée'];
  if (sc.includes('stade')) return LIEUX_CATEGORIES['Stade'];
  if (sc.includes('piscine')) return LIEUX_CATEGORIES['Piscine'];
  if (sc.includes('sport')) return LIEUX_CATEGORIES['Salle de sport'];
  if (sc.includes('marche') || sc.includes('marché')) return LIEUX_CATEGORIES['Marché'];
  if (sc.includes('mairie')) return LIEUX_CATEGORIES['Mairie'];
  return LIEUX_CATEGORIES[sousCategorie] || CATEGORIES[categorie] || { couleur: '#6B7280', icone: 'location', bg: '#F3F4F6' };
}

function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getPlageDates(filtre, datePrecise) {
  const maintenant = new Date();
  const auj = new Date(maintenant); auj.setHours(0, 0, 0, 0);
  switch (filtre) {
    case 'ce_soir': { const f = new Date(auj); f.setHours(23, 59, 59, 999); return { debut: maintenant, fin: f }; }
    case 'demain': { const d = new Date(auj); d.setDate(d.getDate() + 1); const f = new Date(d); f.setHours(23, 59, 59, 999); return { debut: d, fin: f }; }
    case 'ce_weekend': { const j = maintenant.getDay(); const d = new Date(auj); d.setDate(d.getDate() + (j === 6 ? 0 : 6 - j)); const f = new Date(d); f.setDate(f.getDate() + 1); f.setHours(23, 59, 59, 999); return { debut: d, fin: f }; }
    case 'cette_semaine': { const f = new Date(auj); f.setDate(f.getDate() + (7 - f.getDay())); f.setHours(23, 59, 59, 999); return { debut: maintenant, fin: f }; }
    case 'date_precise': { if (!datePrecise) return null; const d = new Date(datePrecise); d.setHours(0, 0, 0, 0); const f = new Date(datePrecise); f.setHours(23, 59, 59, 999); return { debut: d, fin: f }; }
    default: return null;
  }
}

// ── Marqueurs ─────────────────────────────────────────────────────────────
const MarqueurCommunautaire = memo(({ id, latitude, longitude, categorie, onPress }) => {
  const cat = CATEGORIES[categorie] || { forte: '#2563EB', icone: 'construct-outline' };
  return (
    <Marker coordinate={{ latitude, longitude }} onPress={(e) => { e.stopPropagation(); onPress(); }}
      tracksViewChanges={false} calloutEnabled={false} identifier={`ev_${id}`} anchor={{ x: 0.5, y: 0.5 }} zIndex={2}>
      <View pointerEvents="none" style={[styles.marqueur, { borderColor: cat.forte }]}>
        <Ionicons name={cat.icone} size={13} color={cat.forte} />
      </View>
    </Marker>
  );
});

const MarqueurOfficiel = memo(({ id, latitude, longitude, categorie, onPress }) => {
  const cat = CATEGORIES[categorie] || CATEGORIES['Art'];
  return (
    <Marker coordinate={{ latitude: parseFloat(latitude), longitude: parseFloat(longitude) }}
      onPress={(e) => { e.stopPropagation(); onPress(); }}
      tracksViewChanges={false} calloutEnabled={false} identifier={`off_${id}`} anchor={{ x: 0.5, y: 0.5 }} zIndex={3}>
      <View pointerEvents="none" style={[styles.marqueur, { borderColor: cat.forte }]}>
        <Ionicons name={cat.icone.replace('-outline', '')} size={12} color={cat.forte} />
      </View>
    </Marker>
  );
});

const MarqueurLieu = memo(({ lieu, onPress }) => {
  const config = getLieuConfig(lieu.categorie, lieu.sous_categorie);
  return (
    <Marker coordinate={{ latitude: parseFloat(lieu.latitude), longitude: parseFloat(lieu.longitude) }}
      onPress={(e) => { e.stopPropagation(); onPress(); }}
      tracksViewChanges={false} calloutEnabled={false} identifier={`lieu_${lieu.id}`} anchor={{ x: 0.5, y: 0.5 }} zIndex={1}>
      <View pointerEvents="none" style={[styles.marqueurSmall, { borderColor: config.couleur }]}>
        <Ionicons name={config.icone} size={10} color={config.couleur} />
      </View>
    </Marker>
  );
});

const MarqueurStory = memo(({ story, onPress }) => {
  const couleur = story.type === 'spot' ? '#EF4444' : story.type === 'evenement' ? '#2563EB' : '#8B5CF6';
  return (
    <Marker coordinate={{ latitude: story.latitude, longitude: story.longitude }}
      onPress={(e) => { e.stopPropagation(); onPress(); }}
      tracksViewChanges={false} calloutEnabled={false} identifier={`story_${story.id}`} anchor={{ x: 0.5, y: 0.5 }} zIndex={10}>
      <View pointerEvents="none" style={[styles.marqueurStory, { borderColor: couleur }]}>
        <Ionicons name="camera" size={12} color={couleur} />
        <View style={[styles.marqueurStoryDot, { backgroundColor: couleur }]} />
      </View>
    </Marker>
  );
});

// ── Écran principal ────────────────────────────────────────────────────────
export default function CarteScreen({ navigation }) {
  const { evenements, erreurReseau, chargerEvenements } = useEvenements();
  const { theme, facteurTexte, ajouterFavori, estFavori, evenementCible, setEvenementCible } = useApp();

  const [pointSelectionne, setPointSelectionne] = useState(null);
  const [officielSelectionne, setOfficielSelectionne] = useState(null);
  const [lieuSelectionne, setLieuSelectionne] = useState(null);
  const [idSelectionne, setIdSelectionne] = useState(null);
  const [coordSurbrillance, setCoordSurbrillance] = useState(null);
  const [couleurSurbrillance, setCouleurSurbrillance] = useState('#2563EB');
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [afficherCommunautaires, setAfficherCommunautaires] = useState(true);
  const [afficherOfficiels, setAfficherOfficiels] = useState(true);
  const [afficherLieux, setAfficherLieux] = useState(false);
  const [afficherStories, setAfficherStories] = useState(true);
  const [lieuxCategoriesActives, setLieuxCategoriesActives] = useState(Object.keys(LIEUX_CATEGORIES));
  const [filtresCategories, setFiltresCategories] = useState([]);
  const [filtreDate, setFiltreDate] = useState('tous');
  const [datePrecise, setDatePrecise] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [rayon, setRayon] = useState(null);
  const [menuFabVisible, setMenuFabVisible] = useState(false);
  const [positionUser, setPositionUser] = useState(null);
  const [lieuxOfficiels, setLieuxOfficiels] = useState([]);
  const [evenementsOfficiels, setEvenementsOfficiels] = useState([]);
  const [stories, setStories] = useState([]);
  const [storyViewerVisible, setStoryViewerVisible] = useState(false);
  const [storiesSelectionnees, setStoriesSelectionnees] = useState([]);
  const [zoomSuffisant, setZoomSuffisant] = useState(false);
  const [pret, setPret] = useState(false);

  // Recherche adresse
  const [showRecherche, setShowRecherche] = useState(false);
  const [texteRecherche, setTexteRecherche] = useState('');
  const [resultatsRecherche, setResultatsRecherche] = useState([]);
  const rechercheTimer = useRef(null);

  const slideAnim = useRef(new Animated.Value(300)).current;
  const slideAnimOfficiel = useRef(new Animated.Value(300)).current;
  const slideAnimLieu = useRef(new Animated.Value(300)).current;
  const menuAnim = useRef(new Animated.Value(-300)).current;
  const mapRef = useRef(null);
  const t = (size) => size * facteurTexte;

  const chargerStories = async () => {
    try {
      const { data, error } = await supabase.from('stories').select('*').eq('actif', true)
        .gte('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(50);
      if (error) console.error('chargerStories:', error.message);
      if (data) setStories(data);
    } catch (e) { console.error('chargerStories:', e.message); }
  };

  const chargerLieux = async (pos, rayonM) => {
    try {
      const { data, error } = await supabase.rpc('lieux_dans_rayon', { lat: pos.latitude, lng: pos.longitude, rayon_metres: rayonM });
      if (error) console.error('chargerLieux:', error.message);
      if (data) setLieuxOfficiels(data);
    } catch (e) { console.error('chargerLieux:', e.message); }
  };

  const chargerEvenementsOfficiels = async () => {
    try {
      const PAGE = 1000;
      const MAX = 5000;
      let tous = [];
      for (let offset = 0; offset < MAX; offset += PAGE) {
        const { data, error } = await supabase.from('evenements_officiels')
          .select('id, titre, categorie, lieu, adresse, latitude, longitude, date_debut, date_fin, url, organisateur, gratuit, prix_min, salle, lieu_id')
          .eq('actif', true).not('latitude', 'is', null).not('longitude', 'is', null)
          .gte('latitude', 48.1).lte('latitude', 49.2).gte('longitude', 1.4).lte('longitude', 3.6)
          .gte('date_debut', new Date().toISOString())
          .order('date_debut', { ascending: true }).order('id', { ascending: true })
          .range(offset, offset + PAGE - 1);
        if (error) { console.error('chargerEvenementsOfficiels:', error.message); break; }
        if (!data || data.length === 0) break;
        tous = tous.concat(data);
        if (data.length < PAGE) break;
      }
      const uniques = [...new Map(tous.map(e => [e.id, e])).values()];
      setEvenementsOfficiels(uniques);
    } catch (e) { console.error('chargerEvenementsOfficiels:', e.message); }
  };

  useEffect(() => {
    (async () => {
      const tachesIndependantes = Promise.all([chargerEvenementsOfficiels(), chargerStories()]);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const pos = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setPositionUser(pos);
        chargerLieux(pos, 50000);
      } else {
        chargerLieux(PARIS, 50000);
      }
      await tachesIndependantes;
      setPret(true);
    })();
  }, []);

  useFocusEffect(useCallback(() => { if (pret) chargerStories(); }, [pret]));

  useFocusEffect(useCallback(() => {
    if (!evenementCible || !pret) return;
    const ev = evenementCible;
    setEvenementCible(null);
    recentrerSur(ev.latitude, ev.longitude);
    setTimeout(() => ouvrirPopupEvenement(ev), 800);
  }, [evenementCible, pret]));

  // Recherche adresse
  const rechercherAdresse = useCallback(async (texte) => {
    if (!texte || texte.length < 2) { setResultatsRecherche([]); return; }
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(texte + ' Paris')}&format=json&limit=5`;
      const r = await fetch(url, { headers: { 'User-Agent': 'LumaApp/1.0' } });
      const data = await r.json();
      setResultatsRecherche(data || []);
    } catch {}
  }, []);

  useEffect(() => {
    if (rechercheTimer.current) clearTimeout(rechercheTimer.current);
    rechercheTimer.current = setTimeout(() => rechercherAdresse(texteRecherche), 500);
    return () => clearTimeout(rechercheTimer.current);
  }, [texteRecherche]);

  const allerAdresse = (result) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    setShowRecherche(false);
    setTexteRecherche('');
    setResultatsRecherche([]);
    mapRef.current?.animateToRegion({ latitude: lat, longitude: lon, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 600);
  };

  const recentrerSur = useCallback((lat, lon) => {
    mapRef.current?.animateToRegion({ latitude: parseFloat(lat) - 0.003, longitude: parseFloat(lon), latitudeDelta: 0.012, longitudeDelta: 0.012 }, 500);
  }, []);

  const centrerSurMoi = useCallback(async () => {
    if (positionUser) {
      mapRef.current?.animateToRegion({ ...positionUser, latitudeDelta: 0.015, longitudeDelta: 0.015 }, 600);
    } else {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const pos = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setPositionUser(pos);
          mapRef.current?.animateToRegion({ ...pos, latitudeDelta: 0.015, longitudeDelta: 0.015 }, 600);
        }
      } catch {}
    }
  }, [positionUser]);

  const fermerToutesPopups = useCallback(() => {
    setIdSelectionne(null); setCoordSurbrillance(null);
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 300, useNativeDriver: true, duration: 200 }),
      Animated.timing(slideAnimOfficiel, { toValue: 300, useNativeDriver: true, duration: 200 }),
      Animated.timing(slideAnimLieu, { toValue: 300, useNativeDriver: true, duration: 200 }),
    ]).start(() => { setPointSelectionne(null); setOfficielSelectionne(null); setLieuSelectionne(null); });
  }, []);

  const ouvrirPopupEvenement = useCallback((point) => {
    setIdSelectionne(`ev_${point.id}`);
    setCoordSurbrillance({ latitude: point.latitude, longitude: point.longitude });
    setCouleurSurbrillance((CATEGORIES[point.categorie] || CATEGORIES['Art']).forte);
    setOfficielSelectionne(null); setLieuSelectionne(null);
    slideAnim.setValue(300); slideAnimOfficiel.setValue(300); slideAnimLieu.setValue(300);
    setPointSelectionne(point);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 12 }).start();
    recentrerSur(point.latitude, point.longitude);
  }, [recentrerSur]);

  const ouvrirPopupOfficiel = useCallback((ev) => {
    setIdSelectionne(`off_${ev.id}`);
    setCoordSurbrillance({ latitude: parseFloat(ev.latitude), longitude: parseFloat(ev.longitude) });
    setCouleurSurbrillance((CATEGORIES[ev.categorie] || CATEGORIES['Art']).forte);
    setPointSelectionne(null); setLieuSelectionne(null);
    slideAnim.setValue(300); slideAnimOfficiel.setValue(300); slideAnimLieu.setValue(300);
    setOfficielSelectionne(ev);
    Animated.spring(slideAnimOfficiel, { toValue: 0, useNativeDriver: true, tension: 60, friction: 12 }).start();
    recentrerSur(parseFloat(ev.latitude), parseFloat(ev.longitude));
  }, [recentrerSur]);

  const ouvrirPopupLieu = useCallback((lieu) => {
    setIdSelectionne(`lieu_${lieu.id}`);
    const config = getLieuConfig(lieu.categorie, lieu.sous_categorie);
    setCoordSurbrillance({ latitude: parseFloat(lieu.latitude), longitude: parseFloat(lieu.longitude) });
    setCouleurSurbrillance(config.couleur);
    setPointSelectionne(null); setOfficielSelectionne(null);
    slideAnim.setValue(300); slideAnimOfficiel.setValue(300); slideAnimLieu.setValue(300);
    setLieuSelectionne(lieu);
    Animated.spring(slideAnimLieu, { toValue: 0, useNativeDriver: true, tension: 60, friction: 12 }).start();
    recentrerSur(parseFloat(lieu.latitude), parseFloat(lieu.longitude));
  }, [recentrerSur]);

  const ouvrirMenu = () => {
    setMenuOuvert(true);
    Animated.spring(menuAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
  };

  const fermerMenu = () => {
    Animated.timing(menuAnim, { toValue: -300, useNativeDriver: true, duration: 250 }).start(() => setMenuOuvert(false));
  };

  const toutEffacer = () => {
    setFiltresCategories([]); setLieuxCategoriesActives(Object.keys(LIEUX_CATEGORIES));
    setAfficherCommunautaires(true); setAfficherOfficiels(true);
    setAfficherLieux(false); setAfficherStories(true);
    setFiltreDate('tous'); setRayon(null);
  };

  const plageDate = getPlageDates(filtreDate, datePrecise);
  const centre = positionUser || PARIS;

  const evenementsFiltres = afficherCommunautaires ? evenements.filter(p => {
    const matchCat = filtresCategories.length === 0 || filtresCategories.includes(p.categorie);
    const matchRayon = !rayon || !positionUser || distanceKm(centre.latitude, centre.longitude, p.latitude, p.longitude) * 1000 <= rayon;
    let matchDate = true;
    if (plageDate && p.type !== 'fixe') {
      if (!p.date_evenement) matchDate = false;
      else { const d = new Date(p.date_evenement); matchDate = d >= plageDate.debut && d <= plageDate.fin; }
    }
    return matchCat && matchRayon && matchDate;
  }) : [];

  const officielsFiltres = afficherOfficiels ? evenementsOfficiels.filter(ev => {
    const matchCat = filtresCategories.length === 0 || filtresCategories.includes(ev.categorie);
    const matchRayon = !rayon || !positionUser || !ev.latitude || !ev.longitude || distanceKm(centre.latitude, centre.longitude, parseFloat(ev.latitude), parseFloat(ev.longitude)) * 1000 <= rayon;
    let matchDate = true;
    if (plageDate) {
      if (!ev.date_debut) matchDate = false;
      else { const d = new Date(ev.date_debut); matchDate = d >= plageDate.debut && d <= plageDate.fin; }
    }
    return matchCat && matchRayon && matchDate;
  }) : [];

  const lieuxFiltres = (afficherLieux && zoomSuffisant && lieuxCategoriesActives.length > 0)
    ? lieuxOfficiels.filter(l => {
        const config = getLieuConfig(l.categorie, l.sous_categorie);
        const nomCat = Object.entries(LIEUX_CATEGORIES).find(([, c]) => c.couleur === config.couleur)?.[0];
        return lieuxCategoriesActives.includes(nomCat || l.sous_categorie || l.categorie);
      }) : [];

  const storiesFiltrees = afficherStories ? stories.filter(s => s.latitude && s.longitude) : [];

  const totalVisible = evenementsFiltres.length + officielsFiltres.length + storiesFiltrees.length;

  const nbFiltresActifs = filtresCategories.length + lieuxCategoriesActives.length +
    (!afficherCommunautaires ? 1 : 0) + (!afficherOfficiels ? 1 : 0) +
    (afficherLieux ? 1 : 0) + (!afficherStories ? 1 : 0) +
    (filtreDate !== 'tous' ? 1 : 0) + (rayon ? 1 : 0);

  const catSel = pointSelectionne ? (CATEGORIES[pointSelectionne.categorie] || CATEGORIES['Art']) : null;
  const configOfficiel = officielSelectionne ? (CATEGORIES[officielSelectionne.categorie] || CATEGORIES['Art']) : null;
  const configLieuSel = lieuSelectionne ? getLieuConfig(lieuSelectionne.categorie, lieuSelectionne.sous_categorie) : null;

  if (!pret) {
    return (
      <View style={{ flex: 1, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <Ionicons name="location" size={28} color="#111" />
        </View>
        <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700', letterSpacing: -0.8 }}>Luma</Text>
        <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, marginTop: 6 }}>Chargement de la carte...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{ ...(positionUser || PARIS), latitudeDelta: 0.06, longitudeDelta: 0.06 }}
        showsPointsOfInterest={false}
        showsUserLocation
        showsMyLocationButton={false}
        clusterColor="#111"
        clusterTextColor="#fff"
        clusterFontFamily="System"
        clusteringEnabled
        radius={36}
        minPoints={4}
        animationEnabled={false}
        onPress={() => {
          if (menuOuvert) fermerMenu();
          if (menuFabVisible) setMenuFabVisible(false);
          if (showRecherche) { setShowRecherche(false); setTexteRecherche(''); }
          fermerToutesPopups();
        }}
        onRegionChangeComplete={(region) => setZoomSuffisant(region.latitudeDelta < 0.25)}
      >
        {rayon && positionUser && (
          <Circle center={centre} radius={rayon} fillColor="rgba(37,99,235,0.05)" strokeColor="rgba(37,99,235,0.15)" strokeWidth={1} />
        )}
        {lieuxFiltres.map(lieu => (
          <MarqueurLieu key={`lieu_${lieu.id}`} lieu={lieu} onPress={() => ouvrirPopupLieu(lieu)} />
        ))}
        {officielsFiltres.map(ev => (
          <MarqueurOfficiel key={`off_${ev.id}`} id={ev.id} latitude={ev.latitude} longitude={ev.longitude} categorie={ev.categorie} onPress={() => ouvrirPopupOfficiel(ev)} />
        ))}
        {evenementsFiltres.map(p => (
          <MarqueurCommunautaire key={`ev_${p.id}`} id={p.id} latitude={p.latitude} longitude={p.longitude} categorie={p.categorie} onPress={() => ouvrirPopupEvenement(p)} />
        ))}
        {storiesFiltrees.map(story => (
          <MarqueurStory key={`story_${story.id}`} story={story}
            onPress={() => {
              const proches = storiesFiltrees.filter(s => distanceKm(story.latitude, story.longitude, s.latitude, s.longitude) < 0.2);
              setStoriesSelectionnees(proches.length > 0 ? proches : [story]);
              setStoryViewerVisible(true);
            }} />
        ))}
        {coordSurbrillance && (
          <Marker key="surbrillance" coordinate={coordSurbrillance} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} calloutEnabled={false} zIndex={999} onPress={() => {}}>
            <View pointerEvents="none" style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 3, borderColor: couleurSurbrillance, backgroundColor: couleurSurbrillance + '20' }} />
          </Marker>
        )}
      </MapView>

      {/* ── Header style Apple pill ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.logoPill}
          onPress={menuOuvert ? fermerMenu : ouvrirMenu}
          activeOpacity={0.85}
        >
          <View style={styles.logoDot}>
            <Ionicons name="location" size={11} color="#fff" />
          </View>
          <Text style={[styles.logoTxt, { fontSize: t(15) }]}>Luma</Text>
          {nbFiltresActifs > 0 && (
            <View style={styles.filtreCountBadge}>
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{nbFiltresActifs}</Text>
            </View>
          )}
          <Ionicons name={menuOuvert ? 'chevron-up' : 'chevron-down'} size={13} color="#aaa" />
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={[styles.headerIconBtn, showRecherche && { backgroundColor: '#DBEAFE' }]}
            onPress={() => { setShowRecherche(v => !v); if (!showRecherche) fermerMenu(); }}
            activeOpacity={0.8}
          >
            <Ionicons name="search" size={17} color={showRecherche ? '#2563EB' : '#666'} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.headerIconBtn, positionUser && { backgroundColor: '#2563EB' }]}
            onPress={centrerSurMoi}
            activeOpacity={0.8}
          >
            <Ionicons name="navigate" size={17} color={positionUser ? '#fff' : '#666'} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => navigation.navigate('Notifications')}
            activeOpacity={0.8}
          >
            <Ionicons name="notifications-outline" size={18} color="#666" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Barre recherche adresse ── */}
      {showRecherche && (
        <View style={styles.rechercheContainer}>
          <View style={styles.rechercheBar}>
            <Ionicons name="search-outline" size={15} color="#aaa" />
            <TextInput
              style={[styles.rechercheInput, { fontSize: t(14) }]}
              placeholder="Cherche une adresse, un lieu..."
              placeholderTextColor="#aaa"
              value={texteRecherche}
              onChangeText={setTexteRecherche}
              autoFocus
            />
            {texteRecherche.length > 0 && (
              <TouchableOpacity onPress={() => { setTexteRecherche(''); setResultatsRecherche([]); }}>
                <Ionicons name="close-circle" size={16} color="#aaa" />
              </TouchableOpacity>
            )}
          </View>
          {resultatsRecherche.length > 0 && (
            <View style={styles.rechercheResultats}>
              {resultatsRecherche.map((r, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.rechercheItem, i < resultatsRecherche.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.05)' }]}
                  onPress={() => allerAdresse(r)}
                >
                  <Ionicons name="location-outline" size={14} color="#2563EB" />
                  <Text style={{ color: '#111', fontSize: t(13), flex: 1 }} numberOfLines={2}>
                    {r.display_name.split(',').slice(0, 3).join(', ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {/* ── Filtres actifs ── */}
      {nbFiltresActifs > 0 && !menuOuvert && !showRecherche && (
        <View style={styles.filtresActifsWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}>
            {filtreDate !== 'tous' && (
              <TouchableOpacity style={[styles.filtrePill, { backgroundColor: '#111' }]} onPress={() => setFiltreDate('tous')}>
                <Ionicons name="calendar-outline" size={11} color="#fff" />
                <Text style={{ color: '#fff', fontSize: t(11), fontWeight: '500' }}>
                  {FILTRES_DATE.find(f => f.key === filtreDate)?.label}
                </Text>
                <Ionicons name="close" size={11} color="#fff" />
              </TouchableOpacity>
            )}
            {rayon && (
              <TouchableOpacity style={[styles.filtrePill, { backgroundColor: '#DBEAFE' }]} onPress={() => setRayon(null)}>
                <Ionicons name="navigate-outline" size={11} color="#1D4ED8" />
                <Text style={{ color: '#1D4ED8', fontSize: t(11), fontWeight: '500' }}>{rayon >= 1000 ? `${rayon / 1000} km` : `${rayon} m`}</Text>
                <Ionicons name="close" size={11} color="#1D4ED8" />
              </TouchableOpacity>
            )}
            {filtresCategories.map(cat => {
              const c = CATEGORIES[cat] || { claire: '#f5f5f5', forte: '#888', texte: '#444' };
              return (
                <TouchableOpacity key={cat} style={[styles.filtrePill, { backgroundColor: c.claire }]} onPress={() => setFiltresCategories(prev => prev.filter(x => x !== cat))}>
                  <Text style={{ color: c.texte, fontSize: t(11), fontWeight: '500' }}>{cat}</Text>
                  <Ionicons name="close" size={11} color={c.forte} />
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={[styles.filtrePill, { backgroundColor: '#FEE2E2' }]} onPress={toutEffacer}>
              <Text style={{ color: '#DC2626', fontSize: t(11), fontWeight: '500' }}>Tout effacer</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* ── Compteur ── */}
      {!menuOuvert && !showRecherche && totalVisible > 0 && (
        <View style={styles.compteur}>
          <Ionicons name="location" size={10} color="rgba(255,255,255,0.7)" />
          <Text style={{ color: '#fff', fontSize: t(11), fontWeight: '500' }}>{totalVisible} éléments</Text>
        </View>
      )}

      {/* ── Menu filtres style Apple ── */}
      {menuOuvert && (
        <Animated.View style={[styles.menu, { transform: [{ translateY: menuAnim }] }]}>
          <View style={styles.menuTopBar}>
            <Text style={[styles.menuTitre, { fontSize: t(15) }]}>Filtres</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {nbFiltresActifs > 0 && (
                <TouchableOpacity onPress={toutEffacer} style={styles.menuEffacerBtn}>
                  <Text style={{ color: '#DC2626', fontSize: t(12), fontWeight: '500' }}>Effacer</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={fermerMenu} style={styles.menuFermerBtn}>
                <Ionicons name="chevron-up" size={15} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.menuSection}>AFFICHAGE</Text>
            {[
              { key: 'comm',    label: 'Communautaires', desc: `${evenements.length}`, icon: 'people-outline',   actif: afficherCommunautaires, toggle: () => setAfficherCommunautaires(v => !v), bg: '#111', bgActif: '#111' },
              { key: 'off',     label: 'Agenda Paris',   desc: `${evenementsOfficiels.length}`, icon: 'calendar-outline', actif: afficherOfficiels,      toggle: () => setAfficherOfficiels(v => !v),      bg: '#DBEAFE', bgActif: '#2563EB' },
              { key: 'stories', label: 'Stories',        desc: `${stories.length}`,  icon: 'camera-outline',   actif: afficherStories,        toggle: () => setAfficherStories(v => !v),        bg: '#F3E8FF', bgActif: '#7C3AED' },
              { key: 'lieux',   label: 'Lieux',          desc: 'Cinémas, salles...', icon: 'location-outline', actif: afficherLieux,          toggle: () => setAfficherLieux(v => !v),          bg: '#F5F5F5', bgActif: '#64748B' },
            ].map(item => (
              <TouchableOpacity
                key={item.key}
                style={[styles.menuItem, item.actif && { backgroundColor: item.key === 'comm' ? '#111' : item.bg }]}
                onPress={item.toggle}
              >
                <View style={[styles.menuItemIcone, { backgroundColor: item.actif ? item.bgActif : '#f0f0ee' }]}>
                  <Ionicons name={item.icon} size={13} color={item.actif ? '#fff' : '#888'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: item.actif && item.key === 'comm' ? '#fff' : '#111', fontSize: t(13), fontWeight: item.actif ? '500' : '400' }}>{item.label}</Text>
                  <Text style={{ color: item.actif && item.key === 'comm' ? 'rgba(255,255,255,0.5)' : '#aaa', fontSize: t(11) }}>{item.desc} événements</Text>
                </View>
                <View style={[styles.checkbox, { backgroundColor: item.actif ? (item.key === 'comm' ? '#fff' : item.bgActif) : 'transparent', borderColor: item.actif ? (item.key === 'comm' ? '#fff' : item.bgActif) : '#ddd' }]}>
                  {item.actif && <Ionicons name="checkmark" size={11} color={item.key === 'comm' ? '#111' : '#fff'} />}
                </View>
              </TouchableOpacity>
            ))}

            <View style={styles.menuSep} />
            <Text style={styles.menuSection}>DATE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 8, paddingBottom: 8 }}>
              {FILTRES_DATE.map(fd => {
                const actif = filtreDate === fd.key;
                return (
                  <TouchableOpacity
                    key={fd.key}
                    style={[styles.dateChip, actif && { backgroundColor: '#111' }]}
                    onPress={() => { setFiltreDate(fd.key); if (fd.key === 'date_precise') setShowDatePicker(true); }}
                  >
                    <Ionicons name={fd.icon} size={12} color={actif ? '#fff' : '#aaa'} />
                    <Text style={{ color: actif ? '#fff' : '#666', fontSize: t(11), fontWeight: actif ? '600' : '400' }}>
                      {fd.key === 'date_precise' && filtreDate === 'date_precise'
                        ? datePrecise.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                        : fd.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {showDatePicker && (
              <DateTimePicker value={datePrecise} mode="date" minimumDate={new Date()}
                onChange={(e, d) => { setShowDatePicker(false); if (d) { setDatePrecise(d); setFiltreDate('date_precise'); } }} />
            )}

            <View style={styles.menuSep} />
            <Text style={styles.menuSection}>CATÉGORIES</Text>
            <View style={styles.catsGrid}>
              <TouchableOpacity
                style={[styles.catItem, filtresCategories.length === 0 && { backgroundColor: '#111' }]}
                onPress={() => setFiltresCategories([])}
              >
                <Ionicons name="apps-outline" size={16} color={filtresCategories.length === 0 ? '#fff' : '#aaa'} />
                <Text style={{ color: filtresCategories.length === 0 ? '#fff' : '#888', fontSize: t(10), marginTop: 4, textAlign: 'center' }}>Toutes</Text>
              </TouchableOpacity>
              {Object.entries(CATEGORIES).map(([nom, c]) => {
                const actif = filtresCategories.includes(nom);
                return (
                  <TouchableOpacity
                    key={nom}
                    style={[styles.catItem, actif && { backgroundColor: c.forte }]}
                    onPress={() => setFiltresCategories(prev => prev.includes(nom) ? prev.filter(x => x !== nom) : [...prev, nom])}
                  >
                    <Ionicons name={c.icone} size={16} color={actif ? '#fff' : c.forte} />
                    <Text style={{ color: actif ? '#fff' : '#888', fontSize: t(10), marginTop: 4, textAlign: 'center' }} numberOfLines={1}>{nom}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.menuSep} />
            <Text style={styles.menuSection}>RAYON</Text>
            <TouchableOpacity style={[styles.menuItem, !rayon && { backgroundColor: '#f5f5f3' }]} onPress={() => setRayon(null)}>
              <View style={[styles.menuItemIcone, { backgroundColor: '#f0f0ee' }]}><Ionicons name="globe-outline" size={13} color="#888" /></View>
              <Text style={{ color: '#111', fontSize: t(13), flex: 1 }}>Tout afficher</Text>
              {!rayon && <Ionicons name="checkmark" size={16} color="#2563EB" />}
            </TouchableOpacity>
            {RAYONS.map(r => (
              <TouchableOpacity key={r.valeur} style={[styles.menuItem, rayon === r.valeur && { backgroundColor: '#EFF6FF' }]} onPress={() => setRayon(r.valeur)}>
                <View style={[styles.menuItemIcone, { backgroundColor: '#DBEAFE' }]}><Ionicons name="navigate-outline" size={13} color="#1D4ED8" /></View>
                <Text style={{ color: '#111', fontSize: t(13), flex: 1 }}>{r.label}</Text>
                {rayon === r.valeur && <Ionicons name="checkmark" size={16} color="#2563EB" />}
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.menuFermerBas} onPress={fermerMenu}>
              <Ionicons name="chevron-up" size={15} color="#fff" />
              <Text style={{ color: '#fff', fontSize: t(13), fontWeight: '500' }}>Fermer</Text>
            </TouchableOpacity>
            <View style={{ height: 8 }} />
          </ScrollView>
        </Animated.View>
      )}

      {/* ── Popup événement communautaire ── */}
      {pointSelectionne && catSel && (
        <Animated.View style={[styles.popup, { transform: [{ translateY: slideAnim }] }]}>
          <TouchableOpacity style={styles.popupClose} onPress={fermerToutesPopups}>
            <Ionicons name="close" size={15} color="#888" />
          </TouchableOpacity>
          <Text style={[styles.popupTitre, { fontSize: t(16) }]}>{pointSelectionne.titre}</Text>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <View style={[styles.tag, { backgroundColor: catSel.claire }]}>
              <Ionicons name={catSel.icone} size={11} color={catSel.forte} />
              <Text style={{ color: catSel.texte, fontSize: t(11), fontWeight: '500' }}>{pointSelectionne.categorie}</Text>
            </View>
            <View style={[styles.tag, { backgroundColor: '#f0f0ee' }]}>
              <Ionicons name="people-outline" size={11} color="#666" />
              <Text style={{ color: '#666', fontSize: t(11) }}>
                {pointSelectionne.sans_max ? String(pointSelectionne.participants || 0) : `${pointSelectionne.participants || 0}/${pointSelectionne.max || '?'}`}
              </Text>
            </View>
            {positionUser && (
              <View style={[styles.tag, { backgroundColor: '#f0f0ee' }]}>
                <Text style={{ color: '#888', fontSize: t(11) }}>
                  {Math.round(distanceKm(positionUser.latitude, positionUser.longitude, pointSelectionne.latitude, pointSelectionne.longitude) * 10) / 10} km
                </Text>
              </View>
            )}
          </View>
          {pointSelectionne.description && (
            <Text style={{ color: '#666', fontSize: t(13), lineHeight: 19, marginBottom: 10 }} numberOfLines={2}>{pointSelectionne.description}</Text>
          )}
          <View style={styles.popupBtns}>
            <TouchableOpacity style={[styles.popupBtnPrimary, { backgroundColor: catSel.forte }]}
              onPress={() => { fermerToutesPopups(); navigation.navigate('DetailEvenement', { evenement: pointSelectionne }); }}>
              <Text style={{ color: '#fff', fontSize: t(13), fontWeight: '600' }}>Voir le détail</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.popupBtnIcon} onPress={() => ajouterFavori(pointSelectionne)}>
              <Ionicons name={estFavori(pointSelectionne.id) ? 'bookmark' : 'bookmark-outline'} size={17} color={estFavori(pointSelectionne.id) ? '#F59E0B' : '#666'} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.popupBtnIcon} onPress={() => Share.share({ message: `Luma — ${pointSelectionne.titre}` })}>
              <Ionicons name="share-outline" size={17} color="#666" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* ── Popup événement officiel ── */}
      {officielSelectionne && configOfficiel && (
        <Animated.View style={[styles.popup, { transform: [{ translateY: slideAnimOfficiel }] }]}>
          <TouchableOpacity style={styles.popupClose} onPress={fermerToutesPopups}>
            <Ionicons name="close" size={15} color="#888" />
          </TouchableOpacity>
          <Text style={[styles.popupTitre, { fontSize: t(16) }]} numberOfLines={2}>{officielSelectionne.titre}</Text>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <View style={[styles.tag, { backgroundColor: configOfficiel.claire }]}>
              <Ionicons name={configOfficiel.icone} size={11} color={configOfficiel.forte} />
              <Text style={{ color: configOfficiel.texte, fontSize: t(11), fontWeight: '500' }}>{officielSelectionne.categorie}</Text>
            </View>
            {officielSelectionne.gratuit && <View style={[styles.tag, { backgroundColor: '#DCFCE7' }]}><Text style={{ color: '#15803D', fontSize: t(11), fontWeight: '500' }}>Gratuit</Text></View>}
            {officielSelectionne.prix_min && <View style={[styles.tag, { backgroundColor: '#FEF3C7' }]}><Text style={{ color: '#92400E', fontSize: t(11) }}>Dès {officielSelectionne.prix_min}€</Text></View>}
          </View>
          {officielSelectionne.date_debut && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Ionicons name="calendar-outline" size={13} color={configOfficiel.forte} />
              <Text style={{ color: configOfficiel.forte, fontSize: t(12), fontWeight: '500' }}>{formatDateParis(officielSelectionne.date_debut)}</Text>
            </View>
          )}
          {officielSelectionne.lieu && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Ionicons name="location-outline" size={13} color="#aaa" />
              <Text style={{ color: '#888', fontSize: t(12), flex: 1 }} numberOfLines={1}>{officielSelectionne.lieu}</Text>
            </View>
          )}
          <View style={styles.popupBtns}>
            <TouchableOpacity style={[styles.popupBtnPrimary, { backgroundColor: configOfficiel.forte }]}
              onPress={() => { fermerToutesPopups(); navigation.navigate('DetailEvenementOfficiel', { evenement: officielSelectionne }); }}>
              <Ionicons name="arrow-forward" size={14} color="#fff" />
              <Text style={{ color: '#fff', fontSize: t(13), fontWeight: '600' }}>Voir le détail</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.popupBtnIcon} onPress={() => Share.share({ message: `${officielSelectionne.titre}\n${officielSelectionne.url || ''}` })}>
              <Ionicons name="share-outline" size={17} color="#666" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* ── Popup lieu ── */}
      {lieuSelectionne && configLieuSel && (
        <Animated.View style={[styles.popup, { transform: [{ translateY: slideAnimLieu }] }]}>
          <TouchableOpacity style={styles.popupClose} onPress={fermerToutesPopups}>
            <Ionicons name="close" size={15} color="#888" />
          </TouchableOpacity>
          <Text style={[styles.popupTitre, { fontSize: t(16) }]} numberOfLines={2}>{lieuSelectionne.nom}</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
            <View style={[styles.tag, { backgroundColor: configLieuSel.bg || '#f5f5f5' }]}>
              <Ionicons name={configLieuSel.icone} size={11} color={configLieuSel.couleur} />
              <Text style={{ color: configLieuSel.couleur, fontSize: t(11), fontWeight: '500' }}>{lieuSelectionne.sous_categorie || lieuSelectionne.categorie}</Text>
            </View>
          </View>
          {lieuSelectionne.adresse && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Ionicons name="location-outline" size={13} color="#aaa" />
              <Text style={{ color: '#888', fontSize: t(13), flex: 1 }}>{lieuSelectionne.adresse}</Text>
            </View>
          )}
          <View style={styles.popupBtns}>
            <TouchableOpacity style={[styles.popupBtnPrimary, { backgroundColor: configLieuSel.couleur }]}
              onPress={() => { fermerToutesPopups(); navigation.navigate('DetailLieu', { lieu: lieuSelectionne }); }}>
              <Text style={{ color: '#fff', fontSize: t(13), fontWeight: '600' }}>
                {lieuSelectionne.sous_categorie === 'Cinéma' ? 'Voir les séances' : 'Voir la fiche'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.popupBtnIcon} onPress={() => navigation.navigate('CreerStory', { lieu: lieuSelectionne })}>
              <Ionicons name="camera-outline" size={18} color={configLieuSel.couleur} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* ── FAB menu ── */}
      {menuFabVisible && (
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setMenuFabVisible(false)} activeOpacity={1} />
      )}
      {menuFabVisible && (
        <View style={styles.fabMenu}>
          <TouchableOpacity style={styles.fabMenuItem} onPress={() => { setMenuFabVisible(false); navigation.navigate('CreerStory'); }}>
            <View style={[styles.fabMenuIcone, { backgroundColor: '#7C3AED' }]}>
              <Ionicons name="camera" size={18} color="#fff" />
            </View>
            <Text style={styles.fabMenuLabel}>Story</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.fabMenuItem} onPress={() => { setMenuFabVisible(false); navigation.navigate('AjoutEvenement'); }}>
            <View style={[styles.fabMenuIcone, { backgroundColor: '#111' }]}>
              <Ionicons name="calendar-outline" size={18} color="#fff" />
            </View>
            <Text style={styles.fabMenuLabel}>Événement</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={[styles.fab, menuFabVisible && { backgroundColor: '#EF4444' }]}
        onPress={() => { setMenuFabVisible(v => !v); if (menuOuvert) fermerMenu(); if (showRecherche) setShowRecherche(false); }}
        activeOpacity={0.85}
      >
        <Ionicons name={menuFabVisible ? 'close' : 'add'} size={24} color="#fff" />
      </TouchableOpacity>

      {/* ── Story Viewer ── */}
      {storyViewerVisible && storiesSelectionnees.length > 0 && (
        <Modal visible animationType="fade" statusBarTranslucent>
          <StoryViewer
            stories={storiesSelectionnees}
            onFermer={() => setStoryViewerVisible(false)}
            onVoirCarte={(lat, lon) => {
              setStoryViewerVisible(false);
              mapRef.current?.animateToRegion({ latitude: lat, longitude: lon, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 500);
            }}
            navigation={navigation}
          />
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  map: { flex: 1 },

  marqueur: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#fff', borderWidth: 2.5, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 4 },
  marqueurSmall: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff', borderWidth: 2, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 3 },
  marqueurStory: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#fff', borderWidth: 2.5, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 4 },
  marqueurStoryDot: { position: 'absolute', bottom: 1, right: 1, width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: '#fff' },

  header: { position: 'absolute', top: 52, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 },
  logoPill: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(255,255,255,0.97)', borderRadius: 22, paddingHorizontal: 12, paddingVertical: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },
  logoDot: { width: 22, height: 22, borderRadius: 7, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  logoTxt: { fontWeight: '600', color: '#111', letterSpacing: -0.2 },
  filtreCountBadge: { backgroundColor: '#EF4444', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  headerIconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.97)', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 },

  rechercheContainer: { position: 'absolute', top: 100, left: 16, right: 16, zIndex: 15 },
  rechercheBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 16, padding: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8 },
  rechercheInput: { flex: 1, color: '#111' },
  rechercheResultats: { backgroundColor: '#fff', borderRadius: 16, marginTop: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 6, overflow: 'hidden' },
  rechercheItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },

  filtresActifsWrap: { position: 'absolute', top: 100, left: 0, right: 0, zIndex: 4 },
  filtrePill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },

  compteur: { position: 'absolute', top: 104, left: 16, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 4, zIndex: 4 },

  menu: { position: 'absolute', top: 96, left: 16, width: 285, backgroundColor: '#fff', borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 10, maxHeight: 580, zIndex: 9, overflow: 'hidden' },
  menuTopBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.06)' },
  menuTitre: { fontWeight: '600', color: '#111' },
  menuEffacerBtn: { backgroundColor: '#FEE2E2', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  menuFermerBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  menuSection: { fontSize: 11, fontWeight: '700', color: '#aaa', letterSpacing: 0.06, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, marginHorizontal: 6, borderRadius: 12 },
  menuItemIcone: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  menuSep: { height: 0.5, backgroundColor: 'rgba(0,0,0,0.06)', marginVertical: 6, marginHorizontal: 14 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dateChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: '#f5f5f3' },
  catsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 8 },
  catItem: { width: '28%', alignItems: 'center', justifyContent: 'center', padding: 10, borderRadius: 14, backgroundColor: '#f5f5f3', minHeight: 62 },
  menuFermerBas: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#111', borderRadius: 14, margin: 10, padding: 11 },

  popup: { position: 'absolute', bottom: 180, left: 12, right: 12, backgroundColor: '#fff', borderRadius: 24, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 8, zIndex: 10 },
  popupClose: { position: 'absolute', top: 14, right: 14, width: 26, height: 26, borderRadius: 13, backgroundColor: '#f0f0ee', alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  popupTitre: { fontWeight: '600', color: '#111', marginBottom: 8, paddingRight: 32, letterSpacing: -0.2 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 },
  popupBtns: { flexDirection: 'row', gap: 8, marginTop: 2 },
  popupBtnPrimary: { flex: 1, borderRadius: 13, padding: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 5 },
  popupBtnIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#f5f5f3', alignItems: 'center', justifyContent: 'center' },

  fab: { position: 'absolute', bottom: 100, right: 16, width: 50, height: 50, backgroundColor: '#111', borderRadius: 25, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6, zIndex: 10 },
  fabMenu: { position: 'absolute', bottom: 160, right: 16, gap: 10, zIndex: 20, alignItems: 'flex-end' },
  fabMenuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.97)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  fabMenuIcone: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  fabMenuLabel: { fontSize: 14, fontWeight: '600', color: '#111' },
});