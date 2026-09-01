import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  FlatList, Image, TextInput, Modal, RefreshControl, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useCallback, memo, useRef } from 'react';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useEvenements } from '../EvenementsContext';
import { useApp, CATEGORIES } from '../AppContext';
import { supabase } from '../supabase';
import StoriesBar from '../components/StoriesBar';
import StoryViewer from '../components/StoryViewer';

const CATEGORIES_LIEUX = [
  { key: 'musique',  label: 'Musique',   icon: 'musical-notes', couleur: '#A855F7', bg: '#F3E8FF', sousCats: ['Salle de concert', 'Opéra'] },
  { key: 'cinema',   label: 'Cinéma',    icon: 'film',          couleur: '#9F1239', bg: '#FFF1F2', sousCats: ['Cinéma'] },
  { key: 'theatre',  label: 'Théâtre',   icon: 'easel',         couleur: '#4F46E5', bg: '#EEF2FF', sousCats: ['Théâtre'] },
  { key: 'musee',    label: 'Musées',    icon: 'image',         couleur: '#D97706', bg: '#FFFBEB', sousCats: ['Musée'] },
  { key: 'sport',    label: 'Sport',     icon: 'trophy',        couleur: '#2563EB', bg: '#DBEAFE', sousCats: ['Stade', 'Piscine', 'Salle de sport'] },
  { key: 'marche',   label: 'Marchés',   icon: 'storefront',    couleur: '#EF4444', bg: '#FEE2E2', sousCats: ['Marché'] },
];

const PAGE_SIZE = 30;

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const auj = new Date(); auj.setHours(0, 0, 0, 0);
  const dem = new Date(auj); dem.setDate(dem.getDate() + 1);
  if (d >= auj && d < dem) return `Auj. ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  if (d >= dem && d < new Date(dem.getTime() + 86400000)) return `Dem. ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const CarteEvenementOfficiel = memo(({ item, t, onPress, positionUser }) => {
  const cat = CATEGORIES[item.categorie] || { claire: '#DBEAFE', forte: '#2563EB', texte: '#1E40AF', icone: 'calendar-outline' };
  const dist = positionUser && item.latitude && item.longitude
    ? Math.round(distanceKm(positionUser.latitude, positionUser.longitude, parseFloat(item.latitude), parseFloat(item.longitude)) * 10) / 10
    : null;
  return (
    <TouchableOpacity style={[styles.evCard, { borderLeftColor: cat.forte }]} onPress={() => onPress(item)} activeOpacity={0.7}>
      <View style={styles.evCardInner}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.evImage} />
        ) : (
          <View style={[styles.evImage, { backgroundColor: cat.claire, alignItems: 'center', justifyContent: 'center' }]}>
            <Ionicons name={cat.icone?.replace('-outline', '') || 'calendar'} size={20} color={cat.forte} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#111', fontSize: t(14), fontWeight: '500', marginBottom: 3, letterSpacing: -0.1 }} numberOfLines={2}>{item.titre}</Text>
          {item.lieu && <Text style={{ color: '#aaa', fontSize: t(12), marginBottom: 4 }} numberOfLines={1}>{item.lieu}</Text>}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {item.date_debut && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name="calendar-outline" size={11} color={cat.forte} />
                <Text style={{ color: cat.forte, fontSize: t(11), fontWeight: '500' }}>{formatDate(item.date_debut)}</Text>
              </View>
            )}
            {dist !== null && <Text style={{ color: '#ccc', fontSize: t(11) }}>{dist} km</Text>}
          </View>
          <View style={{ flexDirection: 'row', gap: 5, flexWrap: 'wrap', marginTop: 5 }}>
            <View style={[styles.tag, { backgroundColor: cat.claire }]}>
              <Text style={{ color: cat.texte, fontSize: t(10), fontWeight: '500' }}>{item.categorie}</Text>
            </View>
            {item.gratuit && <View style={[styles.tag, { backgroundColor: '#DCFCE7' }]}><Text style={{ color: '#15803D', fontSize: t(10), fontWeight: '500' }}>Gratuit</Text></View>}
            {item.prix_min && <View style={[styles.tag, { backgroundColor: '#FEF3C7' }]}><Text style={{ color: '#92400E', fontSize: t(10) }}>Dès {item.prix_min}€</Text></View>}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={14} color="#ddd" />
      </View>
    </TouchableOpacity>
  );
});

