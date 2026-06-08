import {
  StyleSheet, View, Text, TouchableOpacity,
  Animated, Share, ScrollView,
} from 'react-native';
import MapView from 'react-native-map-clustering';
import { Marker, Circle } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useEvenements } from '../EvenementsContext';
import { useApp } from '../AppContext';
import { supabase } from '../supabase';

const RAYONS = [
  { label: '1 km',  valeur: 1000 },
  { label: '5 km',  valeur: 5000 },
  { label: '10 km', valeur: 10000 },
  { label: '20 km', valeur: 20000 },
];

const PARIS = { latitude: 48.8566, longitude: 2.3522 };
const MARQUEUR_TAILLE = 30;
const MARQUEUR_FIXE_TAILLE = 26;
const MARQUEUR_OFFICIEL_TAILLE = 24;
const MARQUEUR_SALLE_TAILLE = 26;
const MARQUEUR_LIEU_TAILLE = 20;
const ZOOM_MIN_LIEUX = 0.08;

// Couleurs spéciales par type de lieu/événement
const COULEUR_SALLE    = '#F97316'; // Orange — salles de concerts
const COULEUR_CINEMA   = '#9F1239'; // Bordeaux — cinémas
const COULEUR_THEATRE  = '#4F46E5'; // Indigo — théâtres
const COULEUR_SPORT    = '#16A34A'; // Vert foncé — compétitions sportives
const COULEUR_GAMING   = '#7C3AED'; // Violet — jeux vidéo / esport

const LIEUX_CONFIG = {
  'Santé':            { couleur: '#EF4444', icone: 'heart',      bg: '#FEE2E2' },
  'Eau potable':      { couleur: '#3B82F6', icone: 'water',      bg: '#DBEAFE' },
  'Toilettes':        { couleur: '#8B5CF6', icone: 'man',        bg: '#EDE9FE' },
  'Sport':            { couleur: '#10B981', icone: 'fitness',    bg: '#D1FAE5' },
  'Nature':           { couleur: '#22C55E', icone: 'leaf',       bg: '#DCFCE7' },
  'Culture':          { couleur: '#F59E0B', icone: 'library',    bg: '#FEF3C7' },
  'Marché':           { couleur: '#EC4899', icone: 'storefront', bg: '#FCE7F3' },
  'Mobilité':         { couleur: '#6366F1', icone: 'bicycle',    bg: '#EEF2FF' },
  'Services publics': { couleur: '#64748B', icone: 'business',   bg: '#F1F5F9' },
};

const FILTRES_DATE = [
  { key: 'tous',          label: 'Toutes dates',  icon: 'calendar-outline' },
  { key: 'ce_soir',       label: 'Ce soir',       icon: 'moon-outline' },
  { key: 'demain',        label: 'Demain',        icon: 'sunny-outline' },
  { key: 'ce_weekend',    label: 'Ce week-end',   icon: 'beer-outline' },
  { key: 'cette_semaine', label: 'Cette semaine', icon: 'calendar-number-outline' },
  { key: 'date_precise',  label: 'Date précise',  icon: 'search-outline' },
];

// Détecte le type spécial d'un événement officiel
function detecterTypeSpecial(ev) {
  const titre = (ev.titre || '').toLowerCase();
  const lieu = (ev.lieu || '').toLowerCase();
  const desc = (ev.description || '').toLowerCase();
  const cat = (ev.categorie || '').toLowerCase();
  const salle = (ev.salle || '').toLowerCase();
  const tout = titre + ' ' + lieu + ' ' + desc + ' ' + salle;

  if (ev.source === 'openagenda') return 'salle';
  if (tout.includes('gaming') || tout.includes('esport') || tout.includes('jeux vidéo') || tout.includes('jeux video') || tout.includes('game') || tout.includes('nintendo') || tout.includes('playstation')) return 'gaming';
  if (tout.includes('compétition') || tout.includes('competition') || tout.includes('match') || tout.includes('tournoi') || tout.includes('championnat') || (cat === 'sport' && (tout.includes('finale') || tout.includes('coupe')))) return 'sport_competition';
  if (lieu.includes('cinéma') || lieu.includes('cinema') || lieu.includes('ugc') || lieu.includes('mk2') || lieu.includes('pathé') || lieu.includes('pathe') || lieu.includes('gaumont') || lieu.includes('rex')) return 'cinema';
  if (lieu.includes('théâtre') || lieu.includes('theatre') || lieu.includes('comédie') || lieu.includes('comedie') || lieu.includes('odéon') || lieu.includes('odeon')) return 'theatre';
  return 'officiel';
}

const TYPE_SPECIAL_CONFIG = {
  salle:             { couleur: COULEUR_SALLE,   icone: 'musical-notes',  label: 'Salle de concert' },
  cinema:            { couleur: COULEUR_CINEMA,  icone: 'film',           label: 'Cinéma' },
  theatre:           { couleur: COULEUR_THEATRE, icone: 'comedy',         label: 'Théâtre' },
  sport_competition: { couleur: COULEUR_SPORT,   icone: 'trophy',         label: 'Compétition sportive' },
  gaming:            { couleur: COULEUR_GAMING,  icone: 'game-controller', label: 'Jeux vidéo / Esport' },
  officiel:          { couleur: '#2563EB',        icone: 'calendar-outline', label: 'Agenda Paris' },
};

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

// ── Marqueurs ────────────────────────────────────────────────────────────────

