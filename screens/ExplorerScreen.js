import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  FlatList, Image, TextInput, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useCallback, memo } from 'react';
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

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const auj = new Date(); auj.setHours(0, 0, 0, 0);
  const dem = new Date(auj); dem.setDate(dem.getDate() + 1);
  if (d >= auj && d < dem) return `Auj. ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  if (d >= dem && d < new Date(dem.getTime() + 86400000)) return `Dem. ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const CarteEvenementOfficiel = memo(({ item, t, onPress }) => {
  const cat = CATEGORIES[item.categorie] || { claire: '#DBEAFE', forte: '#2563EB', texte: '#1E40AF', icone: 'calendar-outline' };
  return (
    <TouchableOpacity style={[styles.evCard, { borderLeftColor: cat.forte }]} onPress={() => onPress(item)} activeOpacity={0.7}>
      <View style={styles.evCardHaut}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.evImage} />
        ) : (
          <View style={[styles.evImagePlaceholder, { backgroundColor: cat.claire }]}>
            <Ionicons name={cat.icone?.replace('-outline', '') || 'calendar'} size={20} color={cat.forte} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#111', fontSize: t(14), fontWeight: '500', marginBottom: 3 }} numberOfLines={2}>{item.titre}</Text>
          {item.lieu && <Text style={{ color: '#888', fontSize: t(12), marginBottom: 3 }} numberOfLines={1}>{item.lieu}</Text>}
          {item.date_debut && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="calendar-outline" size={11} color={cat.forte} />
              <Text style={{ color: cat.forte, fontSize: t(11), fontWeight: '500' }}>{formatDate(item.date_debut)}</Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
            <View style={[styles.badge, { backgroundColor: cat.claire }]}>
              <Text style={{ color: cat.texte, fontSize: t(10), fontWeight: '500' }}>{item.categorie}</Text>
            </View>
            {item.gratuit && <View style={[styles.badge, { backgroundColor: '#DCFCE7' }]}><Text style={{ color: '#15803D', fontSize: t(10), fontWeight: '500' }}>Gratuit</Text></View>}
            {item.prix_min && <View style={[styles.badge, { backgroundColor: '#FEF3C7' }]}><Text style={{ color: '#92400E', fontSize: t(10) }}>Dès {item.prix_min}€</Text></View>}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={15} color={cat.forte} />
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
      <View style={styles.evCardHaut}>
        <View style={[styles.evImagePlaceholder, { backgroundColor: cat.claire }]}>
          <Ionicons name={CAT_ICONES[item.categorie] || 'construct-outline'} size={20} color={cat.forte} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#111', fontSize: t(14), fontWeight: '500', marginBottom: 3 }} numberOfLines={1}>{item.titre}</Text>
          {item.lieu && <Text style={{ color: '#888', fontSize: t(12), marginBottom: 3 }} numberOfLines={1}>{item.lieu}{dist !== null ? ` · ${dist} km` : ''}</Text>}
          {item.date_evenement && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="time-outline" size={11} color="#2563EB" />
              <Text style={{ color: '#2563EB', fontSize: t(11), fontWeight: '500' }}>{formatDate(item.date_evenement)}</Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 5, marginTop: 4 }}>
            <View style={[styles.badge, { backgroundColor: '#111' }]}>
              <Ionicons name="people-outline" size={9} color="#fff" />
              <Text style={{ color: '#fff', fontSize: t(9), fontWeight: '500' }}>Communautaire</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="people-outline" size={10} color="#15803D" />
              <Text style={{ color: '#15803D', fontSize: t(10) }}>{item.sans_max ? String(item.participants || 0) : `${item.participants || 0}/${item.max || '?'}`}</Text>
            </View>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={15} color="#bbb" />
      </View>
      <TouchableOpacity style={styles.voirCarteBtn} onPress={() => onVoirCarte(item)}>
        <Ionicons name="map-outline" size={14} color="#2563EB" />
        <Text style={{ color: '#2563EB', fontSize: t(12), fontWeight: '500' }}>Voir sur la carte</Text>
        <Ionicons name="arrow-forward" size={12} color="#2563EB" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

export default function ExplorerScreen({ navigation }) {
  const { evenements } = useEvenements();
  const { theme, facteurTexte, CATEGORIES_COULEURS, CAT_ICONES, setEvenementCible } = useApp();
  const t = (s) => s * facteurTexte;

  const [onglet, setOnglet] = useState('pourToi');
  const [recherche, setRecherche] = useState('');
  const [positionUser, setPositionUser] = useState(null);
  const [evenementsOfficiels, setEvenementsOfficiels] = useState([]);
  const [lieux, setLieux] = useState([]);
  const [stories, setStories] = useState([]);
  const [storyViewerVisible, setStoryViewerVisible] = useState(false);
  const [storiesSelectionnees, setStoriesSelectionnees] = useState([]);
  const [categorieActive, setCategorieActive] = useState(null);
  const [lieuxFiltres, setLieuxFiltres] = useState([]);
  const [rechercheLieu, setRechercheLieu] = useState('');
  const [rechercheFilm, setRechercheFilm] = useState('');
  const [modeRechercheFilm, setModeRechercheFilm] = useState(false);
  const [resultatsFilm, setResultatsFilm] = useState([]);
  const [filtreDate, setFiltreDate] = useState('tous');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePrecise, setDatePrecise] = useState(new Date());
  const [filtreGratuit, setFiltreGratuit] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setPositionUser({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      }
    })();
    chargerOfficiels();
    chargerLieux();
    chargerStories();
  }, []);

  const chargerOfficiels = async () => {
    try {
      const { data } = await supabase
        .from('evenements_officiels')
        .select('*')
        .eq('actif', true)
        .gte('date_debut', new Date().toISOString())
        .order('date_debut', { ascending: true })
        .limit(500);
      if (data) setEvenementsOfficiels(data);
    } catch {}
  };

  const chargerLieux = async () => {
    try {
      const { data } = await supabase
        .from('lieux_officiels')
        .select('*')
        .not('latitude', 'is', null)
        .order('nom', { ascending: true })
        .limit(1000);
      if (data) setLieux(data);
    } catch {}
  };

  // Sans jointure profiles pour éviter le bug RLS
  const chargerStories = async () => {
    try {
      const { data } = await supabase
        .from('stories')
        .select('*')
        .eq('actif', true)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) setStories(data);
    } catch {}
  };

  const rechercherFilm = useCallback(async (titre) => {
    if (!titre || titre.length < 2) { setResultatsFilm([]); return; }
    try {
      const { data } = await supabase
        .from('seances_cinema')
        .select('film_titre, cinema_nom, film_affiche, film_note, date_seance')
        .ilike('film_titre', `%${titre}%`)
        .gte('date_seance', new Date().toISOString())
        .order('date_seance', { ascending: true })
        .limit(100);
      if (data) {
        const filmsMap = {};
        data.forEach(s => {
          if (!filmsMap[s.film_titre]) {
            filmsMap[s.film_titre] = {
              titre: s.film_titre, affiche: s.film_affiche,
              note: s.film_note, cinemas: new Set(), prochaineSeance: s.date_seance,
            };
          }
          filmsMap[s.film_titre].cinemas.add(s.cinema_nom);
        });
        setResultatsFilm(Object.values(filmsMap).map(f => ({ ...f, cinemas: [...f.cinemas] })));
      }
    } catch {}
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => rechercherFilm(rechercheFilm), 400);
    return () => clearTimeout(timer);
  }, [rechercheFilm]);

  useEffect(() => {
    if (!categorieActive) { setLieuxFiltres([]); return; }
    const config = CATEGORIES_LIEUX.find(c => c.key === categorieActive);
    if (!config) return;
    let filtres = lieux.filter(l =>
      config.sousCats.some(sc => (l.sous_categorie || '').toLowerCase().includes(sc.toLowerCase()))
    );
    if (rechercheLieu.trim()) {
      filtres = filtres.filter(l =>
        l.nom?.toLowerCase().includes(rechercheLieu.toLowerCase()) ||
        l.adresse?.toLowerCase().includes(rechercheLieu.toLowerCase())
      );
    }
    setLieuxFiltres(filtres);
  }, [categorieActive, lieux, rechercheLieu]);

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

  const voirSurCarte = useCallback((ev) => { setEvenementCible(ev); navigation.navigate('Carte'); }, [navigation, setEvenementCible]);
  const allerDetailOfficiel = useCallback((ev) => navigation.navigate('DetailEvenementOfficiel', { evenement: ev }), [navigation]);
  const allerDetail = useCallback((ev) => navigation.navigate('DetailEvenement', { evenement: ev }), [navigation]);
  const allerDetailLieu = useCallback((lieu) => navigation.navigate('DetailLieu', { lieu }), [navigation]);

  const configActive = CATEGORIES_LIEUX.find(c => c.key === categorieActive);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Text style={[styles.titre, { color: theme.text }]}>Explorer</Text>
        <TouchableOpacity
          style={styles.creerStoryBtnHeader}
          onPress={() => navigation.navigate('CreerStory')}
        >
          <Ionicons name="camera" size={18} color="#fff" />
          <Text style={{ color: '#fff', fontSize: t(12), fontWeight: '600' }}>Story</Text>
        </TouchableOpacity>
      </View>

      {/* Onglets */}
      <View style={[styles.ongletsWrap, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ongletsScroll}>
          {[
            { key: 'pourToi',    label: '✨ Pour toi' },
            { key: 'lieux',      label: '🏛 Lieux' },
            { key: 'agenda',     label: '📅 Agenda' },
            { key: 'communaute', label: '👥 Communauté' },
          ].map(o => (
            <TouchableOpacity
              key={o.key}
              style={[styles.onglet, onglet === o.key && styles.ongletActif]}
              onPress={() => setOnglet(o.key)}
            >
              <Text style={[styles.ongletTexte, { color: onglet === o.key ? '#fff' : theme.text3, fontSize: t(13) }]}>
                {o.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── ONGLET POUR TOI ── */}
      {onglet === 'pourToi' && (
        <FlatList
          data={evenementsOfficiels.slice(0, 30)}
          keyExtractor={item => `off_${item.id}`}
          ListHeaderComponent={
            <>
              {/* Stories */}
              {stories.length > 0 ? (
                <View style={{ borderBottomWidth: 0.5, borderBottomColor: theme.border }}>
                  <StoriesBar
                    stories={stories}
                    onPress={(s) => { setStoriesSelectionnees(s); setStoryViewerVisible(true); }}
                    onCreer={() => navigation.navigate('CreerStory')}
                    t={t}
                  />
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.creerStoryBanner}
                  onPress={() => navigation.navigate('CreerStory')}
                >
                  <View style={styles.creerStoryBannerIcone}>
                    <Ionicons name="camera" size={22} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#111', fontSize: t(14), fontWeight: '600' }}>Partage ta story</Text>
                    <Text style={{ color: '#888', fontSize: t(12) }}>Photo ou vidéo — visible 24h</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#888" />
                </TouchableOpacity>
              )}

              {evenements.slice(0, 3).length > 0 && (
                <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 }}>
                  <View style={styles.sectionTitre}>
                    <Text style={{ color: theme.text, fontSize: t(16), fontWeight: '600' }}>Près de toi 👥</Text>
                    <TouchableOpacity onPress={() => setOnglet('communaute')}>
                      <Text style={{ color: '#2563EB', fontSize: t(12) }}>Voir tout</Text>
                    </TouchableOpacity>
                  </View>
                  {evenements.slice(0, 3).map(ev => (
                    <CarteEvenementCommunautaire
                      key={ev.id} item={ev} t={t}
                      positionUser={positionUser}
                      onPress={allerDetail} onVoirCarte={voirSurCarte}
                      CATEGORIES_COULEURS={CATEGORIES_COULEURS} CAT_ICONES={CAT_ICONES}
                    />
                  ))}
                </View>
              )}

              <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
                <View style={styles.sectionTitre}>
                  <Text style={{ color: theme.text, fontSize: t(16), fontWeight: '600' }}>À l'affiche 🎭</Text>
                  <TouchableOpacity onPress={() => setOnglet('agenda')}>
                    <Text style={{ color: '#2563EB', fontSize: t(12) }}>Voir tout</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          }
          renderItem={({ item }) => (
            <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
              <CarteEvenementOfficiel item={item} t={t} onPress={allerDetailOfficiel} />
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 20 }}
          removeClippedSubviews maxToRenderPerBatch={10} windowSize={10}
        />
      )}

      {/* ── ONGLET LIEUX ── */}
      {onglet === 'lieux' && (
        <View style={{ flex: 1 }}>
          {/* Catégories horizontales */}
          <View style={[styles.catsContainer, { borderBottomColor: theme.border }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catsScroll}>
              {CATEGORIES_LIEUX.map(cat => (
                <TouchableOpacity
                  key={cat.key}
                  style={[styles.catPill, {
                    backgroundColor: categorieActive === cat.key ? cat.couleur : theme.card,
                    borderColor: cat.couleur,
                  }]}
                  onPress={() => {
                    setCategorieActive(categorieActive === cat.key ? null : cat.key);
                    setRechercheLieu('');
                    setModeRechercheFilm(false);
                    setRechercheFilm('');
                  }}
                >
                  <Ionicons name={cat.icon} size={16} color={categorieActive === cat.key ? '#fff' : cat.couleur} />
                  <Text style={{ color: categorieActive === cat.key ? '#fff' : theme.text, fontSize: t(13), fontWeight: '500' }}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Recherche — film ou lieu */}
          {categorieActive && (
            <View style={[styles.searchWrap, { backgroundColor: theme.card, borderColor: modeRechercheFilm && categorieActive === 'cinema' ? '#9F1239' : theme.border }]}>
              <Ionicons name="search-outline" size={15} color={theme.text3} />
              <TextInput
                style={[styles.searchInput, { color: theme.text, fontSize: t(13) }]}
                placeholder={
                  categorieActive === 'cinema' && modeRechercheFilm
                    ? 'Cherche un film...'
                    : `Cherche un ${configActive?.label.toLowerCase() || 'lieu'}...`
                }
                placeholderTextColor={theme.text3}
                value={categorieActive === 'cinema' && modeRechercheFilm ? rechercheFilm : rechercheLieu}
                onChangeText={categorieActive === 'cinema' && modeRechercheFilm ? setRechercheFilm : setRechercheLieu}
              />
              {((categorieActive === 'cinema' && modeRechercheFilm ? rechercheFilm : rechercheLieu).length > 0) && (
                <TouchableOpacity onPress={() => { setRechercheFilm(''); setRechercheLieu(''); }}>
                  <Ionicons name="close-circle" size={15} color={theme.text3} />
                </TouchableOpacity>
              )}
              {categorieActive === 'cinema' && (
                <TouchableOpacity
                  style={[styles.switchModeBtn, { backgroundColor: modeRechercheFilm ? '#9F1239' : theme.bg }]}
                  onPress={() => { setModeRechercheFilm(v => !v); setRechercheFilm(''); setRechercheLieu(''); }}
                >
                  <Text style={{ color: modeRechercheFilm ? '#fff' : theme.text3, fontSize: t(10), fontWeight: '500' }}>
                    {modeRechercheFilm ? '🎬 Film' : '📍 Lieu'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Résultats recherche film */}
          {modeRechercheFilm && categorieActive === 'cinema' ? (
            <FlatList
              data={resultatsFilm}
              keyExtractor={(item, i) => `film_${i}`}
              renderItem={({ item }) => (
                <View style={[styles.filmRechercheCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <View style={{ flexDirection: 'row', gap: 12, marginBottom: 10 }}>
                    {item.affiche ? (
                      <Image source={{ uri: item.affiche }} style={styles.filmRechercheAffiche} resizeMode="cover" />
                    ) : (
                      <View style={[styles.filmRechercheAffiche, { backgroundColor: '#FFF1F2', alignItems: 'center', justifyContent: 'center' }]}>
                        <Ionicons name="film" size={24} color="#9F1239" />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.text, fontSize: t(15), fontWeight: '600', marginBottom: 4 }}>
                        {item.titre}
                      </Text>
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
                      <TouchableOpacity
                        key={i}
                        style={[styles.filmCinemaLigne, { borderTopColor: theme.border }]}
                        onPress={() => lieu && allerDetailLieu(lieu)}
                      >
                        <Ionicons name="location-outline" size={13} color="#9F1239" />
                        <Text style={{ color: theme.text, fontSize: t(13), flex: 1 }}>{cinema}</Text>
                        {lieu && <Ionicons name="chevron-forward" size={14} color="#9F1239" />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.vide}>
                  <Ionicons name={rechercheFilm.length > 1 ? 'film-outline' : 'search'} size={40} color={theme.text3} />
                  <Text style={{ color: theme.text, fontSize: t(15), fontWeight: '500', marginTop: 10 }}>
                    {rechercheFilm.length > 1 ? 'Aucun film trouvé' : 'Cherche un film'}
                  </Text>
                  <Text style={{ color: theme.text3, fontSize: t(13), marginTop: 4, textAlign: 'center' }}>
                    {rechercheFilm.length > 1 ? 'Essaie un autre titre' : 'Tape le titre pour voir dans quels cinémas il est projeté'}
                  </Text>
                </View>
              }
              contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 20 }}
            />
          ) : categorieActive ? (
            <FlatList
              data={lieuxFiltres}
              keyExtractor={item => `lieu_${item.id}`}
              renderItem={({ item }) => {
                const config = configActive || CATEGORIES_LIEUX[0];
                return (
                  <TouchableOpacity
                    style={[styles.lieuCard, { borderLeftColor: config.couleur }]}
                    onPress={() => allerDetailLieu(item)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.lieuIcone, { backgroundColor: config.bg }]}>
                      <Ionicons name={config.icon} size={20} color={config.couleur} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.text, fontSize: t(14), fontWeight: '500', marginBottom: 2 }} numberOfLines={1}>
                        {item.nom}
                      </Text>
                      {item.adresse && (
                        <Text style={{ color: '#888', fontSize: t(12) }} numberOfLines={1}>{item.adresse}</Text>
                      )}
                      {positionUser && item.latitude && (
                        <Text style={{ color: config.couleur, fontSize: t(11), marginTop: 2 }}>
                          {Math.round(distanceKm(positionUser.latitude, positionUser.longitude, parseFloat(item.latitude), parseFloat(item.longitude)) * 10) / 10} km
                        </Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={config.couleur} />
                  </TouchableOpacity>
                );
              }}
              ListHeaderComponent={
                lieuxFiltres.length > 0 ? (
                  <View style={[styles.sectionTitre, { paddingHorizontal: 0 }]}>
                    <Text style={{ color: theme.text, fontSize: t(15), fontWeight: '600' }}>
                      {configActive?.label} · {lieuxFiltres.length}
                    </Text>
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <View style={styles.vide}>
                  <Text style={{ color: theme.text3, fontSize: t(14) }}>Aucun lieu trouvé</Text>
                </View>
              }
              contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 20 }}
            />
          ) : (
            <View style={styles.vide}>
              <Ionicons name="map-outline" size={48} color={theme.text3} />
              <Text style={{ color: theme.text, fontSize: t(16), fontWeight: '600', marginTop: 12 }}>
                Choisis une catégorie
              </Text>
              <Text style={{ color: theme.text3, fontSize: t(13), marginTop: 6, textAlign: 'center', lineHeight: 20 }}>
                Cinémas, salles de concert, musées, théâtres, marchés...
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── ONGLET AGENDA ── */}
      {onglet === 'agenda' && (
        <>
          <View style={[styles.searchWrap, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons name="search-outline" size={15} color={theme.text3} />
            <TextInput
              style={[styles.searchInput, { color: theme.text, fontSize: t(14) }]}
              placeholder="Rechercher un événement..."
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
                <Text style={[styles.filtrePillTexte, { fontSize: t(12), color: filtreDate === f.key ? '#fff' : theme.text3 }]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.filtrePill, filtreGratuit && { backgroundColor: '#DCFCE7', borderColor: '#22C55E' }]}
              onPress={() => setFiltreGratuit(v => !v)}
            >
              <Text style={[styles.filtrePillTexte, { fontSize: t(12), color: filtreGratuit ? '#15803D' : theme.text3 }]}>Gratuit</Text>
            </TouchableOpacity>
          </ScrollView>

          {showDatePicker && (
            <DateTimePicker value={datePrecise} mode="date" minimumDate={new Date()}
              onChange={(e, d) => { setShowDatePicker(false); if (d) { setDatePrecise(d); setFiltreDate('date_precise'); } }} />
          )}

          <FlatList
            data={agendaFiltres}
            keyExtractor={item => `agenda_${item.id}`}
            renderItem={({ item }) => (
              <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
                <CarteEvenementOfficiel item={item} t={t} onPress={allerDetailOfficiel} />
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.vide}>
                <Ionicons name="calendar-outline" size={40} color={theme.text3} />
                <Text style={{ color: theme.text, fontSize: t(16), fontWeight: '500', marginTop: 12 }}>Aucun événement</Text>
                <TouchableOpacity
                  style={[styles.effacerBtn, { marginTop: 12 }]}
                  onPress={() => { setFiltreDate('tous'); setFiltreGratuit(false); setRecherche(''); }}
                >
                  <Text style={{ color: '#fff', fontSize: t(13), fontWeight: '500' }}>Effacer les filtres</Text>
                </TouchableOpacity>
              </View>
            }
            contentContainerStyle={{ paddingTop: 8, paddingBottom: 20 }}
            removeClippedSubviews maxToRenderPerBatch={10} windowSize={10}
          />
        </>
      )}

      {/* ── ONGLET COMMUNAUTÉ ── */}
      {onglet === 'communaute' && (
        <>
          <View style={[styles.searchWrap, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons name="search-outline" size={15} color={theme.text3} />
            <TextInput
              style={[styles.searchInput, { color: theme.text, fontSize: t(14) }]}
              placeholder="Rechercher un événement..."
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

          <FlatList
            data={communautairesFiltres}
            keyExtractor={item => `comm_${item.id}`}
            renderItem={({ item }) => (
              <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
                <CarteEvenementCommunautaire
                  item={item} t={t} positionUser={positionUser}
                  onPress={allerDetail} onVoirCarte={voirSurCarte}
                  CATEGORIES_COULEURS={CATEGORIES_COULEURS} CAT_ICONES={CAT_ICONES}
                />
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.vide}>
                <Ionicons name="people-outline" size={40} color={theme.text3} />
                <Text style={{ color: theme.text, fontSize: t(16), fontWeight: '500', marginTop: 12 }}>
                  Aucun événement communautaire
                </Text>
                <TouchableOpacity
                  style={[styles.effacerBtn, { marginTop: 12 }]}
                  onPress={() => navigation.navigate('AjoutEvenement')}
                >
                  <Ionicons name="add" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: t(13), fontWeight: '500' }}>Créer un événement</Text>
                </TouchableOpacity>
              </View>
            }
            contentContainerStyle={{ paddingTop: 8, paddingBottom: 20 }}
            removeClippedSubviews maxToRenderPerBatch={10}
          />
        </>
      )}

      {/* Story Viewer */}
      {storyViewerVisible && storiesSelectionnees.length > 0 && (
        <Modal visible animationType="fade" statusBarTranslucent>
          <StoryViewer
            stories={storiesSelectionnees}
            onFermer={() => setStoryViewerVisible(false)}
            onVoirCarte={() => { setStoryViewerVisible(false); navigation.navigate('Carte'); }}
            navigation={navigation}
          />
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 56, borderBottomWidth: 0.5 },
  titre: { fontSize: 22, fontWeight: '600' },
  creerStoryBtnHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#111', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  ongletsWrap: { borderBottomWidth: 0.5 },
  ongletsScroll: { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  onglet: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  ongletActif: { backgroundColor: '#111', borderColor: '#111' },
  ongletTexte: { fontWeight: '500' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, marginBottom: 6, borderRadius: 12, padding: 10, borderWidth: 0.5 },
  searchInput: { flex: 1 },
  switchModeBtn: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  sectionTitre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  creerStoryBanner: { flexDirection: 'row', alignItems: 'center', gap: 14, margin: 16, backgroundColor: '#F9FAFB', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  creerStoryBannerIcone: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  catsContainer: { borderBottomWidth: 0.5, paddingVertical: 8 },
  catsScroll: { gap: 8, paddingHorizontal: 16 },
  catPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
  lieuCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: '#E8E8E8', borderLeftWidth: 3, overflow: 'hidden' },
  lieuIcone: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  evCard: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 0.5, borderColor: '#E8E8E8', borderLeftWidth: 3, overflow: 'hidden', marginBottom: 0 },
  evCardHaut: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  evImage: { width: 52, height: 52, borderRadius: 10, flexShrink: 0 },
  evImagePlaceholder: { width: 52, height: 52, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 20, paddingHorizontal: 7, paddingVertical: 3 },
  voirCarteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#EFF6FF', paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: '#BFDBFE' },
  filtresScroll: { gap: 8, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  filtrePill: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#E5E7EB' },
  filtrePillActif: { backgroundColor: '#111', borderColor: '#111' },
  filtrePillTexte: { fontWeight: '500' },
  filmRechercheCard: { borderRadius: 16, borderWidth: 0.5, padding: 14 },
  filmRechercheAffiche: { width: 60, height: 90, borderRadius: 10, flexShrink: 0 },
  filmCinemaLigne: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10, paddingBottom: 2, borderTopWidth: 0.5 },
  vide: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 8, flex: 1, minHeight: 300 },
  effacerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#111', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
});