const CarteEvenementCommunautaire = memo(({ item, t, positionUser, onPress, onVoirCarte, CATEGORIES_COULEURS, CAT_ICONES }) => {
  const cat = CATEGORIES_COULEURS[item.categorie] || { claire: '#F5F5F5', forte: '#888', texte: '#444' };
  const dist = positionUser && item.latitude && item.longitude
    ? Math.round(distanceKm(positionUser.latitude, positionUser.longitude, item.latitude, item.longitude) * 10) / 10 : null;
  return (
    <TouchableOpacity style={[styles.evCard, { borderLeftColor: '#111' }]} onPress={() => onPress(item)} activeOpacity={0.7}>
      <View style={styles.evCardInner}>
        <View style={[styles.evImage, { backgroundColor: cat.claire, alignItems: 'center', justifyContent: 'center' }]}>
          <Ionicons name={CAT_ICONES[item.categorie] || 'construct-outline'} size={20} color={cat.forte} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#111', fontSize: t(14), fontWeight: '500', marginBottom: 3 }} numberOfLines={1}>{item.titre}</Text>
          {item.lieu && <Text style={{ color: '#aaa', fontSize: t(12), marginBottom: 4 }} numberOfLines={1}>{item.lieu}{dist !== null ? ` · ${dist} km` : ''}</Text>}
          {item.date_evenement && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 5 }}>
              <Ionicons name="time-outline" size={11} color="#2563EB" />
              <Text style={{ color: '#2563EB', fontSize: t(11), fontWeight: '500' }}>{formatDate(item.date_evenement)}</Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 5 }}>
            <View style={[styles.tag, { backgroundColor: '#f0f0ee' }]}>
              <Ionicons name="people-outline" size={10} color="#666" />
              <Text style={{ color: '#666', fontSize: t(10), fontWeight: '500' }}>
                {item.sans_max ? String(item.participants || 0) : `${item.participants || 0}/${item.max || '?'}`}
              </Text>
            </View>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={14} color="#ddd" />
      </View>
      <TouchableOpacity style={styles.voirCarteBtn} onPress={() => onVoirCarte(item)}>
        <Ionicons name="map-outline" size={13} color="#2563EB" />
        <Text style={{ color: '#2563EB', fontSize: t(12), fontWeight: '500' }}>Voir sur la carte</Text>
        <Ionicons name="arrow-forward" size={11} color="#2563EB" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