// Marqueur communautaire temporaire
const MarqueurTemporaire = ({ point, estSelectionne, onPress, CATEGORIES_COULEURS, CAT_ICONES }) => {
  const cat = CATEGORIES_COULEURS[point.categorie] || { forte: '#888' };
  const taille = estSelectionne ? MARQUEUR_TAILLE * 1.35 : MARQUEUR_TAILLE;
  return (
    <Marker
      coordinate={{ latitude: point.latitude, longitude: point.longitude }}
      onPress={(e) => { e.stopPropagation(); onPress(); }}
      tracksViewChanges={estSelectionne}
      calloutEnabled={false}
      identifier={`ev_${point.id}`}
      anchor={{ x: 0.5, y: 1 }}
      zIndex={estSelectionne ? 999 : 1}
    >
      <View pointerEvents="none" style={{ alignItems: 'center' }}>
        {estSelectionne && (
          <View style={{
            position: 'absolute', top: -6, width: taille + 12, height: taille + 12,
            borderRadius: (taille + 12) / 2,
            backgroundColor: cat.forte + '30',
            zIndex: 0,
          }} />
        )}
        <View style={{
          width: taille, height: taille,
          borderRadius: taille / 2,
          backgroundColor: cat.forte,
          alignItems: 'center', justifyContent: 'center',
          shadowColor: '#000', shadowOffset: { width: 0, height: estSelectionne ? 4 : 2 },
          shadowOpacity: estSelectionne ? 0.4 : 0.25, shadowRadius: estSelectionne ? 6 : 3,
          elevation: estSelectionne ? 8 : 4,
          borderWidth: estSelectionne ? 3 : 0,
          borderColor: estSelectionne ? '#fff' : 'transparent',
        }}>
          <Ionicons name={CAT_ICONES[point.categorie] || 'construct-outline'} size={estSelectionne ? 17 : 14} color="#fff" />
        </View>
        <View style={{
          width: 0, height: 0,
          borderLeftWidth: estSelectionne ? 5 : 4, borderRightWidth: estSelectionne ? 5 : 4,
          borderTopWidth: estSelectionne ? 8 : 6,
          borderLeftColor: 'transparent', borderRightColor: 'transparent',
          borderTopColor: cat.forte,
        }} />
      </View>
    </Marker>
  );
};

