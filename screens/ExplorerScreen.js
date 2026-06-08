import {
  View, Text, StyleSheet, SectionList, TouchableOpacity,
  TextInput, ScrollView, Image, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useCallback, memo, useEffect } from 'react';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useEvenements } from '../EvenementsContext';
import { useApp } from '../AppContext';
import { supabase } from '../supabase';

const FILTRES_TYPE = [
  { key: 'tous',          label: 'Tout',           icon: 'apps-outline' },
  { key: 'communautaire', label: 'Communautaires', icon: 'people-outline' },
  { key: 'officiel',      label: 'Agenda Paris',   icon: 'calendar-outline' },
  { key: 'salle',         label: 'Salles',         icon: 'musical-notes-outline' },
  { key: 'fixe',          label: 'Lieux fixes',    icon: 'location-outline' },
];

const FILTRES_DATE = [
  { key: 'tous',          label: 'Toutes dates',  icon: 'calendar-outline' },
  { key: 'ce_soir',       label: 'Ce soir',       icon: 'moon-outline' },
  { key: 'demain',        label: 'Demain',        icon: 'sunny-outline' },
  { key: 'ce_weekend',    label: 'Ce week-end',   icon: 'beer-outline' },
  { key: 'cette_semaine', label: 'Cette semaine', icon: 'calendar-number-outline' },
  { key: 'date_precise',  label: 'Date précise',  icon: 'search-outline' },
];

const RAYONS_GEO = [
  { label: 'Tout', valeur: null },
  { label: '500 m', valeur: 500 },
  { label: '1 km', valeur: 1000 },
  { label: '2 km', valeur: 2000 },
  { label: '5 km', valeur: 5000 },
  { label: '10 km', valeur: 10000 },
];

