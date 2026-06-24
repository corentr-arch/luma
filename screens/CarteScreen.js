import {
  StyleSheet, View, Text, TouchableOpacity,
  Animated, Share, ScrollView,
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
  const cat = (categorie || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (sc.includes('concert') || sc.includes('musical')) return LIEUX_CATEGORIES['Salle de concert'];
  if (sc.includes('cinema') || sc.includes('cinéma') || cat === 'cinema') return LIEUX_CATEGORIES['Cinéma'];
  if (sc.includes('theatre') || sc.includes('théâtre')) return LIEUX_CATEGORIES['Théâtre'];
  if (sc.includes('opera') || sc.includes('opéra')) return LIEUX_CATEGORIES['Opéra'];
  if (sc.includes('musee') || sc.includes('musée') || sc.includes('fondation')) return LIEUX_CATEGORIES['Musée'];
  if (sc.includes('stade')) return LIEUX_CATEGORIES['Stade'];
  if (sc.includes('piscine')) return LIEUX_CATEGORIES['Piscine'];
  if (sc.includes('sport')) return LIEUX_CATEGORIES['Salle de sport'];
  if (sc.includes('marche') || sc.includes('marché')) return LIEUX_CATEGORIES['Marché'];
  if (sc.includes('mairie')) return LIEUX_CATEGORIES['Mairie'];
  if (cat === 'cinéma' || cat === 'cinema') return LIEUX_CATEGORIES['Cinéma'];
  return LIEUX_CATEGORIES[sousCategorie] || CATEGORIES[categorie] || { couleur: '#6B7280', icone: 'location', bg: '#F3F4F6' };
}

function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
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

// ── MARQUEURS — taille fixe, sans estSelectionne ──────────────────────────────

const MarqueurCommunautaire = memo(({ id, latitude, longitude, categorie, onPress }) => {
  const cat = CATEGORIES[categorie] || { forte: '#2563EB', icone: 'construct-outline' };
  return (
    <Marker
      coordinate={{ latitude, longitude }}
      onPress={(e) => { e.stopPropagation(); onPress(); }}
      tracksViewChanges={false}
      calloutEnabled={false}
      identifier={`ev_${id}`}
      anchor={{ x: 0.5, y: 0.5 }}
      zIndex={2}
    >
      <View pointerEvents="none" style={[styles.mRond, { borderColor: cat.forte }]}>
        <Ionicons name={cat.icone} size={14} color={cat.forte} />
      </View>
    </Marker>
  );
});

const MarqueurFixe = memo(({ id, latitude, longitude, categorie, onPress }) => {
  const cat = CATEGORIES[categorie] || { forte: '#2563EB', icone: 'construct-outline' };
  return (
    <Marker
      coordinate={{ latitude, longitude }}
      onPress={(e) => { e.stopPropagation(); onPress(); }}
      tracksViewChanges={false}
      calloutEnabled={false}
      identifier={`fix_${id}`}
      anchor={{ x: 0.5, y: 0.5 }}
      zIndex={2}
    >
      <View pointerEvents="none" style={[styles.mRond, { borderColor: cat.forte }]}>
        <Ionicons name={cat.icone} size={14} color={cat.forte} />
      </View>
    </Marker>
  );
});

const MarqueurOfficiel = memo(({ id, latitude, longitude, categorie, onPress }) => {
  const cat = CATEGORIES[categorie] || CATEGORIES['Art'];
  return (
    <Marker
      coordinate={{ latitude: parseFloat(latitude), longitude: parseFloat(longitude) }}
      onPress={(e) => { e.stopPropagation(); onPress(); }}
      tracksViewChanges={false}
      calloutEnabled={false}
      identifier={`off_${id}`}
      anchor={{ x: 0.5, y: 0.5 }}
      zIndex={3}
    >
      <View pointerEvents="none" style={[styles.mRond, { borderColor: cat.forte }]}>
        <Ionicons name={cat.icone.replace('-outline', '')} size={13} color={cat.forte} />
      </View>
    </Marker>
  );
});

const MarqueurLieu = memo(({ lieu, onPress }) => {
  const config = getLieuConfig(lieu.categorie, lieu.sous_categorie);
  return (
    <Marker
      coordinate={{ latitude: parseFloat(lieu.latitude), longitude: parseFloat(lieu.longitude) }}
      onPress={(e) => { e.stopPropagation(); onPress(); }}
      tracksViewChanges={false}
      calloutEnabled={false}
      identifier={`lieu_${lieu.id}`}
      anchor={{ x: 0.5, y: 0.5 }}
      zIndex={1}
    >
      <View pointerEvents="none" style={[styles.mRondSmall, { borderColor: config.couleur }]}>
        <Ionicons name={config.icone} size={10} color={config.couleur} />
      </View>
    </Marker>
  );
});

// ── Écran principal ───────────────────────────────────────────────────────────

export default function CarteScreen({ navigation }) {
  const { evenements, erreurReseau, chargerEvenements } = useEvenements();
  const {
    theme, facteurTexte,
    ajouterFavori, estFavori,
    evenementCible, setEvenementCible,
  } = useApp();

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
  const [lieuxCategoriesActives, setLieuxCategoriesActives] = useState([]);
  const [filtresCategories, setFiltresCategories] = useState([]);
  const [filtreDate, setFiltreDate] = useState('tous');
  const [datePrecise, setDatePrecise] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [rayon, setRayon] = useState(null);
  const [interetsCharges, setInteretsCharges] = useState(false);

  const [positionUser, setPositionUser] = useState(null);
  const [lieuxOfficiels, setLieuxOfficiels] = useState([]);
  const [evenementsOfficiels, setEvenementsOfficiels] = useState([]);
  const [regionActuelle, setRegionActuelle] = useState({ ...PARIS, latitudeDelta: 0.08, longitudeDelta: 0.08 });
  const [pret, setPret] = useState(false);
  const [zoomSuffisant, setZoomSuffisant] = useState(false);

  const slideAnim = useRef(new Animated.Value(300)).current;
  const slideAnimOfficiel = useRef(new Animated.Value(300)).current;
  const slideAnimLieu = useRef(new Animated.Value(300)).current;
  const menuAnim = useRef(new Animated.Value(-300)).current;
  const mapRef = useRef(null);
  const t = (size) => size * facteurTexte;

  // Charge les intérêts une seule fois au premier lancement
  const chargerInterets = async () => {
    if (interetsCharges) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profil } = await supabase
          .from('profiles')
          .select('interets')
          .eq('id', user.id)
          .single();
        if (profil?.interets && profil.interets.length > 0) {
          setFiltresCategories(profil.interets);
        }
      }
    } catch {}
    setInteretsCharges(true);
  };

  useEffect(() => {
    (async () => {
      await chargerInterets();

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const pos = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setPositionUser(pos);
        setRegionActuelle({ ...pos, latitudeDelta: 0.04, longitudeDelta: 0.04 });
        chargerLieux(pos, 50000);
      } else {
        chargerLieux(PARIS, 50000);
      }
      await chargerEvenementsOfficiels();
      setPret(true);
    })();
  }, []);

  const chargerLieux = async (pos, rayonM) => {
    try {
      const { data } = await supabase.rpc('lieux_dans_rayon', {
        lat: pos.latitude, lng: pos.longitude, rayon_metres: rayonM,
      });
      if (data) setLieuxOfficiels(data);
    } catch {}
  };

  const chargerEvenementsOfficiels = async () => {
    try {
      const maintenant = new Date().toISOString();
      const { data } = await supabase
        .from('evenements_officiels')
        .select('id, titre, description, categorie, lieu, adresse, latitude, longitude, date_debut, date_fin, url, organisateur, source, gratuit, prix_min, salle, lieu_id')
        .eq('actif', true)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .or(`date_fin.gte.${maintenant},and(date_fin.is.null,date_debut.gte.${maintenant})`)
        .order('date_debut', { ascending: true })
        .limit(700);
      if (data) setEvenementsOfficiels(data);
    } catch {}
  };

  useFocusEffect(
    useCallback(() => {
      if (!evenementCible || !pret) return;
      const ev = evenementCible;
      setEvenementCible(null);
      recentrerSur(ev.latitude, ev.longitude);
      setTimeout(() => ouvrirPopupEvenement(ev), 800);
    }, [evenementCible, pret])
  );

  const recentrerSur = useCallback((lat, lon) => {
    if (!mapRef.current) return;
    mapRef.current.animateToRegion({
      latitude: parseFloat(lat) - 0.003,
      longitude: parseFloat(lon),
      latitudeDelta: 0.012,
      longitudeDelta: 0.012,
    }, 500);
  }, []);

  const centrerUser = () => {
    if (!positionUser || !mapRef.current) return;
    mapRef.current.animateToRegion(
      { ...positionUser, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 600
    );
  };

  const fermerToutesPopups = useCallback(() => {
    setIdSelectionne(null);
    setCoordSurbrillance(null);
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 300, useNativeDriver: true, duration: 200 }),
      Animated.timing(slideAnimOfficiel, { toValue: 300, useNativeDriver: true, duration: 200 }),
      Animated.timing(slideAnimLieu, { toValue: 300, useNativeDriver: true, duration: 200 }),
    ]).start(() => {
      setPointSelectionne(null);
      setOfficielSelectionne(null);
      setLieuSelectionne(null);
    });
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
    Animated.timing(menuAnim, { toValue: -300, useNativeDriver: true, duration: 250 })
      .start(() => setMenuOuvert(false));
  };

  const toutEffacer = () => {
    setFiltresCategories([]);
    setLieuxCategoriesActives([]);
    setAfficherCommunautaires(true);
    setAfficherOfficiels(true);
    setAfficherLieux(false);
    setFiltreDate('tous');
    setRayon(null);
  };

  const toggleLieuCategorie = useCallback((cat) => {
    setLieuxCategoriesActives(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  }, []);

  const plageDate = getPlageDates(filtreDate, datePrecise);
  const centre = positionUser || PARIS;

  const evenementsFiltres = afficherCommunautaires ? evenements.filter(p => {
    const matchCat = filtresCategories.length === 0 || filtresCategories.includes(p.categorie);
    const matchRayon = !rayon || !positionUser ||
      distanceKm(centre.latitude, centre.longitude, p.latitude, p.longitude) * 1000 <= rayon;
    let matchDate = true;
    if (plageDate && p.type !== 'fixe') {
      if (!p.date_evenement) matchDate = false;
      else { const d = new Date(p.date_evenement); matchDate = d >= plageDate.debut && d <= plageDate.fin; }
    }
    return matchCat && matchRayon && matchDate;
  }) : [];

  const officielsFiltres = afficherOfficiels ? evenementsOfficiels.filter(ev => {
    const matchCat = filtresCategories.length === 0 || filtresCategories.includes(ev.categorie);
    const matchRayon = !rayon || !positionUser || !ev.latitude || !ev.longitude ||
      distanceKm(centre.latitude, centre.longitude,
        parseFloat(ev.latitude), parseFloat(ev.longitude)) * 1000 <= rayon;
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
        const nomCat = Object.entries(LIEUX_CATEGORIES)
          .find(([, c]) => c.couleur === config.couleur)?.[0];
        const matchCat = lieuxCategoriesActives.includes(nomCat || l.sous_categorie || l.categorie);
        const matchRayon = !rayon || !positionUser ||
          distanceKm(centre.latitude, centre.longitude,
            parseFloat(l.latitude), parseFloat(l.longitude)) * 1000 <= rayon;
        return matchCat && matchRayon;
      })
    : [];

  const compterLieuxParCategorie = (nomCat) => {
    const config = LIEUX_CATEGORIES[nomCat];
    if (!config) return 0;
    return lieuxOfficiels.filter(l => {
      const lc = getLieuConfig(l.categorie, l.sous_categorie);
      return lc.couleur === config.couleur;
    }).length;
  };

  const nbFiltresActifs =
    filtresCategories.length + lieuxCategoriesActives.length +
    (!afficherCommunautaires ? 1 : 0) + (!afficherOfficiels ? 1 : 0) +
    (afficherLieux ? 1 : 0) + (filtreDate !== 'tous' ? 1 : 0) + (rayon ? 1 : 0);

  const labelDateActif = filtreDate !== 'tous'
    ? (filtreDate === 'date_precise'
        ? datePrecise.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
        : FILTRES_DATE.find(f => f.key === filtreDate)?.label)
    : null;

  const catSel = pointSelectionne ? (CATEGORIES[pointSelectionne.categorie] || CATEGORIES['Art']) : null;
  const configOfficiel = officielSelectionne ? (CATEGORIES[officielSelectionne.categorie] || CATEGORIES['Art']) : null;
  const configLieuSel = lieuSelectionne ? getLieuConfig(lieuSelectionne.categorie, lieuSelectionne.sous_categorie) : null;

  if (!pret) {
    return (
      <View style={{ flex: 1, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Ionicons name="location" size={26} color="#fff" />
        </View>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '500' }}>Luma</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={regionActuelle}
        showsPointsOfInterest={false}
        showsUserLocation
        showsMyLocationButton={false}
        userInterfaceStyle={theme.bg === '#0A0A0A' ? 'dark' : 'light'}
        clusterColor="#1E293B"
        clusterTextColor="#fff"
        clusterFontFamily="System"
        clusteringEnabled
        radius={36}
        extent={512}
        minZoom={1}
        maxZoom={20}
        minPoints={4}
        animationEnabled={false}
        onPress={() => { if (menuOuvert) fermerMenu(); fermerToutesPopups(); }}
        onRegionChangeComplete={(region) => {
          setRegionActuelle(region);
          setZoomSuffisant(region.latitudeDelta < 0.25);
        }}
      >
        {rayon && positionUser && (
          <Circle center={centre} radius={rayon}
            fillColor="rgba(37,99,235,0.05)"
            strokeColor="rgba(37,99,235,0.2)"
            strokeWidth={1}
          />
        )}

        {lieuxFiltres.map(lieu => (
          <MarqueurLieu
            key={`lieu_${lieu.id}`}
            lieu={lieu}
            onPress={() => ouvrirPopupLieu(lieu)}
          />
        ))}

        {officielsFiltres.map(ev => (
          <MarqueurOfficiel
            key={`off_${ev.id}`}
            id={ev.id}
            latitude={ev.latitude}
            longitude={ev.longitude}
            categorie={ev.categorie}
            onPress={() => ouvrirPopupOfficiel(ev)}
          />
        ))}

        {evenementsFiltres.map(p =>
          p.type === 'fixe' ? (
            <MarqueurFixe
              key={`fix_${p.id}`}
              id={p.id}
              latitude={p.latitude}
              longitude={p.longitude}
              categorie={p.categorie}
              onPress={() => ouvrirPopupEvenement(p)}
            />
          ) : (
            <MarqueurCommunautaire
              key={`ev_${p.id}`}
              id={p.id}
              latitude={p.latitude}
              longitude={p.longitude}
              categorie={p.categorie}
              onPress={() => ouvrirPopupEvenement(p)}
            />
          )
        )}

        {coordSurbrillance && (
          <Marker
            key="overlay_surbrillance"
            coordinate={coordSurbrillance}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            calloutEnabled={false}
            zIndex={999}
            onPress={() => {}}
          >
            <View pointerEvents="none" style={{
              width: 44, height: 44, borderRadius: 22,
              borderWidth: 3,
              borderColor: couleurSurbrillance,
              backgroundColor: couleurSurbrillance + '20',
            }} />
          </Marker>
        )}
      </MapView>

      {erreurReseau && (
        <View style={styles.erreurBanner}>
          <Ionicons name="wifi-outline" size={14} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 13, flex: 1 }}>Pas de connexion</Text>
          <TouchableOpacity onPress={chargerEvenements} style={styles.erreurBtn}>
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '500' }}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      )}

      {nbFiltresActifs > 0 && (
        <View style={styles.filtresActifsWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}>
            {labelDateActif && (
              <TouchableOpacity style={[styles.pill, { backgroundColor: '#111', borderColor: '#333' }]}
                onPress={() => setFiltreDate('tous')}>
                <Ionicons name="calendar-outline" size={11} color="#fff" />
                <Text style={{ color: '#fff', fontSize: t(11), fontWeight: '500' }}>{labelDateActif}</Text>
                <Ionicons name="close" size={11} color="#fff" />
              </TouchableOpacity>
            )}
            {rayon && (
              <TouchableOpacity style={[styles.pill, { backgroundColor: '#DBEAFE', borderColor: '#2563EB' }]}
                onPress={() => setRayon(null)}>
                <Ionicons name="navigate-outline" size={11} color="#2563EB" />
                <Text style={{ color: '#1E40AF', fontSize: t(11), fontWeight: '500' }}>
                  {rayon >= 1000 ? `${rayon / 1000} km` : `${rayon} m`}
                </Text>
                <Ionicons name="close" size={11} color="#2563EB" />
              </TouchableOpacity>
            )}
            {filtresCategories.map(cat => {
              const c = CATEGORIES[cat] || { claire: '#F5F5F5', forte: '#888', texte: '#444', icone: 'apps-outline' };
              return (
                <TouchableOpacity key={cat}
                  style={[styles.pill, { backgroundColor: c.claire, borderColor: c.forte }]}
                  onPress={() => setFiltresCategories(prev => prev.filter(x => x !== cat))}>
                  <Ionicons name={c.icone} size={11} color={c.forte} />
                  <Text style={{ color: c.texte, fontSize: t(11), fontWeight: '500' }}>{cat}</Text>
                  <Ionicons name="close" size={11} color={c.forte} />
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={[styles.pill, { backgroundColor: '#FEE2E2', borderColor: '#EF4444' }]}
              onPress={toutEffacer}>
              <Text style={{ color: '#EF4444', fontSize: t(11), fontWeight: '500' }}>Tout effacer</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.logoBtn, { backgroundColor: 'rgba(255,255,255,0.96)' }]}
          onPress={menuOuvert ? fermerMenu : ouvrirMenu}
        >
          <View style={styles.logoIcone}>
            <Ionicons name="location" size={11} color="#fff" />
          </View>
          <Text style={[styles.logoTexte, { fontSize: t(15) }]}>Luma</Text>
          {nbFiltresActifs > 0 && (
            <View style={styles.filtreCount}>
              <Text style={{ color: '#fff', fontSize: t(9), fontWeight: '700' }}>{nbFiltresActifs}</Text>
            </View>
          )}
          <Ionicons name={menuOuvert ? 'chevron-up' : 'chevron-down'} size={13} color="#888" />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: positionUser ? '#DBEAFE' : 'rgba(255,255,255,0.96)' }]}
            onPress={centrerUser}>
            <Ionicons name="navigate" size={18} color={positionUser ? '#2563EB' : '#888'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: 'rgba(255,255,255,0.96)' }]}
            onPress={() => navigation.navigate('Notifications')}>
            <Ionicons name="notifications-outline" size={20} color="#111" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Menu filtres */}
      {menuOuvert && (
        <Animated.View style={[styles.menu, { backgroundColor: theme.card, transform: [{ translateY: menuAnim }] }]}>
          <View style={[styles.menuHeader, { borderBottomColor: theme.border }]}>
            <Text style={[styles.menuTitre, { color: theme.text, fontSize: t(14) }]}>Filtres</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {nbFiltresActifs > 0 && (
                <TouchableOpacity onPress={toutEffacer}
                  style={[styles.effacerBtn, { backgroundColor: '#FEE2E2' }]}>
                  <Text style={{ color: '#EF4444', fontSize: t(11), fontWeight: '500' }}>Effacer</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={fermerMenu}
                style={[styles.fermerBtn, { backgroundColor: '#111' }]}>
                <Ionicons name="chevron-up" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.menuSection, { color: theme.text3, fontSize: t(10) }]}>AFFICHAGE</Text>
            {[
              { key: 'comm', label: 'Communautaires', desc: `${evenements.length} événements`, icon: 'people-outline', actif: afficherCommunautaires, toggle: () => setAfficherCommunautaires(v => !v), couleur: '#111' },
              { key: 'off', label: 'Agenda Paris', desc: `${evenementsOfficiels.length} événements`, icon: 'calendar-outline', actif: afficherOfficiels, toggle: () => setAfficherOfficiels(v => !v), couleur: '#2563EB' },
              { key: 'lieux', label: 'Lieux', desc: 'Salles, cinémas, services...', icon: 'location-outline', actif: afficherLieux, toggle: () => setAfficherLieux(v => !v), couleur: '#475569' },
            ].map(item => (
              <TouchableOpacity key={item.key}
                style={[styles.menuItem, item.actif && {
                  backgroundColor: item.couleur === '#111' ? '#111' : item.couleur === '#2563EB' ? '#EFF6FF' : '#F1F5F9',
                }]}
                onPress={item.toggle}>
                <View style={[styles.menuIcone, { backgroundColor: item.actif ? item.couleur : '#F5F5F5' }]}>
                  <Ionicons name={item.icon} size={13} color={item.actif ? '#fff' : '#888'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: item.actif && item.couleur === '#111' ? '#fff' : item.actif ? item.couleur : theme.text, fontSize: t(13), fontWeight: item.actif ? '500' : '400' }}>
                    {item.label}
                  </Text>
                  <Text style={{ color: item.actif && item.couleur === '#111' ? 'rgba(255,255,255,0.6)' : theme.text3, fontSize: t(11) }}>
                    {item.desc}
                  </Text>
                </View>
                <View style={[styles.checkbox, { backgroundColor: item.actif ? item.couleur : 'transparent', borderColor: item.actif ? item.couleur : theme.border }]}>
                  {item.actif && <Ionicons name="checkmark" size={11} color="#fff" />}
                </View>
              </TouchableOpacity>
            ))}

            {afficherLieux && (
              <>
                <View style={[styles.sep, { backgroundColor: theme.border, marginLeft: 40 }]} />
                <Text style={[styles.menuSection, { color: theme.text3, fontSize: t(10), paddingLeft: 16 }]}>
                  TYPES DE LIEUX{!zoomSuffisant ? ' · zoome pour voir' : ''}
                </Text>
                <View style={styles.catGrilleLieux}>
                  {Object.entries(LIEUX_CATEGORIES).map(([nom, config]) => {
                    const nb = compterLieuxParCategorie(nom);
                    if (nb === 0) return null;
                    const actif = lieuxCategoriesActives.includes(nom);
                    return (
                      <TouchableOpacity key={nom}
                        style={[styles.lieuCatItem, {
                          backgroundColor: actif ? config.couleur : theme.card,
                          borderColor: actif ? config.couleur : theme.border,
                        }]}
                        onPress={() => toggleLieuCategorie(nom)}>
                        <Ionicons name={config.icone} size={14} color={actif ? '#fff' : config.couleur} />
                        <Text style={{ color: actif ? '#fff' : theme.text, fontSize: t(10), fontWeight: actif ? '500' : '400', marginTop: 3, textAlign: 'center' }} numberOfLines={2}>
                          {nom}
                        </Text>
                        <Text style={{ color: actif ? 'rgba(255,255,255,0.7)' : theme.text3, fontSize: t(9) }}>({nb})</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            <View style={[styles.sep, { backgroundColor: theme.border }]} />

            <Text style={[styles.menuSection, { color: theme.text3, fontSize: t(10) }]}>DATE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, paddingHorizontal: 8, paddingBottom: 8 }}>
              {FILTRES_DATE.map(fd => {
                const actif = filtreDate === fd.key;
                return (
                  <TouchableOpacity key={fd.key}
                    style={[styles.chip, { backgroundColor: actif ? '#111' : theme.bg, borderColor: actif ? '#111' : theme.border }]}
                    onPress={() => { setFiltreDate(fd.key); if (fd.key === 'date_precise') setShowDatePicker(true); }}>
                    <Ionicons name={fd.icon} size={12} color={actif ? '#fff' : theme.text3} />
                    <Text style={{ color: actif ? '#fff' : theme.text3, fontSize: t(11), fontWeight: actif ? '500' : '400' }}>
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

            <View style={[styles.sep, { backgroundColor: theme.border }]} />

            <Text style={[styles.menuSection, { color: theme.text3, fontSize: t(10) }]}>CATÉGORIES</Text>
            <TouchableOpacity
              style={[styles.menuItem, filtresCategories.length === 0 && { backgroundColor: '#F5F5F5' }]}
              onPress={() => setFiltresCategories([])}>
              <View style={[styles.menuIcone, { backgroundColor: '#111' }]}>
                <Ionicons name="apps-outline" size={13} color="#fff" />
              </View>
              <Text style={[styles.menuLabel, { color: theme.text, fontSize: t(13) }]}>Toutes</Text>
              {filtresCategories.length === 0 && <Ionicons name="checkmark" size={15} color="#2563EB" />}
            </TouchableOpacity>
            <View style={styles.catGrille}>
              {Object.entries(CATEGORIES).map(([nom, c]) => {
                const actif = filtresCategories.includes(nom);
                return (
                  <TouchableOpacity key={nom}
                    style={[styles.catItem, {
                      backgroundColor: actif ? c.forte : theme.card,
                      borderColor: actif ? c.forte : theme.border,
                    }]}
                    onPress={() => setFiltresCategories(prev =>
                      prev.includes(nom) ? prev.filter(x => x !== nom) : [...prev, nom]
                    )}>
                    <Ionicons name={c.icone} size={16} color={actif ? '#fff' : c.forte} />
                    <Text style={{ color: actif ? '#fff' : theme.text, fontSize: t(10), fontWeight: actif ? '500' : '400', marginTop: 4, textAlign: 'center' }} numberOfLines={1}>
                      {nom}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={[styles.sep, { backgroundColor: theme.border }]} />

            <Text style={[styles.menuSection, { color: theme.text3, fontSize: t(10) }]}>RAYON</Text>
            {!positionUser && (
              <View style={[styles.avertissement, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="location-outline" size={12} color="#92400E" />
                <Text style={{ color: '#92400E', fontSize: t(11), flex: 1 }}>Active la localisation</Text>
              </View>
            )}
            <TouchableOpacity style={[styles.menuItem, !rayon && { backgroundColor: '#F5F5F5' }]}
              onPress={() => setRayon(null)}>
              <View style={[styles.menuIcone, { backgroundColor: '#F5F5F5' }]}>
                <Ionicons name="globe-outline" size={13} color="#111" />
              </View>
              <Text style={[styles.menuLabel, { color: theme.text, fontSize: t(13) }]}>Tout afficher</Text>
              {!rayon && <Ionicons name="checkmark" size={15} color="#2563EB" />}
            </TouchableOpacity>
            {RAYONS.map(r => (
              <TouchableOpacity key={r.valeur}
                style={[styles.menuItem, rayon === r.valeur && { backgroundColor: '#DBEAFE' }]}
                onPress={() => { setRayon(r.valeur); if (positionUser) chargerLieux(positionUser, Math.max(r.valeur * 2, 50000)); }}>
                <View style={[styles.menuIcone, { backgroundColor: '#DBEAFE' }]}>
                  <Ionicons name="radio-button-on-outline" size={13} color="#2563EB" />
                </View>
                <Text style={[styles.menuLabel, { color: theme.text, fontSize: t(13) }]}>{r.label}</Text>
                {rayon === r.valeur && <Ionicons name="checkmark" size={15} color="#2563EB" />}
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={[styles.fermerBas, { backgroundColor: '#111' }]} onPress={fermerMenu}>
              <Ionicons name="chevron-up" size={16} color="#fff" />
              <Text style={{ color: '#fff', fontSize: t(13), fontWeight: '500' }}>Fermer</Text>
            </TouchableOpacity>
            <View style={{ height: 8 }} />
          </ScrollView>
        </Animated.View>
      )}

      {/* Popup communautaire */}
      {pointSelectionne && catSel && (
        <Animated.View style={[styles.popup, { backgroundColor: theme.card, transform: [{ translateY: slideAnim }] }]}>
          <TouchableOpacity style={styles.popupClose} onPress={fermerToutesPopups}>
            <Ionicons name="close" size={18} color={theme.text3} />
          </TouchableOpacity>
          <Text style={[styles.popupTitre, { color: theme.text, fontSize: t(16) }]}>{pointSelectionne.titre}</Text>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <View style={[styles.tag, { backgroundColor: catSel.claire }]}>
              <Ionicons name={catSel.icone} size={11} color={catSel.forte} />
              <Text style={{ color: catSel.texte, fontSize: t(11), fontWeight: '500' }}>{pointSelectionne.categorie}</Text>
            </View>
            <View style={[styles.tag, { backgroundColor: '#111' }]}>
              <Text style={{ color: '#fff', fontSize: t(9), fontWeight: '500' }}>Communautaire</Text>
            </View>
          </View>
          {pointSelectionne.description ? (
            <Text style={{ color: theme.text2, fontSize: t(13), lineHeight: 19, marginBottom: 8 }} numberOfLines={2}>
              {pointSelectionne.description}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12, alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DCFCE7', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Ionicons name="people-outline" size={13} color="#15803D" />
              <Text style={{ color: '#15803D', fontSize: t(12) }}>
                {pointSelectionne.sans_max ? String(pointSelectionne.participants || 0) : `${pointSelectionne.participants || 0}/${pointSelectionne.max || '?'}`}
              </Text>
            </View>
            {positionUser && (
              <Text style={{ color: theme.text3, fontSize: t(11) }}>
                {Math.round(distanceKm(positionUser.latitude, positionUser.longitude, pointSelectionne.latitude, pointSelectionne.longitude) * 10) / 10} km
              </Text>
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: catSel.forte }]}
              onPress={() => { fermerToutesPopups(); navigation.navigate('DetailEvenement', { evenement: pointSelectionne }); }}>
              <Text style={{ color: '#fff', fontSize: t(13), fontWeight: '500' }}>Voir le détail</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnIcon, { backgroundColor: estFavori(pointSelectionne.id) ? '#FEF3C7' : theme.bg }]}
              onPress={() => ajouterFavori(pointSelectionne)}>
              <Ionicons name={estFavori(pointSelectionne.id) ? 'bookmark' : 'bookmark-outline'} size={17}
                color={estFavori(pointSelectionne.id) ? '#F59E0B' : theme.text} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnIcon, { backgroundColor: theme.bg }]}
              onPress={() => Share.share({ message: `Luma — ${pointSelectionne.titre}` })}>
              <Ionicons name="share-outline" size={17} color={theme.text} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* Popup officiel */}
      {officielSelectionne && configOfficiel && (
        <Animated.View style={[styles.popup, { backgroundColor: theme.card, transform: [{ translateY: slideAnimOfficiel }] }]}>
          <TouchableOpacity style={styles.popupClose} onPress={fermerToutesPopups}>
            <Ionicons name="close" size={18} color={theme.text3} />
          </TouchableOpacity>
          <Text style={[styles.popupTitre, { color: theme.text, fontSize: t(16) }]} numberOfLines={2}>
            {officielSelectionne.titre}
          </Text>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <View style={[styles.tag, { backgroundColor: configOfficiel.claire }]}>
              <Ionicons name={configOfficiel.icone} size={11} color={configOfficiel.forte} />
              <Text style={{ color: configOfficiel.texte, fontSize: t(11), fontWeight: '500' }}>{officielSelectionne.categorie}</Text>
            </View>
            {officielSelectionne.source === 'ticketmaster' && (
              <View style={[styles.tag, { backgroundColor: '#FEF3C7' }]}>
                <Text style={{ color: '#92400E', fontSize: t(9), fontWeight: '500' }}>🎟️ Ticketmaster</Text>
              </View>
            )}
            {officielSelectionne.gratuit && (
              <View style={[styles.tag, { backgroundColor: '#DCFCE7' }]}>
                <Text style={{ color: '#15803D', fontSize: t(10), fontWeight: '500' }}>Gratuit</Text>
              </View>
            )}
            {officielSelectionne.prix_min && (
              <View style={[styles.tag, { backgroundColor: '#FEF3C7' }]}>
                <Text style={{ color: '#92400E', fontSize: t(10) }}>À partir de {officielSelectionne.prix_min}€</Text>
              </View>
            )}
          </View>
          {officielSelectionne.salle && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Ionicons name="location-outline" size={13} color={configOfficiel.forte} />
              <Text style={{ color: configOfficiel.forte, fontSize: t(13), fontWeight: '500' }}>{officielSelectionne.salle}</Text>
            </View>
          )}
          {officielSelectionne.description && (
            <Text style={{ color: theme.text2, fontSize: t(13), lineHeight: 19, marginBottom: 8 }} numberOfLines={2}>
              {officielSelectionne.description}
            </Text>
          )}
          {officielSelectionne.date_debut && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Ionicons name="calendar-outline" size={13} color={configOfficiel.forte} />
              <Text style={{ color: configOfficiel.forte, fontSize: t(12), fontWeight: '500' }}>
                {formatDateParis(officielSelectionne.date_debut)}
              </Text>
            </View>
          )}
          {officielSelectionne.lieu && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Ionicons name="location-outline" size={13} color={theme.text3} />
              <Text style={{ color: theme.text2, fontSize: t(12), flex: 1 }} numberOfLines={1}>{officielSelectionne.lieu}</Text>
            </View>
          )}
          {positionUser && officielSelectionne.latitude && (
            <Text style={{ color: theme.text3, fontSize: t(11), marginBottom: 10 }}>
              {Math.round(distanceKm(positionUser.latitude, positionUser.longitude,
                parseFloat(officielSelectionne.latitude), parseFloat(officielSelectionne.longitude)) * 10) / 10} km
            </Text>
          )}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={[styles.btnPrimary, { backgroundColor: configOfficiel.forte }]}
              onPress={() => { fermerToutesPopups(); navigation.navigate('DetailEvenementOfficiel', { evenement: officielSelectionne }); }}>
              <Ionicons name="arrow-forward" size={15} color="#fff" />
              <Text style={{ color: '#fff', fontSize: t(13), fontWeight: '500' }}>Voir le détail</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnIcon, { backgroundColor: theme.bg }]}
              onPress={() => Share.share({ message: `${officielSelectionne.titre}\n${officielSelectionne.url || ''}` })}>
              <Ionicons name="share-outline" size={17} color={theme.text} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* Popup lieu */}
      {lieuSelectionne && configLieuSel && (
        <Animated.View style={[styles.popup, { backgroundColor: theme.card, transform: [{ translateY: slideAnimLieu }] }]}>
          <TouchableOpacity style={styles.popupClose} onPress={fermerToutesPopups}>
            <Ionicons name="close" size={18} color={theme.text3} />
          </TouchableOpacity>
          <Text style={[styles.popupTitre, { color: theme.text, fontSize: t(16) }]} numberOfLines={2}>
            {lieuSelectionne.nom}
          </Text>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <View style={[styles.tag, { backgroundColor: configLieuSel.bg || '#F5F5F5' }]}>
              <Ionicons name={configLieuSel.icone} size={11} color={configLieuSel.couleur} />
              <Text style={{ color: configLieuSel.couleur, fontSize: t(11), fontWeight: '500' }}>
                {lieuSelectionne.sous_categorie || lieuSelectionne.categorie}
              </Text>
            </View>
          </View>
          {lieuSelectionne.adresse && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Ionicons name="location-outline" size={13} color={theme.text3} />
              <Text style={{ color: theme.text2, fontSize: t(13), flex: 1 }}>{lieuSelectionne.adresse}</Text>
            </View>
          )}
          {positionUser && lieuSelectionne.latitude && (
            <Text style={{ color: theme.text3, fontSize: t(11), marginBottom: 10 }}>
              {Math.round(distanceKm(positionUser.latitude, positionUser.longitude,
                parseFloat(lieuSelectionne.latitude), parseFloat(lieuSelectionne.longitude)) * 10) / 10} km
            </Text>
          )}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={[styles.btnPrimary, { backgroundColor: configLieuSel.couleur }]}
              onPress={() => { fermerToutesPopups(); navigation.navigate('DetailLieu', { lieu: lieuSelectionne }); }}>
              <Ionicons name="grid-outline" size={15} color="#fff" />
              <Text style={{ color: '#fff', fontSize: t(13), fontWeight: '500' }}>
                {lieuSelectionne.sous_categorie === 'Cinéma' ? 'Voir les séances' :
                 lieuSelectionne.sous_categorie === 'Salle de concert' ? 'Voir la programmation' :
                 lieuSelectionne.sous_categorie === 'Stade' ? 'Voir le calendrier' : 'Voir la fiche'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnIcon, { backgroundColor: theme.bg }]}
              onPress={() => { fermerToutesPopups(); navigation.navigate('AjoutEvenement'); }}>
              <Ionicons name="add" size={20} color={theme.text} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('AjoutEvenement')}>
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  map: { flex: 1 },
  mRond: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#fff', borderWidth: 2.5,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15, shadowRadius: 3, elevation: 4,
  },
  mRondSmall: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#fff', borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12, shadowRadius: 2, elevation: 3,
  },
  erreurBanner: { position: 'absolute', top: 96, left: 16, right: 16, backgroundColor: '#EF4444', flexDirection: 'row', alignItems: 'center', padding: 10, paddingHorizontal: 14, gap: 8, zIndex: 5, borderRadius: 12 },
  erreurBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  filtresActifsWrap: { position: 'absolute', top: 96, left: 0, right: 0, zIndex: 4 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1.5 },
  header: { position: 'absolute', top: 52, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 },
  logoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20 },
  logoIcone: { width: 20, height: 20, borderRadius: 6, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  logoTexte: { fontWeight: '500', color: '#111' },
  filtreCount: { backgroundColor: '#EF4444', borderRadius: 10, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  menu: { position: 'absolute', top: 96, left: 16, width: 285, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 8, maxHeight: 600, zIndex: 9 },
  menuHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderBottomWidth: 0.5 },
  menuTitre: { fontWeight: '500' },
  effacerBtn: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  fermerBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  fermerBas: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, margin: 10, borderRadius: 12, padding: 10 },
  menuSection: { fontWeight: '700', letterSpacing: 0.06, padding: 8, paddingBottom: 4 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 8, borderRadius: 10, marginHorizontal: 4 },
  menuIcone: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  avertissement: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, borderRadius: 8, marginBottom: 4, marginHorizontal: 4 },
  sep: { height: 0.5, marginVertical: 6, marginHorizontal: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1 },
  catGrille: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 8 },
  catItem: { width: '30%', alignItems: 'center', justifyContent: 'center', padding: 10, borderRadius: 12, borderWidth: 1.5, minHeight: 64 },
  catGrilleLieux: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 8, paddingBottom: 8 },
  lieuCatItem: { width: '30%', alignItems: 'center', justifyContent: 'center', padding: 8, borderRadius: 10, borderWidth: 1.5, minHeight: 60 },
  popup: { position: 'absolute', bottom: 180, left: 12, right: 12, borderRadius: 20, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 8, zIndex: 10 },
  popupClose: { position: 'absolute', top: 14, right: 14, zIndex: 1 },
  popupTitre: { fontWeight: '500', marginBottom: 6, paddingRight: 24 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  btnPrimary: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  btnIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  fab: { position: 'absolute', bottom: 100, right: 16, width: 48, height: 48, backgroundColor: '#111', borderRadius: 24, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6, zIndex: 10 },
});