// Marqueur lieu fixe communautaire
const MarqueurFixe = ({ point, estSelectionne, onPress, CATEGORIES_COULEURS, CAT_ICONES }) => {
  const cat = CATEGORIES_COULEURS[point.categorie] || { forte: '#888' };
  const taille = estSelectionne ? MARQUEUR_FIXE_TAILLE * 1.3 : MARQUEUR_FIXE_TAILLE;
  return (
    <Marker
      coordinate={{ latitude: point.latitude, longitude: point.longitude }}
      onPress={(e) => { e.stopPropagation(); onPress(); }}
      tracksViewChanges={estSelectionne}
      calloutEnabled={false}
      identifier={`ev_${point.id}`}
      anchor={{ x: 0.5, y: 0.5 }}
      zIndex={estSelectionne ? 999 : 1}
    >
      <View pointerEvents="none" style={{ width: taille + 8, height: taille + 8, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{
          width: taille, height: taille,
          borderRadius: 8, backgroundColor: cat.forte,
          alignItems: 'center', justifyContent: 'center',
          borderWidth: estSelectionne ? 3 : 2, borderColor: '#fff',
          shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
          shadowOpacity: estSelectionne ? 0.4 : 0.25, shadowRadius: estSelectionne ? 6 : 3,
          elevation: estSelectionne ? 8 : 4,
        }}>
          <Ionicons name={CAT_ICONES[point.categorie] || 'construct-outline'} size={estSelectionne ? 14 : 12} color="#fff" />
        </View>
        <View style={{
          position: 'absolute', bottom: 0, right: 0,
          width: 12, height: 12, borderRadius: 6,
          backgroundColor: cat.forte,
          alignItems: 'center', justifyContent: 'center',
          borderWidth: 1.5, borderColor: '#fff',
        }}>
          <Ionicons name="location" size={6} color="#fff" />
        </View>
      </View>
    </Marker>
  );
};

// Marqueur événement officiel — type spécial détecté automatiquement
const MarqueurOfficiel = ({ ev, estSelectionne, onPress, CATEGORIES_COULEURS, CAT_ICONES }) => {
  const typeSpecial = detecterTypeSpecial(ev);
  const config = TYPE_SPECIAL_CONFIG[typeSpecial];
  const estTypeSpecial = typeSpecial !== 'officiel';

  const taille = estSelectionne
    ? (estTypeSpecial ? MARQUEUR_SALLE_TAILLE : MARQUEUR_OFFICIEL_TAILLE) * 1.35
    : (estTypeSpecial ? MARQUEUR_SALLE_TAILLE : MARQUEUR_OFFICIEL_TAILLE);

  const couleur = estTypeSpecial ? config.couleur : (CATEGORIES_COULEURS[ev.categorie]?.forte || '#2563EB');

  return (
    <Marker
      coordinate={{ latitude: parseFloat(ev.latitude), longitude: parseFloat(ev.longitude) }}
      onPress={(e) => { e.stopPropagation(); onPress(); }}
      tracksViewChanges={estSelectionne}
      calloutEnabled={false}
      identifier={`off_${ev.id}`}
      anchor={{ x: 0.5, y: 1 }}
      zIndex={estSelectionne ? 999 : estTypeSpecial ? 3 : 2}
    >
      <View pointerEvents="none" style={{ alignItems: 'center' }}>
        {estSelectionne && (
          <View style={{
            position: 'absolute', top: -6, width: taille + 12, height: taille + 12,
            borderRadius: (taille + 12) / 2,
            backgroundColor: couleur + '30',
          }} />
        )}
        <View style={{
          width: taille, height: taille,
          borderRadius: taille / 2,
          // Type spécial = fond coloré plein, officiel = fond blanc + bordure
          backgroundColor: estTypeSpecial ? couleur : '#fff',
          alignItems: 'center', justifyContent: 'center',
          borderWidth: estTypeSpecial ? (estSelectionne ? 3 : 2) : (estSelectionne ? 3 : 2.5),
          borderColor: estSelectionne ? '#fff' : (estTypeSpecial ? '#fff' : couleur),
          shadowColor: '#000', shadowOffset: { width: 0, height: estSelectionne ? 4 : 1 },
          shadowOpacity: estSelectionne ? 0.4 : 0.2, shadowRadius: estSelectionne ? 6 : 2,
          elevation: estSelectionne ? 8 : estTypeSpecial ? 4 : 3,
        }}>
          <Ionicons
            name={config.icone}
            size={estSelectionne ? 15 : (estTypeSpecial ? 13 : 11)}
            color={estTypeSpecial ? '#fff' : couleur}
          />
        </View>
        <View style={{
          width: 0, height: 0,
          borderLeftWidth: estSelectionne ? 5 : (estTypeSpecial ? 4 : 3),
          borderRightWidth: estSelectionne ? 5 : (estTypeSpecial ? 4 : 3),
          borderTopWidth: estSelectionne ? 8 : (estTypeSpecial ? 6 : 5),
          borderLeftColor: 'transparent', borderRightColor: 'transparent',
          borderTopColor: couleur,
        }} />
      </View>
    </Marker>
  );
};

// Marqueur lieu officiel
const MarqueurLieu = ({ lieu, estSelectionne, onPress }) => {
  const config = LIEUX_CONFIG[lieu.categorie] || { couleur: '#6B7280', icone: 'information-circle' };
  const taille = estSelectionne ? MARQUEUR_LIEU_TAILLE * 1.4 : MARQUEUR_LIEU_TAILLE;
  return (
    <Marker
      coordinate={{ latitude: parseFloat(lieu.latitude), longitude: parseFloat(lieu.longitude) }}
      onPress={(e) => { e.stopPropagation(); onPress(); }}
      tracksViewChanges={estSelectionne}
      calloutEnabled={false}
      identifier={`lieu_${lieu.id}`}
      anchor={{ x: 0.5, y: 0.5 }}
      zIndex={estSelectionne ? 999 : 1}
    >
      <View pointerEvents="none" style={{ width: taille + 4, height: taille + 4, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{
          width: taille, height: taille,
          borderRadius: taille / 2,
          backgroundColor: config.couleur,
          alignItems: 'center', justifyContent: 'center',
          borderWidth: estSelectionne ? 2.5 : 1.5, borderColor: '#fff',
          elevation: estSelectionne ? 5 : 2,
        }}>
          <Ionicons name={config.icone} size={estSelectionne ? 12 : 9} color="#fff" />
        </View>
      </View>
    </Marker>
  );
};

// ── Écran ─────────────────────────────────────────────────────────────────────

export default function CarteScreen({ navigation }) {
  const { evenements, erreurReseau, chargerEvenements } = useEvenements();
  const {
    theme, facteurTexte, CATEGORIES_COULEURS, CAT_ICONES,
    rayonDefaut, ajouterFavori, estFavori,
    evenementCible, setEvenementCible,
  } = useApp();

  const [pointSelectionne, setPointSelectionne] = useState(null);
  const [evenementOfficielSelectionne, setEvenementOfficielSelectionne] = useState(null);
  const [lieuSelectionne, setLieuSelectionne] = useState(null);
  const [idSelectionne, setIdSelectionne] = useState(null); // Pour surbrillance
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [afficherCommunautaires, setAfficherCommunautaires] = useState(true);
  const [afficherOfficiels, setAfficherOfficiels] = useState(true);
  const [afficherLieux, setAfficherLieux] = useState(true);
  const [filtresCategories, setFiltresCategories] = useState([]);
  const [filtresCategoriesLieux, setFiltresCategoriesLieux] = useState([]);
  const [filtreDate, setFiltreDate] = useState('tous');
  const [datePrecise, setDatePrecise] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [rayon, setRayon] = useState(rayonDefaut);
  const [positionUser, setPositionUser] = useState(null);
  const [lieuxOfficiels, setLieuxOfficiels] = useState([]);
  const [evenementsOfficiels, setEvenementsOfficiels] = useState([]);
  const [regionActuelle, setRegionActuelle] = useState({ ...PARIS, latitudeDelta: 0.08, longitudeDelta: 0.08 });
  const [pret, setPret] = useState(false);
  const [zoomSuffisant, setZoomSuffisant] = useState(true);

  const slideAnim = useRef(new Animated.Value(300)).current;
  const slideAnimOfficiel = useRef(new Animated.Value(300)).current;
  const slideAnimLieu = useRef(new Animated.Value(300)).current;
  const menuAnim = useRef(new Animated.Value(-260)).current;
  const mapRef = useRef(null);
  const t = (size) => size * facteurTexte;

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const pos = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setPositionUser(pos);
        setRegionActuelle({ ...pos, latitudeDelta: 0.04, longitudeDelta: 0.04 });
        chargerLieux(pos, rayonDefaut || 5000);
        chargerEvenementsOfficiels(pos, rayonDefaut || 5000);
      } else {
        chargerLieux(PARIS, 5000);
        chargerEvenementsOfficiels(PARIS, 5000);
      }
      setPret(true);
    })();
  }, []);

  const chargerLieux = async (pos, rayonM) => {
    try {
      const { data } = await supabase.rpc('lieux_dans_rayon', {
        lat: pos.latitude, lng: pos.longitude, rayon_metres: rayonM || 5000,
      });
      if (data) setLieuxOfficiels(data);
    } catch {}
  };

  const chargerEvenementsOfficiels = async (pos, rayonM) => {
    try {
      const { data } = await supabase
        .from('evenements_officiels')
        .select('*')
        .eq('actif', true)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .gte('date_debut', new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString())
        .order('date_debut', { ascending: true })
        .limit(500);
      if (data) {
        const centre = pos || PARIS;
        const filtres = rayonM ? data.filter(ev =>
          distanceKm(centre.latitude, centre.longitude,
            parseFloat(ev.latitude), parseFloat(ev.longitude)) * 1000 <= rayonM
        ) : data;
        setEvenementsOfficiels(filtres);
      }
    } catch {}
  };

  useFocusEffect(
    useCallback(() => {
      if (!evenementCible || !pret) return;
      const ev = evenementCible;
      setEvenementCible(null);
      const region = { latitude: ev.latitude, longitude: ev.longitude, latitudeDelta: 0.008, longitudeDelta: 0.008 };
      setTimeout(() => {
        if (mapRef.current) mapRef.current.animateToRegion(region, 600);
        setTimeout(() => ouvrirPopupEvenement(ev), 700);
      }, 200);
    }, [evenementCible, pret])
  );

  const centrerUser = () => {
    if (!positionUser || !mapRef.current) return;
    mapRef.current.animateToRegion({ ...positionUser, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 600);
  };

  const fermerToutesPopups = () => {
    setIdSelectionne(null);
    Animated.timing(slideAnim, { toValue: 300, useNativeDriver: true, duration: 180 }).start(() => setPointSelectionne(null));
    Animated.timing(slideAnimOfficiel, { toValue: 300, useNativeDriver: true, duration: 180 }).start(() => setEvenementOfficielSelectionne(null));
    Animated.timing(slideAnimLieu, { toValue: 300, useNativeDriver: true, duration: 180 }).start(() => setLieuSelectionne(null));
  };

  const ouvrirPopupEvenement = (point) => {
    fermerToutesPopups();
    setIdSelectionne(`ev_${point.id}`);
    slideAnim.setValue(300);
    setTimeout(() => {
      setPointSelectionne(point);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
    }, 200);
  };

  const ouvrirPopupOfficiel = (ev) => {
    fermerToutesPopups();
    setIdSelectionne(`off_${ev.id}`);
    slideAnimOfficiel.setValue(300);
    setTimeout(() => {
      setEvenementOfficielSelectionne(ev);
      Animated.spring(slideAnimOfficiel, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
    }, 200);
  };

  const ouvrirPopupLieu = (lieu) => {
    fermerToutesPopups();
    setIdSelectionne(`lieu_${lieu.id}`);
    slideAnimLieu.setValue(300);
    setTimeout(() => {
      setLieuSelectionne(lieu);
      Animated.spring(slideAnimLieu, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
    }, 200);
  };

  const ouvrirMenu = () => {
    setMenuOuvert(true);
    Animated.spring(menuAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
  };

  const fermerMenu = () => {
    Animated.timing(menuAnim, { toValue: -260, useNativeDriver: true, duration: 250 }).start(() => setMenuOuvert(false));
  };

  const toutEffacer = () => {
    setFiltresCategories([]);
    setFiltresCategoriesLieux([]);
    setAfficherCommunautaires(true);
    setAfficherOfficiels(true);
    setAfficherLieux(true);
    setFiltreDate('tous');
  };

  const plageDate = getPlageDates(filtreDate, datePrecise);
  const centre = positionUser || PARIS;
  const rayonActif = rayon || rayonDefaut;

  const evenementsFiltres = afficherCommunautaires ? evenements.filter(p => {
    const matchCat = filtresCategories.length === 0 || filtresCategories.includes(p.categorie);
    const matchRayon = !rayonActif || distanceKm(centre.latitude, centre.longitude, p.latitude, p.longitude) * 1000 <= rayonActif;
    let matchDate = true;
    if (plageDate && p.type !== 'fixe') {
      if (!p.date_evenement) matchDate = false;
      else { const d = new Date(p.date_evenement); matchDate = d >= plageDate.debut && d <= plageDate.fin; }
    }
    return matchCat && matchRayon && matchDate;
  }) : [];

  const evenementsOfficielsFiltres = afficherOfficiels ? evenementsOfficiels.filter(ev => {
    const matchCat = filtresCategories.length === 0 || filtresCategories.includes(ev.categorie);
    let matchDate = true;
    if (plageDate) {
      if (!ev.date_debut) matchDate = false;
      else { const d = new Date(ev.date_debut); matchDate = d >= plageDate.debut && d <= plageDate.fin; }
    }
    return matchCat && matchDate;
  }) : [];

  const lieuxFiltres = (afficherLieux && zoomSuffisant) ? lieuxOfficiels.filter(l =>
    filtresCategoriesLieux.length === 0 || filtresCategoriesLieux.includes(l.categorie)
  ) : [];

  const nbFiltresActifs =
    filtresCategories.length + filtresCategoriesLieux.length +
    (!afficherCommunautaires ? 1 : 0) + (!afficherOfficiels ? 1 : 0) +
    (!afficherLieux ? 1 : 0) + (filtreDate !== 'tous' ? 1 : 0);

  const labelDateActif = filtreDate !== 'tous'
    ? (filtreDate === 'date_precise'
        ? datePrecise.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
        : FILTRES_DATE.find(f => f.key === filtreDate)?.label)
    : null;

  const catSelectionne = pointSelectionne ? (CATEGORIES_COULEURS[pointSelectionne.categorie] || { claire: '#F5F5F5', forte: '#888', texte: '#444' }) : null;
  const typeSpecialSelectionne = evenementOfficielSelectionne ? detecterTypeSpecial(evenementOfficielSelectionne) : null;
  const configTypeSelectionne = typeSpecialSelectionne ? TYPE_SPECIAL_CONFIG[typeSpecialSelectionne] : null;
  const catOfficielle = evenementOfficielSelectionne ? (CATEGORIES_COULEURS[evenementOfficielSelectionne.categorie] || { claire: '#DBEAFE', forte: '#2563EB', texte: '#1E40AF' }) : null;
  const couleurPopupOfficielle = typeSpecialSelectionne && typeSpecialSelectionne !== 'officiel'
    ? configTypeSelectionne.couleur
    : catOfficielle?.forte || '#2563EB';
  const configLieu = lieuSelectionne ? (LIEUX_CONFIG[lieuSelectionne.categorie] || { couleur: '#6B7280', icone: 'information-circle', bg: '#F3F4F6' }) : null;

  if (!pret) {
    return (
      <View style={[styles.container, { backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' }]}>
        <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Ionicons name="location" size={26} color="#fff" />
        </View>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '500' }}>Luma</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>

      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={regionActuelle}
        showsPointsOfInterest={false}
        showsUserLocation
        showsMyLocationButton={false}
        userInterfaceStyle={theme.bg === '#0A0A0A' ? 'dark' : 'light'}
        clusterColor="#111"
        clusterTextColor="#fff"
        clusterFontFamily="System"
        clusteringEnabled
        radius={40}
        extent={512}
        minZoom={1}
        maxZoom={20}
        minPoints={3}
        animationEnabled
        onPress={() => { if (menuOuvert) fermerMenu(); fermerToutesPopups(); }}
        onRegionChangeComplete={(region) => {
          setRegionActuelle(region);
          setZoomSuffisant(region.latitudeDelta < ZOOM_MIN_LIEUX);
        }}
      >
        {rayonActif && (
          <Circle
            center={centre}
            radius={rayonActif}
            fillColor="rgba(37,99,235,0.06)"
            strokeColor="rgba(37,99,235,0.25)"
            strokeWidth={1}
          />
        )}

        {lieuxFiltres.map(lieu => (
          <MarqueurLieu
            key={`lieu_${lieu.id}`}
            lieu={lieu}
            estSelectionne={idSelectionne === `lieu_${lieu.id}`}
            onPress={() => ouvrirPopupLieu(lieu)}
          />
        ))}

        {evenementsOfficielsFiltres.map(ev => (
          <MarqueurOfficiel
            key={`off_${ev.id}`}
            ev={ev}
            estSelectionne={idSelectionne === `off_${ev.id}`}
            CATEGORIES_COULEURS={CATEGORIES_COULEURS}
            CAT_ICONES={CAT_ICONES}
            onPress={() => ouvrirPopupOfficiel(ev)}
          />
        ))}

        {evenementsFiltres.map(p =>
          p.type === 'fixe' ? (
            <MarqueurFixe
              key={`ev_${p.id}`}
              point={p}
              estSelectionne={idSelectionne === `ev_${p.id}`}
              CATEGORIES_COULEURS={CATEGORIES_COULEURS}
              CAT_ICONES={CAT_ICONES}
              onPress={() => ouvrirPopupEvenement(p)}
            />
          ) : (
            <MarqueurTemporaire
              key={`ev_${p.id}`}
              point={p}
              estSelectionne={idSelectionne === `ev_${p.id}`}
              CATEGORIES_COULEURS={CATEGORIES_COULEURS}
              CAT_ICONES={CAT_ICONES}
              onPress={() => ouvrirPopupEvenement(p)}
            />
          )
        )}
      </MapView>

      {erreurReseau && (
        <View style={styles.erreurBanner}>
          <Ionicons name="wifi-outline" size={16} color="#fff" />
          <Text style={styles.erreurTexte}>Pas de connexion</Text>
          <TouchableOpacity onPress={chargerEvenements} style={styles.reessayerBtn}>
            <Text style={styles.reessayerTexte}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      )}

      {nbFiltresActifs > 0 && (
        <View style={styles.filtresActifsWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}>
            {labelDateActif && (
              <TouchableOpacity style={[styles.filtreActifBadge, { backgroundColor: '#111', borderColor: '#333' }]}
                onPress={() => setFiltreDate('tous')}>
                <Ionicons name="calendar-outline" size={11} color="#fff" />
                <Text style={{ color: '#fff', fontSize: t(11), fontWeight: '500' }}>{labelDateActif}</Text>
                <Ionicons name="close" size={11} color="#fff" />
              </TouchableOpacity>
            )}
            {filtresCategories.map(cat => {
              const c = CATEGORIES_COULEURS[cat] || { claire: '#F5F5F5', forte: '#888', texte: '#444' };
              return (
                <TouchableOpacity key={cat}
                  style={[styles.filtreActifBadge, { backgroundColor: c.claire, borderColor: c.forte }]}
                  onPress={() => setFiltresCategories(prev => prev.filter(x => x !== cat))}>
                  <Ionicons name={CAT_ICONES[cat] || 'apps-outline'} size={11} color={c.forte} />
                  <Text style={{ color: c.texte, fontSize: t(11), fontWeight: '500' }}>{cat}</Text>
                  <Ionicons name="close" size={11} color={c.forte} />
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={[styles.filtreActifBadge, { backgroundColor: '#FEE2E2', borderColor: '#EF4444' }]}
              onPress={toutEffacer}>
              <Text style={{ color: '#EF4444', fontSize: t(11), fontWeight: '500' }}>Tout effacer</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.logoBtn, { backgroundColor: 'rgba(255,255,255,0.96)' }]}
          onPress={menuOuvert ? fermerMenu : ouvrirMenu}
        >
          <View style={styles.logoIcone}>
            <Ionicons name="location" size={11} color="#fff" />
          </View>
          <Text style={[styles.logo, { fontSize: t(15) }]}>Luma</Text>
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
            onPress={centrerUser}
          >
            <Ionicons name="navigate" size={18} color={positionUser ? '#2563EB' : '#888'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: 'rgba(255,255,255,0.96)' }]}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Ionicons name="notifications-outline" size={20} color="#111" />
          </TouchableOpacity>
        </View>
      </View>

      {menuOuvert && (
        <Animated.View style={[styles.menu, { backgroundColor: theme.card, transform: [{ translateY: menuAnim }] }]}>
          <View style={[styles.menuHeaderRow, { borderBottomColor: theme.border }]}>
            <Text style={[styles.menuTitreTexte, { color: theme.text, fontSize: t(14) }]}>Filtres</Text>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              {nbFiltresActifs > 0 && (
                <TouchableOpacity onPress={toutEffacer} style={[styles.effacerBtn, { backgroundColor: '#FEE2E2' }]}>
                  <Text style={{ color: '#EF4444', fontSize: t(11), fontWeight: '500' }}>Effacer</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={fermerMenu} style={[styles.fermerBtn, { backgroundColor: '#111' }]}>
                <Ionicons name="chevron-up" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.menuSection, { color: theme.text3, fontSize: t(10) }]}>DATE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, paddingHorizontal: 8, paddingBottom: 8 }}>
              {FILTRES_DATE.map(fd => {
                const actif = filtreDate === fd.key;
                return (
                  <TouchableOpacity
                    key={fd.key}
                    style={[styles.dateChip, { backgroundColor: actif ? '#111' : theme.bg, borderColor: actif ? '#111' : theme.border }]}
                    onPress={() => { setFiltreDate(fd.key); if (fd.key === 'date_precise') setShowDatePicker(true); }}
                  >
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
            <Text style={[styles.menuSection, { color: theme.text3, fontSize: t(10) }]}>AFFICHAGE</Text>

            {[
              { key: 'communautaires', label: 'Événements communautaires', desc: 'Créés par les utilisateurs', icon: 'people-outline', actif: afficherCommunautaires, toggle: () => setAfficherCommunautaires(v => !v), bg: '#111' },
              { key: 'officiels', label: 'Agenda Paris + Salles', desc: `${evenementsOfficiels.length} événements`, icon: 'calendar-outline', actif: afficherOfficiels, toggle: () => setAfficherOfficiels(v => !v), bg: '#2563EB' },
              { key: 'lieux', label: 'Lieux officiels', desc: `${lieuxOfficiels.length} lieux · ${zoomSuffisant ? 'visibles' : 'zoome pour voir'}`, icon: 'location-outline', actif: afficherLieux, toggle: () => setAfficherLieux(v => !v), bg: '#475569' },
            ].map(item => (
              <TouchableOpacity
                key={item.key}
                style={[styles.menuItem, item.actif && {
                  backgroundColor: item.bg === '#111' ? '#111' : item.bg === '#2563EB' ? '#EFF6FF' : '#F1F5F9',
                }]}
                onPress={item.toggle}
              >
                <View style={[styles.menuIcone, { backgroundColor: item.actif ? item.bg : '#F5F5F5' }]}>
                  <Ionicons name={item.icon} size={13} color={item.actif ? '#fff' : '#888'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: item.actif && item.bg === '#111' ? '#fff' : item.actif ? item.bg : theme.text, fontSize: t(13), fontWeight: item.actif ? '500' : '400' }}>
                    {item.label}
                  </Text>
                  <Text style={{ color: item.actif && item.bg === '#111' ? 'rgba(255,255,255,0.6)' : theme.text3, fontSize: t(11) }}>
                    {item.desc}
                  </Text>
                </View>
                <View style={[styles.typeCheckbox, {
                  backgroundColor: item.actif ? item.bg : 'transparent',
                  borderColor: item.actif ? item.bg : theme.border,
                }]}>
                  {item.actif && <Ionicons name="checkmark" size={11} color="#fff" />}
                </View>
              </TouchableOpacity>
            ))}

            {afficherLieux && (
              <>
                <View style={[styles.sep, { backgroundColor: theme.border, marginLeft: 40 }]} />
                {Object.entries(LIEUX_CONFIG).map(([cat, config]) => {
                  const nb = lieuxOfficiels.filter(l => l.categorie === cat).length;
                  if (nb === 0) return null;
                  const actif = filtresCategoriesLieux.length === 0 || filtresCategoriesLieux.includes(cat);
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.menuItem, { paddingLeft: 24 }, actif && { backgroundColor: config.bg }]}
                      onPress={() => setFiltresCategoriesLieux(prev =>
                        prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
                      )}
                    >
                      <View style={[styles.menuIcone, { backgroundColor: actif ? config.couleur : '#F5F5F5', width: 22, height: 22, borderRadius: 6 }]}>
                        <Ionicons name={config.icone} size={10} color={actif ? '#fff' : '#888'} />
                      </View>
                      <Text style={{ color: theme.text, fontSize: t(12), flex: 1 }}>
                        {cat} <Text style={{ color: theme.text3 }}>({nb})</Text>
                      </Text>
                      {filtresCategoriesLieux.includes(cat) && (
                        <View style={[styles.checkBox, { backgroundColor: config.couleur }]}>
                          <Ionicons name="checkmark" size={9} color="#fff" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            <View style={[styles.sep, { backgroundColor: theme.border }]} />
            <Text style={[styles.menuSection, { color: theme.text3, fontSize: t(10) }]}>CATÉGORIES</Text>

            <TouchableOpacity
              style={[styles.menuItem, filtresCategories.length === 0 && { backgroundColor: '#F5F5F5' }]}
              onPress={() => setFiltresCategories([])}
            >
              <View style={[styles.menuIcone, { backgroundColor: '#111' }]}>
                <Ionicons name="apps-outline" size={13} color="#fff" />
              </View>
              <Text style={[styles.menuLabel, { color: theme.text, fontSize: t(13) }]}>Toutes</Text>
              {filtresCategories.length === 0 && <Ionicons name="checkmark" size={15} color="#2563EB" />}
            </TouchableOpacity>

            {Object.entries(CATEGORIES_COULEURS).map(([nom, c]) => {
              const actif = filtresCategories.includes(nom);
              return (
                <TouchableOpacity
                  key={nom}
                  style={[styles.menuItem, actif && { backgroundColor: c.claire }]}
                  onPress={() => setFiltresCategories(prev =>
                    prev.includes(nom) ? prev.filter(x => x !== nom) : [...prev, nom]
                  )}
                >
                  <View style={[styles.menuIcone, { backgroundColor: actif ? c.forte : c.claire }]}>
                    <Ionicons name={CAT_ICONES[nom] || 'construct-outline'} size={13} color={actif ? '#fff' : c.forte} />
                  </View>
                  <Text style={[styles.menuLabel, { color: actif ? c.texte : theme.text, fontSize: t(13), fontWeight: actif ? '500' : '400' }]}>
                    {nom}
                  </Text>
                  {actif && (
                    <View style={[styles.checkBox, { backgroundColor: c.forte }]}>
                      <Ionicons name="checkmark" size={10} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}

            <View style={[styles.sep, { backgroundColor: theme.border }]} />
            <Text style={[styles.menuSection, { color: theme.text3, fontSize: t(10) }]}>RAYON</Text>

            {!positionUser && (
              <View style={[styles.menuAvertissement, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="location-outline" size={12} color="#92400E" />
                <Text style={{ color: '#92400E', fontSize: t(11), flex: 1 }}>Active la localisation</Text>
              </View>
            )}

            <TouchableOpacity style={[styles.menuItem, !rayon && { backgroundColor: '#F5F5F5' }]} onPress={() => setRayon(null)}>
              <View style={[styles.menuIcone, { backgroundColor: '#F5F5F5' }]}>
                <Ionicons name="globe-outline" size={13} color="#111" />
              </View>
              <Text style={[styles.menuLabel, { color: theme.text, fontSize: t(13) }]}>Tout afficher</Text>
              {!rayon && <Ionicons name="checkmark" size={15} color="#2563EB" />}
            </TouchableOpacity>

            {RAYONS.map(r => (
              <TouchableOpacity
                key={r.valeur}
                style={[styles.menuItem, rayon === r.valeur && { backgroundColor: '#DBEAFE' }]}
                onPress={() => { setRayon(r.valeur); if (positionUser) { chargerLieux(positionUser, r.valeur); chargerEvenementsOfficiels(positionUser, r.valeur); } }}
              >
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
      {pointSelectionne && (
        <Animated.View style={[styles.popup, { backgroundColor: theme.card, transform: [{ translateY: slideAnim }] }]}>
          <TouchableOpacity style={styles.popupClose} onPress={fermerToutesPopups}>
            <Ionicons name="close" size={18} color={theme.text3} />
          </TouchableOpacity>
          <Text style={[styles.popupTitre, { color: theme.text, fontSize: t(16), marginBottom: 6, paddingRight: 24 }]}>
            {pointSelectionne.titre}
          </Text>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <View style={[styles.catBadge, { backgroundColor: catSelectionne.claire }]}>
              <Ionicons name={CAT_ICONES[pointSelectionne.categorie] || 'construct-outline'} size={11} color={catSelectionne.forte} />
              <Text style={{ color: catSelectionne.texte, fontSize: t(11), fontWeight: '500' }}>{pointSelectionne.categorie}</Text>
            </View>
            <View style={[styles.catBadge, { backgroundColor: pointSelectionne.type === 'fixe' ? '#DCFCE7' : '#F5F5F5' }]}>
              <Ionicons name={pointSelectionne.type === 'fixe' ? 'location-outline' : 'timer-outline'} size={10}
                color={pointSelectionne.type === 'fixe' ? '#22C55E' : '#888'} />
              <Text style={{ color: pointSelectionne.type === 'fixe' ? '#15803D' : '#555', fontSize: t(10) }}>
                {pointSelectionne.type === 'fixe' ? 'Lieu fixe' : 'Temporaire'}
              </Text>
            </View>
            <View style={[styles.catBadge, { backgroundColor: '#111' }]}>
              <Text style={{ color: '#fff', fontSize: t(9), fontWeight: '500' }}>Communautaire</Text>
            </View>
          </View>
          {pointSelectionne.description ? (
            <Text style={{ color: theme.text2, fontSize: t(13), lineHeight: 19, marginBottom: 8 }} numberOfLines={2}>
              {pointSelectionne.description}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12, alignItems: 'center' }}>
            {pointSelectionne.duree ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="time-outline" size={13} color={theme.text3} />
                <Text style={{ color: theme.text3, fontSize: t(12) }}>{pointSelectionne.duree}</Text>
              </View>
            ) : null}
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
            <TouchableOpacity
              style={[styles.btnPrincipal, { backgroundColor: catSelectionne.forte }]}
              onPress={() => { fermerToutesPopups(); navigation.navigate('DetailEvenement', { evenement: pointSelectionne }); }}
            >
              <Text style={{ color: '#fff', fontSize: t(13), fontWeight: '500' }}>Voir le détail</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnSecondaire, { backgroundColor: estFavori(pointSelectionne.id) ? '#FEF3C7' : theme.bg }]}
              onPress={() => ajouterFavori(pointSelectionne)}
            >
              <Ionicons name={estFavori(pointSelectionne.id) ? 'bookmark' : 'bookmark-outline'} size={17}
                color={estFavori(pointSelectionne.id) ? '#F59E0B' : theme.text} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnSecondaire, { backgroundColor: theme.bg }]}
              onPress={() => Share.share({ message: `Luma — ${pointSelectionne.titre}` })}>
              <Ionicons name="share-outline" size={17} color={theme.text} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* Popup officiel */}
      {evenementOfficielSelectionne && (
        <Animated.View style={[styles.popup, { backgroundColor: theme.card, transform: [{ translateY: slideAnimOfficiel }] }]}>
          <TouchableOpacity style={styles.popupClose} onPress={fermerToutesPopups}>
            <Ionicons name="close" size={18} color={theme.text3} />
          </TouchableOpacity>
          <Text style={[styles.popupTitre, { color: theme.text, fontSize: t(16), marginBottom: 6, paddingRight: 24 }]} numberOfLines={2}>
            {evenementOfficielSelectionne.titre}
          </Text>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <View style={[styles.catBadge, { backgroundColor: catOfficielle.claire }]}>
              <Ionicons name={CAT_ICONES[evenementOfficielSelectionne.categorie] || 'calendar-outline'} size={11} color={catOfficielle.forte} />
              <Text style={{ color: catOfficielle.forte, fontSize: t(11), fontWeight: '500' }}>{evenementOfficielSelectionne.categorie}</Text>
            </View>
            <View style={[styles.catBadge, { backgroundColor: couleurPopupOfficielle + '20' }]}>
              <Ionicons name={configTypeSelectionne?.icone || 'shield-checkmark-outline'} size={9} color={couleurPopupOfficielle} />
              <Text style={{ color: couleurPopupOfficielle, fontSize: t(10), fontWeight: '500' }}>
                {configTypeSelectionne?.label || 'Officiel'}
              </Text>
            </View>
            {evenementOfficielSelectionne.gratuit && (
              <View style={[styles.catBadge, { backgroundColor: '#DCFCE7' }]}>
                <Text style={{ color: '#15803D', fontSize: t(10), fontWeight: '500' }}>Gratuit</Text>
              </View>
            )}
          </View>
          {evenementOfficielSelectionne.salle && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Ionicons name="musical-notes" size={13} color={couleurPopupOfficielle} />
              <Text style={{ color: couleurPopupOfficielle, fontSize: t(13), fontWeight: '500' }}>{evenementOfficielSelectionne.salle}</Text>
            </View>
          )}
          {evenementOfficielSelectionne.description && (
            <Text style={{ color: theme.text2, fontSize: t(13), lineHeight: 19, marginBottom: 8 }} numberOfLines={2}>
              {evenementOfficielSelectionne.description}
            </Text>
          )}
          {evenementOfficielSelectionne.date_debut && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Ionicons name="calendar-outline" size={13} color={couleurPopupOfficielle} />
              <Text style={{ color: couleurPopupOfficielle, fontSize: t(12), fontWeight: '500' }}>
                {new Date(evenementOfficielSelectionne.date_debut).toLocaleDateString('fr-FR', {
                  weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                })}
              </Text>
            </View>
          )}
          {evenementOfficielSelectionne.lieu && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Ionicons name="location-outline" size={13} color={theme.text3} />
              <Text style={{ color: theme.text2, fontSize: t(12), flex: 1 }} numberOfLines={1}>
                {evenementOfficielSelectionne.lieu}
              </Text>
            </View>
          )}
          {positionUser && (
            <Text style={{ color: theme.text3, fontSize: t(11), marginBottom: 10 }}>
              {Math.round(distanceKm(positionUser.latitude, positionUser.longitude,
                parseFloat(evenementOfficielSelectionne.latitude),
                parseFloat(evenementOfficielSelectionne.longitude)) * 10) / 10} km
            </Text>
          )}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={[styles.btnPrincipal, { backgroundColor: couleurPopupOfficielle }]}
              onPress={() => {
                fermerToutesPopups();
                navigation.navigate('DetailEvenementOfficiel', { evenement: evenementOfficielSelectionne });
              }}
            >
              <Ionicons name="arrow-forward" size={15} color="#fff" />
              <Text style={{ color: '#fff', fontSize: t(13), fontWeight: '500' }}>Voir le détail</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnSecondaire, { backgroundColor: theme.bg }]}
              onPress={() => Share.share({ message: `${evenementOfficielSelectionne.titre}\n${evenementOfficielSelectionne.url || ''}` })}>
              <Ionicons name="share-outline" size={17} color={theme.text} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* Popup lieu */}
      {lieuSelectionne && (
        <Animated.View style={[styles.popup, { backgroundColor: theme.card, transform: [{ translateY: slideAnimLieu }] }]}>
          <TouchableOpacity style={styles.popupClose} onPress={fermerToutesPopups}>
            <Ionicons name="close" size={18} color={theme.text3} />
          </TouchableOpacity>
          <Text style={[styles.popupTitre, { color: theme.text, fontSize: t(16), marginBottom: 6, paddingRight: 24 }]} numberOfLines={2}>
            {lieuSelectionne.nom}
          </Text>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <View style={[styles.catBadge, { backgroundColor: configLieu.bg }]}>
              <Ionicons name={configLieu.icone} size={11} color={configLieu.couleur} />
              <Text style={{ color: configLieu.couleur, fontSize: t(11), fontWeight: '500' }}>{lieuSelectionne.categorie}</Text>
            </View>
            {lieuSelectionne.sous_categorie && lieuSelectionne.sous_categorie !== lieuSelectionne.categorie && (
              <View style={[styles.catBadge, { backgroundColor: '#F5F5F5' }]}>
                <Text style={{ color: '#666', fontSize: t(10) }}>{lieuSelectionne.sous_categorie}</Text>
              </View>
            )}
          </View>
          {lieuSelectionne.adresse ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Ionicons name="location-outline" size={13} color={theme.text3} />
              <Text style={{ color: theme.text2, fontSize: t(13), flex: 1 }}>{lieuSelectionne.adresse}</Text>
            </View>
          ) : null}
          {lieuSelectionne.horaires ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Ionicons name="time-outline" size={13} color={theme.text3} />
              <Text style={{ color: theme.text2, fontSize: t(12), flex: 1 }} numberOfLines={2}>{lieuSelectionne.horaires}</Text>
            </View>
          ) : null}
          {lieuSelectionne.telephone ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Ionicons name="call-outline" size={13} color={theme.text3} />
              <Text style={{ color: theme.text2, fontSize: t(13) }}>{lieuSelectionne.telephone}</Text>
            </View>
          ) : null}
          {positionUser && (
            <Text style={{ color: theme.text3, fontSize: t(11), marginBottom: 10 }}>
              {Math.round(distanceKm(positionUser.latitude, positionUser.longitude,
                parseFloat(lieuSelectionne.latitude),
                parseFloat(lieuSelectionne.longitude)) * 10) / 10} km
            </Text>
          )}
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, padding: 12, backgroundColor: '#111' }}
            onPress={() => { fermerToutesPopups(); navigation.navigate('AjoutEvenement'); }}
          >
            <Ionicons name="add-circle-outline" size={16} color="#fff" />
            <Text style={{ color: '#fff', fontSize: t(13), fontWeight: '500' }}>Créer un événement ici</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('AjoutEvenement')}>
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  erreurBanner: { position: 'absolute', top: 96, left: 16, right: 16, backgroundColor: '#EF4444', flexDirection: 'row', alignItems: 'center', padding: 10, paddingHorizontal: 14, gap: 8, zIndex: 5, borderRadius: 12 },
  erreurTexte: { color: '#fff', fontSize: 13, flex: 1 },
  reessayerBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  reessayerTexte: { color: '#fff', fontSize: 12, fontWeight: '500' },
  filtresActifsWrap: { position: 'absolute', top: 96, left: 0, right: 0, zIndex: 4 },
  filtreActifBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1.5 },
  header: { position: 'absolute', top: 52, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 },
  logoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20 },
  logoIcone: { width: 20, height: 20, borderRadius: 6, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  logo: { fontWeight: '500', color: '#111' },
  filtreCount: { backgroundColor: '#EF4444', borderRadius: 10, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  menu: { position: 'absolute', top: 96, left: 16, width: 260, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 8, maxHeight: 560, zIndex: 9 },
  menuHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderBottomWidth: 0.5 },
  menuTitreTexte: { fontWeight: '500' },
  effacerBtn: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  fermerBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  fermerBas: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, margin: 10, borderRadius: 12, padding: 10 },
  menuSection: { fontWeight: '700', letterSpacing: 0.06, padding: 8, paddingBottom: 4 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 8, borderRadius: 10, marginHorizontal: 4 },
  menuIcone: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1 },
  typeCheckbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  checkBox: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  menuAvertissement: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, borderRadius: 8, marginBottom: 4, marginHorizontal: 4 },
  sep: { height: 0.5, marginVertical: 6, marginHorizontal: 8 },
  dateChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1 },
  popup: { position: 'absolute', bottom: 180, left: 12, right: 12, borderRadius: 20, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 8, zIndex: 10 },
  popupClose: { position: 'absolute', top: 14, right: 14, zIndex: 1 },
  popupTitre: { fontWeight: '500' },
  catBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  btnPrincipal: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  btnSecondaire: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  fab: { position: 'absolute', bottom: 100, right: 16, width: 48, height: 48, backgroundColor: '#111', borderRadius: 24, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6, zIndex: 10 },
});