const SOURCE_CONFIG = {
  que_faire_paris: { label: 'Agenda Paris', couleur: '#2563EB', bg: '#DBEAFE', icon: 'calendar-outline' },
  openagenda:      { label: 'Salle',        couleur: '#F97316', bg: '#FFF7ED', icon: 'musical-notes-outline' },
  ticketmaster:    { label: 'Ticketmaster', couleur: '#EF4444', bg: '#FEE2E2', icon: 'ticket-outline' },
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

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const auj = new Date(); auj.setHours(0, 0, 0, 0);
  const demain = new Date(auj); demain.setDate(demain.getDate() + 1);
  if (d >= auj && d < demain) return `Aujourd'hui à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  if (d >= demain && d < new Date(demain.getTime() + 86400000)) return `Demain à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const CarteEvenementLuma = memo(({ item, onPress, onVoirCarte, CATEGORIES_COULEURS, CAT_ICONES, t, positionUser }) => {
  const cat = CATEGORIES_COULEURS[item.categorie] || { claire: '#F5F5F5', forte: '#888', texte: '#444' };
  const distance = positionUser && item.latitude && item.longitude
    ? Math.round(distanceKm(positionUser.latitude, positionUser.longitude, item.latitude, item.longitude) * 10) / 10
    : null;
  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(item)} activeOpacity={0.7}>
      <View style={styles.cardHaut}>
        <View style={[styles.cardIcone, { backgroundColor: cat.claire }]}>
          <Ionicons name={CAT_ICONES[item.categorie] || 'construct-outline'} size={20} color={cat.forte} />
        </View>
        <View style={styles.cardContenu}>
          <Text style={[styles.cardTitre, { fontSize: t(14) }]} numberOfLines={1}>{item.titre}</Text>
          {item.lieu ? <Text style={[styles.cardInfo, { fontSize: t(12) }]} numberOfLines={1}>{item.lieu}{distance !== null ? ` · ${distance} km` : ''}</Text> : null}
          {item.date_evenement && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <Ionicons name="time-outline" size={11} color="#2563EB" />
              <Text style={{ color: '#2563EB', fontSize: t(11), fontWeight: '500' }}>{formatDate(item.date_evenement)}</Text>
            </View>
          )}
          <View style={styles.cardBas}>
            <View style={[styles.cardBadge, { backgroundColor: '#111' }]}>
              <Ionicons name="people-outline" size={9} color="#fff" />
              <Text style={{ color: '#fff', fontSize: t(9), fontWeight: '500' }}>Communautaire</Text>
            </View>
            <View style={[styles.cardBadge, { backgroundColor: cat.claire }]}>
              <Text style={{ color: cat.texte, fontSize: t(10), fontWeight: '500' }}>{item.categorie}</Text>
            </View>
            <View style={[styles.cardBadge, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="people-outline" size={10} color="#15803D" />
              <Text style={{ color: '#15803D', fontSize: t(10) }}>
                {item.sans_max ? String(item.participants || 0) : `${item.participants || 0}/${item.max || '?'}`}
              </Text>
            </View>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={15} color="#bbb" />
      </View>
      <TouchableOpacity style={styles.voirCarteBtn} onPress={() => onVoirCarte(item)}>
        <Ionicons name="map-outline" size={15} color="#2563EB" />
        <Text style={[styles.voirCarteBtnTexte, { fontSize: t(13) }]}>Voir sur la carte</Text>
        <Ionicons name="arrow-forward" size={13} color="#2563EB" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

const CarteEvenementOfficiel = memo(({ item, t, positionUser, CATEGORIES_COULEURS, CAT_ICONES, onPress }) => {
  const cat = CATEGORIES_COULEURS[item.categorie] || { claire: '#DBEAFE', forte: '#2563EB', texte: '#1E40AF' };
  const src = SOURCE_CONFIG[item.source] || SOURCE_CONFIG.que_faire_paris;
  const distance = positionUser && item.latitude && item.longitude
    ? Math.round(distanceKm(positionUser.latitude, positionUser.longitude, parseFloat(item.latitude), parseFloat(item.longitude)) * 10) / 10
    : null;

  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftWidth: 3, borderLeftColor: src.couleur }]}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHaut}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.cardImage} />
        ) : (
          <View style={[styles.cardIcone, { backgroundColor: cat.claire }]}>
            <Ionicons name={CAT_ICONES[item.categorie] || src.icon} size={20} color={cat.forte} />
          </View>
        )}
        <View style={styles.cardContenu}>
          <Text style={[styles.cardTitre, { fontSize: t(14) }]} numberOfLines={2}>{item.titre}</Text>
          {item.lieu && (
            <Text style={[styles.cardInfo, { fontSize: t(12) }]} numberOfLines={1}>
              {item.lieu}{distance !== null ? ` · ${distance} km` : ''}
            </Text>
          )}
          {item.date_debut && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <Ionicons name="calendar-outline" size={11} color={src.couleur} />
              <Text style={{ color: src.couleur, fontSize: t(11), fontWeight: '500' }}>
                {formatDate(item.date_debut)}
              </Text>
            </View>
          )}
          <View style={styles.cardBas}>
            <View style={[styles.cardBadge, { backgroundColor: src.bg }]}>
              <Ionicons name={src.icon} size={9} color={src.couleur} />
              <Text style={{ color: src.couleur, fontSize: t(9), fontWeight: '500' }}>{src.label}</Text>
            </View>
            <View style={[styles.cardBadge, { backgroundColor: cat.claire }]}>
              <Text style={{ color: cat.texte, fontSize: t(10) }}>{item.categorie}</Text>
            </View>
            {item.gratuit && (
              <View style={[styles.cardBadge, { backgroundColor: '#DCFCE7' }]}>
                <Text style={{ color: '#15803D', fontSize: t(10), fontWeight: '500' }}>Gratuit</Text>
              </View>
            )}
            {item.prix_min && (
              <View style={[styles.cardBadge, { backgroundColor: '#FEF3C7' }]}>
                <Text style={{ color: '#92400E', fontSize: t(10) }}>À partir de {item.prix_min}€</Text>
              </View>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={15} color={src.couleur} />
      </View>
      {item.salle && item.source === 'openagenda' && (
        <View style={[styles.salleTag, { backgroundColor: '#FFF7ED' }]}>
          <Ionicons name="musical-notes-outline" size={11} color="#F97316" />
          <Text style={{ color: '#EA580C', fontSize: t(11), fontWeight: '500' }}>{item.salle}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

export default function ExplorerScreen({ navigation }) {
  const { evenements, erreurReseau, chargerEvenements } = useEvenements();
  const { theme, facteurTexte, CATEGORIES_COULEURS, CAT_ICONES, rayonDefaut, setEvenementCible } = useApp();

  const [recherche, setRecherche] = useState('');
  const [filtresCategories, setFiltresCategories] = useState([]);
  const [filtreType, setFiltreType] = useState('tous');
  const [filtreDate, setFiltreDate] = useState('tous');
  const [datePrecise, setDatePrecise] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [rayonGeo, setRayonGeo] = useState(null);
  const [positionUser, setPositionUser] = useState(null);
  const [evenementsOfficiels, setEvenementsOfficiels] = useState([]);
  const [chargement, setChargement] = useState(false);

  const t = (size) => size * facteurTexte;

  useEffect(() => {
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setPositionUser({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      }
    })();
    chargerOfficiels();
  }, []);

  const chargerOfficiels = async () => {
    setChargement(true);
    try {
      const { data } = await supabase
        .from('evenements_officiels')
        .select('*')
        .eq('actif', true)
        .gte('date_debut', new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString())
        .order('date_debut', { ascending: true })
        .limit(500);
      if (data) setEvenementsOfficiels(data);
    } catch {}
    setChargement(false);
  };

  const allerDetail = useCallback((evenement) => {
    navigation.navigate('DetailEvenement', { evenement });
  }, [navigation]);

  const allerDetailOfficiel = useCallback((evenement) => {
    navigation.navigate('DetailEvenementOfficiel', { evenement });
  }, [navigation]);

  const voirSurCarte = useCallback((evenement) => {
    setEvenementCible(evenement);
    navigation.navigate('Carte');
  }, [navigation, setEvenementCible]);

  const toggleCategorie = useCallback((nom) => {
    setFiltresCategories(prev => prev.includes(nom) ? prev.filter(c => c !== nom) : [...prev, nom]);
  }, []);

  const selectionnerRayonGeo = (valeur) => {
    if (valeur !== null && !positionUser) {
      alert('Active la localisation pour filtrer par distance');
      return;
    }
    setRayonGeo(valeur);
  };

  const maintenant = new Date();
  const plageDate = getPlageDates(filtreDate, datePrecise);

  // Filtre commun géo
  const matchGeo = (lat, lon) => {
    if (!rayonGeo || !positionUser || !lat || !lon) return true;
    return distanceKm(positionUser.latitude, positionUser.longitude, parseFloat(lat), parseFloat(lon)) * 1000 <= rayonGeo;
  };

  // Filtre événements Luma
  const evenementsLumaFiltres = evenements.filter(e => {
    if (filtreType === 'officiel' || filtreType === 'salle') return false;
    if (filtreType === 'fixe') return e.type === 'fixe' && matchGeo(e.latitude, e.longitude);
    if (filtreType === 'communautaire') return e.type !== 'fixe' && matchGeo(e.latitude, e.longitude);

    const matchRecherche = !recherche ||
      e.titre?.toLowerCase().includes(recherche.toLowerCase()) ||
      e.categorie?.toLowerCase().includes(recherche.toLowerCase()) ||
      e.lieu?.toLowerCase().includes(recherche.toLowerCase());
    const matchCat = filtresCategories.length === 0 || filtresCategories.includes(e.categorie);
    const matchRayon = !rayonDefaut || !positionUser ||
      distanceKm(positionUser.latitude, positionUser.longitude, e.latitude, e.longitude) * 1000 <= rayonDefaut;
    const geoOk = matchGeo(e.latitude, e.longitude);

    let matchDate = true;
    if (plageDate && e.type !== 'fixe') {
      if (!e.date_evenement) matchDate = false;
      else { const d = new Date(e.date_evenement); matchDate = d >= plageDate.debut && d <= plageDate.fin; }
    }
    return matchRecherche && matchCat && matchRayon && geoOk && matchDate;
  });

  // Filtre événements officiels
  const evenementsOfficielsFiltres = filtreType === 'fixe' || filtreType === 'communautaire' ? [] :
    evenementsOfficiels.filter(e => {
      if (filtreType === 'officiel' && e.source !== 'que_faire_paris') return false;
      if (filtreType === 'salle' && e.source !== 'openagenda') return false;
      const matchRecherche = !recherche ||
        e.titre?.toLowerCase().includes(recherche.toLowerCase()) ||
        e.categorie?.toLowerCase().includes(recherche.toLowerCase()) ||
        e.lieu?.toLowerCase().includes(recherche.toLowerCase()) ||
        e.salle?.toLowerCase().includes(recherche.toLowerCase());
      const matchCat = filtresCategories.length === 0 || filtresCategories.includes(e.categorie);
      const geoOk = matchGeo(e.latitude, e.longitude);
      let matchDate = true;
      if (plageDate) {
        if (!e.date_debut) matchDate = false;
        else { const d = new Date(e.date_debut); matchDate = d >= plageDate.debut && d <= plageDate.fin; }
      }
      return matchRecherche && matchCat && geoOk && matchDate;
    });

  // Sections
  const fixesLuma = evenementsLumaFiltres.filter(e => e.type === 'fixe');
  const aVenirLuma = evenementsLumaFiltres.filter(e =>
    e.type !== 'fixe' && (!e.date_evenement || new Date(e.date_evenement) >= maintenant)
  );
  const passesLuma = evenementsLumaFiltres.filter(e =>
    e.type !== 'fixe' && e.date_evenement && new Date(e.date_evenement) < maintenant
  );

  const officielsTries = [...evenementsOfficielsFiltres].sort((a, b) => {
    if (!a.date_debut) return 1;
    if (!b.date_debut) return -1;
    return new Date(a.date_debut) - new Date(b.date_debut);
  });

  const qfp = officielsTries.filter(e => e.source === 'que_faire_paris');
  const salles = officielsTries.filter(e => e.source === 'openagenda');
  const autres = officielsTries.filter(e => e.source !== 'que_faire_paris' && e.source !== 'openagenda');

  const sections = [];

  if ((filtreType === 'tous' || filtreType === 'salle') && salles.length > 0) {
    sections.push({ title: `Programmation salles · ${salles.length}`, data: salles, type: 'officiel', couleur: '#F97316', bg: '#FFF7ED', icon: 'musical-notes-outline' });
  }
  if ((filtreType === 'tous' || filtreType === 'officiel') && qfp.length > 0) {
    sections.push({ title: `Agenda Paris · ${qfp.length}`, data: qfp, type: 'officiel', couleur: '#2563EB', bg: '#DBEAFE', icon: 'calendar-outline' });
  }
  if (autres.length > 0) {
    sections.push({ title: `Autres · ${autres.length}`, data: autres, type: 'officiel', couleur: '#EF4444', bg: '#FEE2E2', icon: 'ticket-outline' });
  }
  if ((filtreType === 'tous' || filtreType === 'communautaire') && aVenirLuma.length > 0) {
    sections.push({ title: `Communautaires à venir · ${aVenirLuma.length}`, data: aVenirLuma, type: 'communautaire', couleur: '#111', bg: '#F5F5F5', icon: 'people-outline' });
  }
  if ((filtreType === 'tous' || filtreType === 'fixe') && filtreDate === 'tous' && fixesLuma.length > 0) {
    sections.push({ title: `Lieux fixes · ${fixesLuma.length}`, data: fixesLuma, type: 'fixe', couleur: '#22C55E', bg: '#DCFCE7', icon: 'location-outline' });
  }
  if ((filtreType === 'tous' || filtreType === 'communautaire') && passesLuma.length > 0) {
    sections.push({ title: `Passés · ${passesLuma.length}`, data: passesLuma, type: 'passe', couleur: '#888', bg: '#F5F5F5', icon: 'time-outline' });
  }

  const nbFiltresActifs = filtresCategories.length + (filtreType !== 'tous' ? 1 : 0) + (filtreDate !== 'tous' ? 1 : 0) + (rayonGeo ? 1 : 0);
  const labelDateActif = filtreDate !== 'tous'
    ? (filtreDate === 'date_precise'
        ? datePrecise.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
        : FILTRES_DATE.find(f => f.key === filtreDate)?.label)
    : null;
  const totalResultats = sections.reduce((acc, s) => acc + s.data.length, 0);

  const renderItem = useCallback(({ item, section }) => {
    if (section.type === 'officiel') {
      return (
        <CarteEvenementOfficiel
          item={item}
          t={t}
          positionUser={positionUser}
          CATEGORIES_COULEURS={CATEGORIES_COULEURS}
          CAT_ICONES={CAT_ICONES}
          onPress={allerDetailOfficiel}
        />
      );
    }
    return (
      <CarteEvenementLuma
        item={item}
        onPress={allerDetail}
        onVoirCarte={voirSurCarte}
        CATEGORIES_COULEURS={CATEGORIES_COULEURS}
        CAT_ICONES={CAT_ICONES}
        t={t}
        positionUser={positionUser}
      />
    );
  }, [allerDetail, allerDetailOfficiel, voirSurCarte, CATEGORIES_COULEURS, CAT_ICONES, t, positionUser]);

  const renderSectionHeader = useCallback(({ section }) => (
    <View style={[styles.sectionHeader, { backgroundColor: section.bg }]}>
      <Ionicons name={section.icon} size={13} color={section.couleur} />
      <Text style={[styles.sectionHeaderTexte, { color: section.couleur }]}>{section.title}</Text>
    </View>
  ), []);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Text style={[styles.titre, { color: theme.text, fontSize: t(22) }]}>Explorer</Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {chargement && (
            <View style={[styles.chargementBadge, { backgroundColor: '#DBEAFE' }]}>
              <Text style={{ color: '#2563EB', fontSize: t(10) }}>Chargement...</Text>
            </View>
          )}
          {rayonDefaut && positionUser && (
            <View style={[styles.rayonBadge, { backgroundColor: '#DBEAFE' }]}>
              <Ionicons name="navigate" size={11} color="#2563EB" />
              <Text style={{ color: '#1E40AF', fontSize: t(11), fontWeight: '500' }}>
                {rayonDefaut >= 1000 ? `${rayonDefaut / 1000} km` : `${rayonDefaut} m`}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Erreur réseau */}
      {erreurReseau && (
        <TouchableOpacity style={styles.erreurBanner} onPress={chargerEvenements}>
          <Ionicons name="wifi-outline" size={14} color="#fff" />
          <Text style={styles.erreurTexte}>Pas de connexion — Appuie pour réessayer</Text>
        </TouchableOpacity>
      )}

      {/* Recherche */}
      <View style={[styles.searchWrap, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Ionicons name="search-outline" size={15} color={theme.text3} />
        <TextInput
          style={[styles.searchInput, { color: theme.text, fontSize: t(14) }]}
          placeholder="Rechercher un événement, une salle..."
          placeholderTextColor={theme.text3}
          value={recherche}
          onChangeText={setRecherche}
        />
        {recherche.length > 0 && (
          <TouchableOpacity onPress={() => setRecherche('')}>
            <Ionicons name="close-circle" size={16} color={theme.text3} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filtre géographique */}
      <View style={[styles.filtreSection, { borderBottomColor: theme.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtreScroll}>
          {RAYONS_GEO.map(r => {
            const actif = rayonGeo === r.valeur;
            return (
              <TouchableOpacity
                key={String(r.valeur)}
                style={[styles.filtreBtn, {
                  backgroundColor: actif ? (r.valeur === null ? '#111' : '#DBEAFE') : theme.card,
                  borderColor: actif ? (r.valeur === null ? '#111' : '#2563EB') : theme.border,
                  borderWidth: actif ? 1.5 : 0.5,
                }]}
                onPress={() => selectionnerRayonGeo(r.valeur)}
              >
                <Ionicons
                  name={r.valeur === null ? 'globe-outline' : 'navigate-outline'}
                  size={13}
                  color={actif ? (r.valeur === null ? '#fff' : '#2563EB') : theme.text3}
                />
                <Text style={[styles.filtreBtnTexte, {
                  color: actif ? (r.valeur === null ? '#fff' : '#2563EB') : theme.text3,
                  fontWeight: actif ? '500' : '400',
                  fontSize: t(12),
                }]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Filtres date */}
      <View style={[styles.filtreSection, { borderBottomColor: theme.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtreScroll}>
          {FILTRES_DATE.map(fd => {
            const actif = filtreDate === fd.key;
            return (
              <TouchableOpacity
                key={fd.key}
                style={[styles.filtreBtn, {
                  backgroundColor: actif ? '#111' : theme.card,
                  borderColor: actif ? '#111' : theme.border,
                  borderWidth: actif ? 1.5 : 0.5,
                }]}
                onPress={() => { setFiltreDate(fd.key); if (fd.key === 'date_precise') setShowDatePicker(true); }}
              >
                <Ionicons name={fd.icon} size={13} color={actif ? '#fff' : theme.text3} />
                <Text style={[styles.filtreBtnTexte, {
                  color: actif ? '#fff' : theme.text3,
                  fontWeight: actif ? '500' : '400',
                  fontSize: t(12),
                }]}>
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
      </View>

      {/* Filtres type */}
      <View style={[styles.filtreSection, { borderBottomColor: theme.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtreScroll}>
          {FILTRES_TYPE.map(ft => {
            const actif = filtreType === ft.key;
            const couleurs = {
              tous:          { bg: '#F5F5F5', c: '#555' },
              communautaire: { bg: '#111',    c: '#fff' },
              officiel:      { bg: '#DBEAFE', c: '#2563EB' },
              salle:         { bg: '#FFF7ED', c: '#F97316' },
              fixe:          { bg: '#DCFCE7', c: '#22C55E' },
            };
            const c = couleurs[ft.key];
            return (
              <TouchableOpacity
                key={ft.key}
                style={[styles.filtreBtn, {
                  backgroundColor: actif ? c.bg : theme.card,
                  borderColor: actif ? c.c : theme.border,
                  borderWidth: actif ? 1.5 : 0.5,
                }]}
                onPress={() => setFiltreType(ft.key)}
              >
                <Ionicons name={ft.icon} size={13} color={actif ? c.c : theme.text3} />
                <Text style={[styles.filtreBtnTexte, {
                  color: actif ? c.c : theme.text3,
                  fontWeight: actif ? '500' : '400',
                  fontSize: t(13),
                }]}>
                  {ft.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Filtres catégories */}
      <View style={styles.filtresWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtresScroll}>
          <TouchableOpacity
            style={[styles.chip, {
              backgroundColor: filtresCategories.length === 0 ? '#111' : theme.card,
              borderColor: filtresCategories.length === 0 ? '#111' : theme.border,
            }]}
            onPress={() => setFiltresCategories([])}
          >
            <Text style={[styles.chipTexte, {
              color: filtresCategories.length === 0 ? '#fff' : theme.text3,
              fontSize: t(12),
              fontWeight: filtresCategories.length === 0 ? '500' : '400',
            }]}>
              Toutes
            </Text>
          </TouchableOpacity>
          {Object.entries(CATEGORIES_COULEURS).map(([nom, c]) => {
            const actif = filtresCategories.includes(nom);
            return (
              <TouchableOpacity
                key={nom}
                style={[styles.chip, {
                  backgroundColor: actif ? c.claire : theme.card,
                  borderColor: actif ? c.forte : theme.border,
                  borderWidth: actif ? 1.5 : 0.5,
                }]}
                onPress={() => toggleCategorie(nom)}
              >
                <Ionicons name={CAT_ICONES[nom] || 'construct-outline'} size={12} color={actif ? c.forte : theme.text3} />
                <Text style={[styles.chipTexte, {
                  color: actif ? c.texte : theme.text3,
                  fontSize: t(12),
                  fontWeight: actif ? '500' : '400',
                }]}>
                  {nom}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Compteur résultats */}
      {(nbFiltresActifs > 0 || recherche) && (
        <View style={[styles.compteurWrap, { backgroundColor: theme.bg }]}>
          <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
            <Text style={{ color: theme.text3, fontSize: t(12) }}>
              {totalResultats} résultat{totalResultats !== 1 ? 's' : ''}
            </Text>
            {labelDateActif && (
              <View style={[styles.resumeBadge, { backgroundColor: '#111' }]}>
                <Ionicons name="calendar-outline" size={10} color="#fff" />
                <Text style={{ color: '#fff', fontSize: t(10), fontWeight: '500' }}>{labelDateActif}</Text>
              </View>
            )}
            {rayonGeo && (
              <View style={[styles.resumeBadge, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="navigate-outline" size={10} color="#2563EB" />
                <Text style={{ color: '#1E40AF', fontSize: t(10), fontWeight: '500' }}>
                  {rayonGeo < 1000 ? `${rayonGeo} m` : `${rayonGeo / 1000} km`}
                </Text>
              </View>
            )}
            {filtreType !== 'tous' && (
              <View style={[styles.resumeBadge, { backgroundColor: '#F5F5F5' }]}>
                <Text style={{ color: '#555', fontSize: t(10), fontWeight: '500' }}>
                  {FILTRES_TYPE.find(f => f.key === filtreType)?.label}
                </Text>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={() => {
            setFiltreType('tous');
            setFiltresCategories([]);
            setFiltreDate('tous');
            setRayonGeo(null);
            setRecherche('');
          }}>
            <Text style={{ color: '#2563EB', fontSize: t(12) }}>Effacer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Résultats */}
      {sections.length === 0 ? (
        <View style={styles.vide}>
          <View style={[styles.videIcone, { backgroundColor: theme.card }]}>
            <Ionicons name="search" size={28} color={theme.text3} />
          </View>
          <Text style={[styles.videTexte, { color: theme.text, fontSize: t(16) }]}>
            Aucun événement trouvé
          </Text>
          <Text style={[styles.videDesc, { color: theme.text3, fontSize: t(13) }]}>
            {rayonGeo ? `Aucun événement dans ${rayonGeo < 1000 ? `${rayonGeo} m` : `${rayonGeo / 1000} km`} autour de toi.`
              : filtreDate !== 'tous' ? `Aucun événement ${labelDateActif?.toLowerCase() || ''}.`
              : 'Essaie d\'autres filtres'}
          </Text>
          {(filtreType !== 'tous' || filtresCategories.length > 0 || filtreDate !== 'tous' || rayonGeo) && (
            <TouchableOpacity
              style={[styles.videBtn, { backgroundColor: '#111' }]}
              onPress={() => { setFiltreType('tous'); setFiltresCategories([]); setFiltreDate('tous'); setRayonGeo(null); }}
            >
              <Text style={{ color: '#fff', fontSize: t(13), fontWeight: '500' }}>Effacer les filtres</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => `${item.source || 'luma'}_${item.id}`}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.liste}
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={10}
          initialNumToRender={8}
          stickySectionHeadersEnabled={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, paddingTop: 56, borderBottomWidth: 0.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titre: { fontWeight: '500' },
  chargementBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  rayonBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  erreurBanner: { backgroundColor: '#EF4444', flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, paddingHorizontal: 16 },
  erreurTexte: { color: '#fff', fontSize: 12, flex: 1 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, marginBottom: 0, borderRadius: 12, padding: 12, borderWidth: 0.5 },
  searchInput: { flex: 1 },
  filtreSection: { borderBottomWidth: 0.5, paddingVertical: 8 },
  filtreScroll: { gap: 8, paddingHorizontal: 12 },
  filtreBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  filtreBtnTexte: {},
  filtresWrap: { paddingVertical: 8 },
  filtresScroll: { gap: 7, paddingHorizontal: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 6, borderWidth: 0.5 },
  chipTexte: {},
  compteurWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 6 },
  resumeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 20, paddingHorizontal: 7, paddingVertical: 3 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginHorizontal: 12, marginTop: 8, marginBottom: 6, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  sectionHeaderTexte: { fontWeight: '700', fontSize: 12, letterSpacing: 0.04 },
  liste: { paddingHorizontal: 12, paddingBottom: 20, gap: 8 },
  card: { borderRadius: 14, borderWidth: 0.5, borderColor: '#E8E8E8', backgroundColor: '#fff', overflow: 'hidden' },
  cardHaut: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  cardIcone: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardImage: { width: 46, height: 46, borderRadius: 13, flexShrink: 0 },
  cardContenu: { flex: 1 },
  cardTitre: { fontWeight: '500', color: '#111', marginBottom: 3 },
  cardInfo: { color: '#888', marginBottom: 4 },
  cardBas: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  cardBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 20, paddingHorizontal: 7, paddingVertical: 3 },
  salleTag: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 0.5, borderTopColor: '#FED7AA' },
  voirCarteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#EFF6FF', paddingVertical: 11, borderTopWidth: 0.5, borderTopColor: '#BFDBFE' },
  voirCarteBtnTexte: { color: '#2563EB', fontWeight: '500' },
  vide: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  videIcone: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  videTexte: { fontWeight: '500' },
  videDesc: { textAlign: 'center', lineHeight: 20 },
  videBtn: { borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12, marginTop: 4 },
});