export default function ExplorerScreen({ navigation }) {
  const { evenements } = useEvenements();
  const { facteurTexte, CATEGORIES_COULEURS, CAT_ICONES, setEvenementCible, profil } = useApp();
  const t = (s) => s * facteurTexte;

  const [onglet, setOnglet] = useState('pourToi');
  const [recherche, setRecherche] = useState('');
  const [positionUser, setPositionUser] = useState(null);
  const [evenementsOfficiels, setEvenementsOfficiels] = useState([]);
  const [chargement, setChargement] = useState(false);
  const [chargementPlus, setChargementPlus] = useState(false);
  const [refresh, setRefresh] = useState(false);
  const [totalOff, setTotalOff] = useState(0);
  const offsetRef = useRef(0);
  const [lieux, setLieux] = useState([]);
  const [categorieActive, setCategorieActive] = useState(null);
  const [lieuxFiltres, setLieuxFiltres] = useState([]);
  const [rechercheLieu, setRechercheLieu] = useState('');
  const [stories, setStories] = useState([]);
  const [storyViewerVisible, setStoryViewerVisible] = useState(false);
  const [storiesIndex, setStoriesIndex] = useState(0);
  const [rechercheFilm, setRechercheFilm] = useState('');
  const [modeRechercheFilm, setModeRechercheFilm] = useState(false);
  const [resultatsFilm, setResultatsFilm] = useState([]);
  const [filtreDate, setFiltreDate] = useState('tous');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePrecise, setDatePrecise] = useState(new Date());
  const [filtreGratuit, setFiltreGratuit] = useState(false);
  const [evPourToi, setEvPourToi] = useState([]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setPositionUser({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      }
    })();
    chargerOfficiels(0, true);
    chargerLieux();
    chargerStories();
  }, []);

  useEffect(() => {
    if (profil?.interets?.length > 0 || profil?.centres_interet?.length > 0) chargerPourToi();
  }, [profil]);

  const chargerPourToi = async () => {
    const interets = profil?.interets || profil?.centres_interet || [];
    if (!interets.length) return;
    const categoriesMap = {
      'Musique': ['Musique', 'Concert'], 'Cinéma': ['Cinéma', 'Film'],
      'Théâtre': ['Théâtre', 'Spectacle'], 'Sport': ['Sport'],
      'Art': ['Art', 'Exposition', 'Musée'], 'Apéro': ['Apéro', 'Fête'],
      'Famille': ['Famille', 'Enfants'], 'Marché': ['Marché', 'Brocante'],
      'Cours': ['Cours', 'Atelier'], 'Gaming': ['Gaming'],
    };
    const cats = interets.flatMap(i => categoriesMap[i] || [i]);
    try {
      const { data } = await supabase.from('evenements_officiels').select('*')
        .eq('actif', true).gte('date_debut', new Date().toISOString())
        .gte('latitude', 48.1).lte('latitude', 49.2).gte('longitude', 1.4).lte('longitude', 3.6)
        .in('categorie', cats).order('date_debut', { ascending: true }).limit(50);
      if (data) setEvPourToi(data);
    } catch {}
  };

  const chargerOfficiels = async (offset = 0, reset = false) => {
    if (reset) setChargement(true);
    else setChargementPlus(true);
    try {
      const { data, count } = await supabase.from('evenements_officiels')
        .select('*', { count: 'exact' }).eq('actif', true)
        .gte('date_debut', new Date().toISOString())
        .gte('latitude', 48.1).lte('latitude', 49.2)
        .gte('longitude', 1.4).lte('longitude', 3.6)
        .order('date_debut', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (data) {
        if (reset) setEvenementsOfficiels(data);
        else setEvenementsOfficiels(prev => [...prev, ...data]);
        setTotalOff(count || 0);
        offsetRef.current = offset + data.length;
      }
    } catch {}
    if (reset) setChargement(false);
    else setChargementPlus(false);
  };

  const chargerPlus = () => {
    if (chargementPlus || offsetRef.current >= totalOff) return;
    chargerOfficiels(offsetRef.current);
  };

  const onRefresh = async () => {
    setRefresh(true);
    await chargerOfficiels(0, true);
    await chargerStories();
    setRefresh(false);
  };

  const chargerLieux = async () => {
    try {
      const { data } = await supabase.from('lieux_officiels').select('*')
        .not('latitude', 'is', null).gte('latitude', 48.7).lte('latitude', 49.0)
        .gte('longitude', 2.0).lte('longitude', 2.7)
        .order('nom', { ascending: true }).limit(500);
      if (data) setLieux(data);
    } catch {}
  };

  const chargerStories = async () => {
    try {
      const { data } = await supabase.from('stories')
        .select('*, profiles(id, prenom, avatar_url)').eq('actif', true)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false }).limit(50);
      if (data) setStories(data);
    } catch {}
  };

  const rechercherFilmFn = useCallback(async (titre) => {
    if (!titre || titre.length < 2) { setResultatsFilm([]); return; }
    try {
      const { data } = await supabase.from('seances_cinema')
        .select('film_titre, cinema_nom, film_affiche, film_note, date_seance')
        .ilike('film_titre', `%${titre}%`).gte('date_seance', new Date().toISOString())
        .order('date_seance', { ascending: true }).limit(100);
      if (data) {
        const filmsMap = {};
        data.forEach(s => {
          if (!filmsMap[s.film_titre]) filmsMap[s.film_titre] = { titre: s.film_titre, affiche: s.film_affiche, note: s.film_note, cinemas: new Set() };
          filmsMap[s.film_titre].cinemas.add(s.cinema_nom);
        });
        setResultatsFilm(Object.values(filmsMap).map(f => ({ ...f, cinemas: [...f.cinemas] })));
      }
    } catch {}
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => rechercherFilmFn(rechercheFilm), 400);
    return () => clearTimeout(timer);
  }, [rechercheFilm]);

  useEffect(() => {
    if (!categorieActive) { setLieuxFiltres([]); return; }
    const config = CATEGORIES_LIEUX.find(c => c.key === categorieActive);
    if (!config) return;
    let filtres = lieux.filter(l => config.sousCats.some(sc => (l.sous_categorie || '').toLowerCase().includes(sc.toLowerCase())));
    if (rechercheLieu.trim()) filtres = filtres.filter(l => l.nom?.toLowerCase().includes(rechercheLieu.toLowerCase()) || l.adresse?.toLowerCase().includes(rechercheLieu.toLowerCase()));
    if (positionUser) filtres = filtres.sort((a, b) => distanceKm(positionUser.latitude, positionUser.longitude, parseFloat(a.latitude), parseFloat(a.longitude)) - distanceKm(positionUser.latitude, positionUser.longitude, parseFloat(b.latitude), parseFloat(b.longitude)));
    setLieuxFiltres(filtres);
  }, [categorieActive, lieux, rechercheLieu, positionUser]);

  const getPlage = () => {
    const auj = new Date(); auj.setHours(0, 0, 0, 0);
    if (filtreDate === 'ce_soir') { const f = new Date(auj); f.setHours(23, 59, 59, 999); return { d: new Date(), f }; }
    if (filtreDate === 'demain') { const d = new Date(auj); d.setDate(d.getDate() + 1); const f = new Date(d); f.setHours(23, 59, 59, 999); return { d, f }; }
    if (filtreDate === 'ce_weekend') { const j = new Date().getDay(); const d = new Date(auj); d.setDate(d.getDate() + (j === 6 ? 0 : 6 - j)); const f = new Date(d); f.setDate(f.getDate() + 1); f.setHours(23, 59, 59, 999); return { d, f }; }
    if (filtreDate === 'date_precise') { const d = new Date(datePrecise); d.setHours(0, 0, 0, 0); const f = new Date(datePrecise); f.setHours(23, 59, 59, 999); return { d, f }; }
    return null;
  };

  const agendaFiltres = evenementsOfficiels.filter(ev => {
    const matchR = !recherche || ev.titre?.toLowerCase().includes(recherche.toLowerCase()) || ev.lieu?.toLowerCase().includes(recherche.toLowerCase());
    const matchG = !filtreGratuit || ev.gratuit;
    const plage = getPlage();
    const matchD = !plage || (ev.date_debut && new Date(ev.date_debut) >= plage.d && new Date(ev.date_debut) <= plage.f);
    return matchR && matchG && matchD;
  });

  const communautairesFiltres = evenements.filter(ev =>
    !recherche || ev.titre?.toLowerCase().includes(recherche.toLowerCase()) || ev.lieu?.toLowerCase().includes(recherche.toLowerCase())
  );

  const evPourToiAffich = evPourToi.length > 0 ? evPourToi : evenementsOfficiels.slice(0, 20);
  const voirSurCarte = useCallback((ev) => { setEvenementCible(ev); navigation.navigate('Carte'); }, [navigation, setEvenementCible]);
  const allerDetailOfficiel = useCallback((ev) => navigation.navigate('DetailEvenementOfficiel', { evenement: ev }), [navigation]);
  const allerDetail = useCallback((ev) => navigation.navigate('DetailEvenement', { evenement: ev }), [navigation]);
  const allerDetailLieu = useCallback((lieu) => navigation.navigate('DetailLieu', { lieu }), [navigation]);
  const configActive = CATEGORIES_LIEUX.find(c => c.key === categorieActive);

  const ONGLETS = [
    { key: 'pourToi',    label: '✨ Pour toi' },
    { key: 'lieux',      label: '🏛 Lieux' },
    { key: 'agenda',     label: '📅 Agenda' },
    { key: 'communaute', label: '👥 Communauté' },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.titre, { fontSize: t(28) }]}>Explorer</Text>
        <TouchableOpacity style={styles.storyBtn} onPress={() => navigation.navigate('CreerStory')} activeOpacity={0.8}>
          <Ionicons name="camera" size={16} color="#fff" />
          <Text style={{ color: '#fff', fontSize: t(12), fontWeight: '600' }}>Story</Text>
        </TouchableOpacity>
      </View>

      {/* Onglets pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.ongletsScroll} contentContainerStyle={styles.ongletsContent}>
        {ONGLETS.map(o => (
          <TouchableOpacity
            key={o.key}
            style={[styles.onglet, onglet === o.key && styles.ongletActif]}
            onPress={() => { setOnglet(o.key); setRecherche(''); }}
            activeOpacity={0.75}
          >
            <Text style={[styles.ongletTxt, { fontSize: t(13) }, onglet === o.key && { color: '#fff' }]}>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── POUR TOI ── */}
      {onglet === 'pourToi' && (
        <FlatList
          data={evPourToiAffich}
          keyExtractor={item => `pt_${item.id}`}
          refreshControl={<RefreshControl refreshing={refresh} onRefresh={onRefresh} tintColor="#aaa" />}
          ListHeaderComponent={
            <>
              {stories.length > 0 && (
                <View style={styles.storiesWrap}>
                  <StoriesBar
                    stories={stories}
                    onPress={(index) => { setStoriesIndex(index); setStoryViewerVisible(true); }}
                    onCreer={() => navigation.navigate('CreerStory')}
                    t={t}
                  />
                </View>
              )}
              {stories.length === 0 && (
                <TouchableOpacity style={styles.creerStoryBanner} onPress={() => navigation.navigate('CreerStory')} activeOpacity={0.8}>
                  <View style={styles.creerStoryIcone}><Ionicons name="camera" size={20} color="#fff" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#111', fontSize: t(14), fontWeight: '600' }}>Partage ta story</Text>
                    <Text style={{ color: '#aaa', fontSize: t(12) }}>Photo ou vidéo · visible 24h sur la carte</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#ddd" />
                </TouchableOpacity>
              )}
              {evenements.slice(0, 3).length > 0 && (
                <View style={styles.sectionBlock}>
                  <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitre, { fontSize: t(17) }]}>Près de toi 👥</Text>
                    <TouchableOpacity onPress={() => setOnglet('communaute')}>
                      <Text style={{ color: '#2563EB', fontSize: t(13), fontWeight: '500' }}>Voir tout</Text>
                    </TouchableOpacity>
                  </View>
                  {evenements.slice(0, 3).map(ev => (
                    <CarteEvenementCommunautaire key={ev.id} item={ev} t={t} positionUser={positionUser}
                      onPress={allerDetail} onVoirCarte={voirSurCarte}
                      CATEGORIES_COULEURS={CATEGORIES_COULEURS} CAT_ICONES={CAT_ICONES} />
                  ))}
                </View>
              )}
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitre, { fontSize: t(17) }]}>
                    {profil?.centres_interet?.length > 0 ? '✨ Sélectionné pour toi' : '🎭 À l\'affiche'}
                  </Text>
                  <TouchableOpacity onPress={() => setOnglet('agenda')}>
                    <Text style={{ color: '#2563EB', fontSize: t(13), fontWeight: '500' }}>Voir tout</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          }
          renderItem={({ item }) => (
            <View style={styles.sectionBlock}>
              <CarteEvenementOfficiel item={item} t={t} onPress={allerDetailOfficiel} positionUser={positionUser} />
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.vide}>
              <Ionicons name="calendar-outline" size={38} color="#ddd" />
              <Text style={{ color: '#aaa', fontSize: t(14), marginTop: 10 }}>Aucun événement</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 24 }}
          removeClippedSubviews maxToRenderPerBatch={10} windowSize={10} initialNumToRender={10}
        />
      )}

      {/* ── LIEUX ── */}
      {onglet === 'lieux' && (
        <View style={{ flex: 1 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={styles.catScrollContent}>
            {CATEGORIES_LIEUX.map(cat => (
              <TouchableOpacity
                key={cat.key}
                style={[styles.catPill, { borderColor: cat.couleur }, categorieActive === cat.key && { backgroundColor: cat.couleur }]}
                onPress={() => { setCategorieActive(categorieActive === cat.key ? null : cat.key); setRechercheLieu(''); setModeRechercheFilm(false); }}
                activeOpacity={0.8}
              >
                <Ionicons name={cat.icon} size={15} color={categorieActive === cat.key ? '#fff' : cat.couleur} />
                <Text style={{ color: categorieActive === cat.key ? '#fff' : '#666', fontSize: t(13), fontWeight: '500' }}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {categorieActive && (
            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={15} color="#aaa" />
              <TextInput
                style={[styles.searchInput, { fontSize: t(13) }]}
                placeholder={categorieActive === 'cinema' && modeRechercheFilm ? 'Cherche un film...' : `Cherche un lieu...`}
                placeholderTextColor="#aaa"
                value={categorieActive === 'cinema' && modeRechercheFilm ? rechercheFilm : rechercheLieu}
                onChangeText={categorieActive === 'cinema' && modeRechercheFilm ? setRechercheFilm : setRechercheLieu}
              />
              {categorieActive === 'cinema' && (
                <TouchableOpacity
                  style={[styles.switchModeBtn, modeRechercheFilm && { backgroundColor: '#9F1239' }]}
                  onPress={() => { setModeRechercheFilm(v => !v); setRechercheFilm(''); setRechercheLieu(''); }}
                >
                  <Text style={{ color: modeRechercheFilm ? '#fff' : '#aaa', fontSize: t(11), fontWeight: '500' }}>
                    {modeRechercheFilm ? '🎬 Film' : '📍 Lieu'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {categorieActive === 'cinema' && modeRechercheFilm ? (
            <FlatList
              data={resultatsFilm}
              keyExtractor={(item, i) => `film_${i}`}
              renderItem={({ item }) => (
                <View style={styles.filmCard}>
                  <View style={{ flexDirection: 'row', gap: 12, marginBottom: 10 }}>
                    {item.affiche ? (
                      <Image source={{ uri: item.affiche }} style={styles.filmAffiche} resizeMode="cover" />
                    ) : (
                      <View style={[styles.filmAffiche, { backgroundColor: '#FFF1F2', alignItems: 'center', justifyContent: 'center' }]}>
                        <Ionicons name="film" size={22} color="#9F1239" />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#111', fontSize: t(15), fontWeight: '600', marginBottom: 4 }}>{item.titre}</Text>
                      {item.note && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                          <Ionicons name="star" size={12} color="#F59E0B" />
                          <Text style={{ color: '#888', fontSize: t(12) }}>{Math.round(item.note * 10) / 10}/5</Text>
                        </View>
                      )}
                      <Text style={{ color: '#9F1239', fontSize: t(12), fontWeight: '500' }}>
                        {item.cinemas.length} cinéma{item.cinemas.length > 1 ? 's' : ''}
                      </Text>
                    </View>
                  </View>
                  {item.cinemas.map((cinema, i) => {
                    const lieu = lieux.find(l => l.nom === cinema);
                    return (
                      <TouchableOpacity key={i} style={styles.cinemaligne} onPress={() => lieu && allerDetailLieu(lieu)}>
                        <Ionicons name="location-outline" size={13} color="#9F1239" />
                        <Text style={{ color: '#111', fontSize: t(13), flex: 1 }}>{cinema}</Text>
                        {lieu && <Ionicons name="chevron-forward" size={13} color="#ddd" />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.vide}>
                  <Ionicons name={rechercheFilm.length > 1 ? 'film-outline' : 'search'} size={36} color="#ddd" />
                  <Text style={{ color: '#aaa', fontSize: t(14), marginTop: 10 }}>
                    {rechercheFilm.length > 1 ? 'Aucun film trouvé' : 'Tape un titre de film'}
                  </Text>
                </View>
              }
              contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}
            />
          ) : categorieActive ? (
            <FlatList
              data={lieuxFiltres}
              keyExtractor={item => `lieu_${item.id}`}
              renderItem={({ item }) => {
                const config = configActive || CATEGORIES_LIEUX[0];
                const dist = positionUser && item.latitude
                  ? Math.round(distanceKm(positionUser.latitude, positionUser.longitude, parseFloat(item.latitude), parseFloat(item.longitude)) * 10) / 10 : null;
                return (
                  <TouchableOpacity style={[styles.lieuCard, { borderLeftColor: config.couleur }]} onPress={() => allerDetailLieu(item)} activeOpacity={0.7}>
                    <View style={[styles.lieuIcone, { backgroundColor: config.bg }]}>
                      <Ionicons name={config.icon} size={18} color={config.couleur} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#111', fontSize: t(14), fontWeight: '500', marginBottom: 2 }} numberOfLines={1}>{item.nom}</Text>
                      {item.adresse && <Text style={{ color: '#aaa', fontSize: t(12) }} numberOfLines={1}>{item.adresse}</Text>}
                      {dist !== null && <Text style={{ color: config.couleur, fontSize: t(11), marginTop: 2 }}>{dist} km</Text>}
                    </View>
                    <Ionicons name="chevron-forward" size={15} color="#ddd" />
                  </TouchableOpacity>
                );
              }}
              ListHeaderComponent={
                lieuxFiltres.length > 0 ? (
                  <Text style={{ color: '#aaa', fontSize: t(12), padding: 16, paddingBottom: 8 }}>
                    {lieuxFiltres.length} lieu{lieuxFiltres.length > 1 ? 'x' : ''}{positionUser ? ' · par distance' : ''}
                  </Text>
                ) : null
              }
              ListEmptyComponent={<View style={styles.vide}><Text style={{ color: '#aaa', fontSize: t(14) }}>Aucun lieu trouvé</Text></View>}
              contentContainerStyle={{ paddingBottom: 24 }}
              removeClippedSubviews maxToRenderPerBatch={15}
            />
          ) : (
            <View style={styles.vide}>
              <View style={styles.videIcone}><Ionicons name="map-outline" size={26} color="#aaa" /></View>
              <Text style={{ color: '#111', fontSize: t(16), fontWeight: '600', marginTop: 12 }}>Choisis une catégorie</Text>
              <Text style={{ color: '#aaa', fontSize: t(13), marginTop: 6, textAlign: 'center', lineHeight: 20 }}>
                Cinémas, salles de concert,{'\n'}musées, théâtres, marchés...
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── AGENDA ── */}
      {onglet === 'agenda' && (
        <>
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={15} color="#aaa" />
            <TextInput style={[styles.searchInput, { fontSize: t(14) }]} placeholder="Rechercher..." placeholderTextColor="#aaa" value={recherche} onChangeText={setRecherche} />
            {recherche.length > 0 && <TouchableOpacity onPress={() => setRecherche('')}><Ionicons name="close-circle" size={16} color="#aaa" /></TouchableOpacity>}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 48 }} contentContainerStyle={styles.filtresScroll}>
            {[
              { key: 'tous', label: 'Toutes dates' },
              { key: 'ce_soir', label: 'Ce soir' },
              { key: 'demain', label: 'Demain' },
              { key: 'ce_weekend', label: 'Week-end' },
              { key: 'date_precise', label: filtreDate === 'date_precise' ? datePrecise.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'Date précise' },
            ].map(f => (
              <TouchableOpacity key={f.key}
                style={[styles.filtrePill, filtreDate === f.key && styles.filtrePillActif]}
                onPress={() => { setFiltreDate(f.key); if (f.key === 'date_precise') setShowDatePicker(true); }}
              >
                <Text style={[styles.filtrePillTxt, { fontSize: t(12) }, filtreDate === f.key && { color: '#fff' }]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.filtrePill, filtreGratuit && { backgroundColor: '#DCFCE7', borderColor: '#22C55E' }]}
              onPress={() => setFiltreGratuit(v => !v)}
            >
              <Text style={[styles.filtrePillTxt, { fontSize: t(12) }, filtreGratuit && { color: '#15803D' }]}>Gratuit</Text>
            </TouchableOpacity>
          </ScrollView>

          {showDatePicker && (
            <DateTimePicker value={datePrecise} mode="date" minimumDate={new Date()}
              onChange={(e, d) => { setShowDatePicker(false); if (d) { setDatePrecise(d); setFiltreDate('date_precise'); } }} />
          )}

          <FlatList
            data={agendaFiltres}
            keyExtractor={item => `agenda_${item.id}`}
            refreshControl={<RefreshControl refreshing={refresh} onRefresh={onRefresh} tintColor="#aaa" />}
            renderItem={({ item }) => (
              <View style={styles.sectionBlock}>
                <CarteEvenementOfficiel item={item} t={t} onPress={allerDetailOfficiel} positionUser={positionUser} />
              </View>
            )}
            onEndReached={chargerPlus}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              chargementPlus ? (
                <Text style={{ color: '#aaa', fontSize: t(12), textAlign: 'center', padding: 16 }}>Chargement...</Text>
              ) : offsetRef.current >= totalOff && totalOff > 0 ? (
                <Text style={{ color: '#aaa', fontSize: t(12), textAlign: 'center', padding: 16 }}>{totalOff} événements</Text>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.vide}>
                <View style={styles.videIcone}><Ionicons name="calendar-outline" size={26} color="#aaa" /></View>
                <Text style={{ color: '#111', fontSize: t(15), fontWeight: '600', marginTop: 10 }}>Aucun événement</Text>
                <TouchableOpacity style={styles.effacerBtn} onPress={() => { setFiltreDate('tous'); setFiltreGratuit(false); setRecherche(''); }}>
                  <Text style={{ color: '#fff', fontSize: t(13), fontWeight: '500' }}>Effacer les filtres</Text>
                </TouchableOpacity>
              </View>
            }
            contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
            removeClippedSubviews maxToRenderPerBatch={10} windowSize={8} initialNumToRender={12}
          />
        </>
      )}

      {/* ── COMMUNAUTÉ ── */}
      {onglet === 'communaute' && (
        <>
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={15} color="#aaa" />
            <TextInput style={[styles.searchInput, { fontSize: t(14) }]} placeholder="Rechercher..." placeholderTextColor="#aaa" value={recherche} onChangeText={setRecherche} />
            {recherche.length > 0 && <TouchableOpacity onPress={() => setRecherche('')}><Ionicons name="close-circle" size={16} color="#aaa" /></TouchableOpacity>}
          </View>
          <FlatList
            data={communautairesFiltres}
            keyExtractor={item => `comm_${item.id}`}
            renderItem={({ item }) => (
              <View style={styles.sectionBlock}>
                <CarteEvenementCommunautaire item={item} t={t} positionUser={positionUser}
                  onPress={allerDetail} onVoirCarte={voirSurCarte}
                  CATEGORIES_COULEURS={CATEGORIES_COULEURS} CAT_ICONES={CAT_ICONES} />
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.vide}>
                <View style={styles.videIcone}><Ionicons name="people-outline" size={26} color="#aaa" /></View>
                <Text style={{ color: '#111', fontSize: t(15), fontWeight: '600', marginTop: 10 }}>Aucun événement communautaire</Text>
                <TouchableOpacity style={styles.effacerBtn} onPress={() => navigation.navigate('AjoutEvenement')}>
                  <Ionicons name="add" size={15} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: t(13), fontWeight: '500' }}>Créer un événement</Text>
                </TouchableOpacity>
              </View>
            }
            contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
            removeClippedSubviews maxToRenderPerBatch={10}
          />
        </>
      )}

      {storyViewerVisible && stories.length > 0 && (
        <Modal visible animationType="fade" statusBarTranslucent>
          <StoryViewer stories={stories} indexDepart={storiesIndex} onFermer={() => setStoryViewerVisible(false)}
            onVoirCarte={() => { setStoryViewerVisible(false); navigation.navigate('Carte'); }} navigation={navigation} />
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf8' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 58 : 20, paddingBottom: 8 },
  titre: { fontWeight: '700', color: '#111', letterSpacing: -0.5 },
  storyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#111', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  ongletsScroll: { flexGrow: 0 },
  ongletsContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 7 },
  onglet: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f0f0ee' },
  ongletActif: { backgroundColor: '#111' },
  ongletTxt: { fontWeight: '500', color: '#888' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f0f0ee', borderRadius: 13, padding: 11, marginHorizontal: 16, marginBottom: 8, marginTop: 4 },
  searchInput: { flex: 1, color: '#111' },
  switchModeBtn: { backgroundColor: '#f5f5f3', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  sectionBlock: { paddingHorizontal: 16, marginBottom: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, marginTop: 16 },
  sectionTitre: { fontWeight: '700', color: '#111', letterSpacing: -0.3 },
  storiesWrap: { borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.05)', marginBottom: 4 },
  creerStoryBanner: { flexDirection: 'row', alignItems: 'center', gap: 14, margin: 16, backgroundColor: '#f5f5f3', borderRadius: 16, padding: 14 },
  creerStoryIcone: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  catScroll: { maxHeight: 52 },
  catScrollContent: { gap: 8, paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center' },
  catPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, backgroundColor: '#fafaf8' },
  lieuCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, borderLeftWidth: 3, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.06)' },
  lieuIcone: { width: 42, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  evCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.06)', borderLeftWidth: 3, overflow: 'hidden', marginBottom: 0 },
  evCardInner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  evImage: { width: 52, height: 52, borderRadius: 12, flexShrink: 0 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  voirCarteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#EFF6FF', paddingVertical: 9, borderTopWidth: 0.5, borderTopColor: '#BFDBFE' },
  filtresScroll: { gap: 7, paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center' },
  filtrePill: { borderRadius: 20, paddingHorizontal: 13, paddingVertical: 7, backgroundColor: '#f0f0ee' },
  filtrePillActif: { backgroundColor: '#111' },
  filtrePillTxt: { fontWeight: '500', color: '#888' },
  filmCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.06)', padding: 14 },
  filmAffiche: { width: 58, height: 86, borderRadius: 10, flexShrink: 0 },
  cinemaligne: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 9, paddingBottom: 2, borderTopWidth: 0.5, borderTopColor: 'rgba(0,0,0,0.05)' },
  vide: { alignItems: 'center', justifyContent: 'center', padding: 40, flex: 1, minHeight: 300 },
  videIcone: { width: 56, height: 56, borderRadius: 17, backgroundColor: '#f0f0ee', alignItems: 'center', justifyContent: 'center' },
  effacerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#111', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, marginTop: 14 },
});