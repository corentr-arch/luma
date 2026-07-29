import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Linking, Image, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { useApp, CATEGORIES, formatDateParis } from '../AppContext';
import { supabase } from '../supabase';
import StoriesBar from '../components/StoriesBar';
import StoryViewer from '../components/StoryViewer';

const CODES_ALLOCINE = {
  'MK2 Bibliothèque':         'C2954',
  'MK2 Bastille':             'C0140',
  'MK2 Beaubourg':            'C0050',
  'MK2 Gambetta':             'C0192',
  'MK2 Nation':               'C0144',
  'MK2 Parnasse':             'C0099',
  'MK2 Odéon':                'C0092',
  'MK2 Quai de Seine':        'C0003',
  'MK2 Quai de Loire':        'C1621',
  'Mk2 Grand Palais':         'W7508',
  'Pathé La Villette':        'W7520',
  'Pathé Boulogne':           'B0247',
  'Pathé Convention':         'C0161',
  'Pathé Wepler':             'C0179',
  'Pathé Alésia':             'C0037',
  'Pathé Beaugrenelle':       'W7502',
  'Pathé Opéra Premier':      'C0060',
  'Gaumont Parnasse':         'C0158',
  'Gaumont Aquaboulevard':    'C0116',
  'UGC Ciné Cité Les Halles': 'C0159',
  'UGC Ciné Cité Bercy':      'C0026',
  'UGC Odéon':                'C0104',
  'UGC Montparnasse':         'C0103',
  'UGC Danton':               'C0102',
  'UGC Maillot':              'C0175',
  'UGC Gobelins':             'C0150',
  'UGC Rotonde':              'C0105',
  'Studio 28':                'C0061',
  'Le Balzac':                'C0009',
  'Cinémathèque Française':   'C1559',
  'Le Grand Rex':             'C0065',
  'Le Louxor':                'W7510',
  'Cinéma Le Champo':         'C0073',
  'Luminor Hôtel de Ville':   'C0013',
  'Forum des Images':         'C0119',
  'Le Brady':                 'C0023',
  'Cinéma Landowski':         'B0227',
};

export default function DetailLieu({ route, navigation }) {
  const { lieu } = route.params;
  const { theme, facteurTexte, profil } = useApp();
  const [evenements, setEvenements] = useState([]);
  const [filmsGroupes, setFilmsGroupes] = useState([]);
  const [filmSelectionne, setFilmSelectionne] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [stories, setStories] = useState([]);
  const [storyViewerVisible, setStoryViewerVisible] = useState(false);
  const [derniereMaj, setDerniereMaj] = useState(null);
  const t = (size) => size * facteurTexte;

  const estCinema = lieu.sous_categorie === 'Cinéma';
  const estSalleConcert = lieu.sous_categorie === 'Salle de concert' || lieu.sous_categorie === 'Théâtre musical';
  const estOpera = lieu.sous_categorie === 'Opéra';
  const estTheatre = lieu.sous_categorie === 'Théâtre';
  const estStade = lieu.sous_categorie === 'Stade';
  const estMusee = lieu.sous_categorie === 'Musée';

  const getConfig = () => {
    if (estCinema) return { couleur: '#9F1239', claire: '#FFF1F2', icone: 'film', label: 'Cinéma' };
    if (estSalleConcert) return { couleur: '#A855F7', claire: '#F3E8FF', icone: 'musical-notes', label: 'Salle de concert' };
    if (estOpera) return { couleur: '#7C3AED', claire: '#EDE9FE', icone: 'mic', label: 'Opéra' };
    if (estTheatre) return { couleur: '#4F46E5', claire: '#EEF2FF', icone: 'easel', label: 'Théâtre' };
    if (estStade) return { couleur: '#2563EB', claire: '#DBEAFE', icone: 'trophy', label: 'Stade' };
    if (estMusee) return { couleur: '#D97706', claire: '#FFFBEB', icone: 'image', label: 'Musée' };
    if (lieu.sous_categorie === 'Salle de sport') return { couleur: '#16A34A', claire: '#DCFCE7', icone: 'fitness', label: 'Salle de sport' };
    if (lieu.sous_categorie === 'Piscine') return { couleur: '#0EA5E9', claire: '#E0F2FE', icone: 'water', label: 'Piscine' };
    if (lieu.sous_categorie === 'Marché') return { couleur: '#EF4444', claire: '#FEE2E2', icone: 'storefront', label: 'Marché' };
    if (lieu.sous_categorie === 'Mairie') return { couleur: '#64748B', claire: '#F1F5F9', icone: 'business', label: 'Mairie' };
    return CATEGORIES[lieu.categorie] || { couleur: '#6B7280', claire: '#F3F4F6', icone: 'location', label: lieu.categorie };
  };

  const config = getConfig();

  const getUrlOfficiel = () => {
    if (lieu.url) return lieu.url;
    const nom = (lieu.nom || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (nom.includes('pathe') || nom.includes('gaumont')) return 'https://www.pathe.fr';
    if (nom.includes('ugc')) return 'https://www.ugc.fr';
    if (nom.includes('mk2')) return 'https://www.mk2.com';
    if (nom.includes('grand rex')) return 'https://www.legrandrex.com';
    if (nom.includes('louxor')) return 'https://www.cinemalouxor.fr';
    if (nom.includes('champo')) return 'https://www.lechampo.com';
    if (nom.includes('cinematheque')) return 'https://www.cinematheque.fr';
    if (nom.includes('forum des images')) return 'https://www.forumdesimages.fr';
    if (nom.includes('brady')) return 'https://www.cinemalebrady.fr';
    if (nom.includes('luminor')) return 'https://www.luminor-hoteldeville.com';
    if (nom.includes('landowski')) return 'https://www.cinemascope.fr';
    if (nom.includes('olympia')) return 'https://www.olympiahall.com/agenda/';
    if (nom.includes('bataclan')) return 'https://www.bataclan.fr/programmation/';
    if (nom.includes('cigale')) return 'https://www.lacigale.fr/programmation/';
    if (nom.includes('zenith') || nom.includes('zénith')) return 'https://www.zenith-paris.com/agenda/';
    if (nom.includes('accor arena')) return 'https://www.accor-arena.com/fr/agenda.html';
    if (nom.includes('seine musicale')) return 'https://www.laseinemusicale.com/programmation/';
    if (nom.includes('philharmonie')) return 'https://philharmoniedeparis.fr/fr/agenda';
    if (nom.includes('opera') || nom.includes('opéra')) return 'https://www.operadeparis.fr/saison/agenda';
    if (nom.includes('chatelet') || nom.includes('châtelet')) return 'https://www.chatelet.com/saison/';
    if (nom.includes('comedie') || nom.includes('comédie')) return 'https://www.comedie-francaise.fr/fr/agenda';
    if (nom.includes('trianon')) return 'https://www.letrianon.fr/programmation/';
    if (nom.includes('maroquinerie')) return 'https://www.lamaroquinerie.fr/programmation/';
    if (nom.includes('bellevilloise')) return 'https://www.labellevilloise.com/agenda/';
    if (nom.includes('casino de paris')) return 'https://www.casinodeparis.fr/programmation/';
    if (nom.includes('petit bain')) return 'https://www.petitbain.org/programme/';
    if (nom.includes('trabendo')) return 'https://www.trabendo.fr/programmation/';
    if (nom.includes('glazart')) return 'https://www.glazart.com/agenda/';
    if (nom.includes('parc des princes')) return 'https://www.psg.fr/matches';
    if (nom.includes('stade de france')) return 'https://www.stadefrance.com/agenda';
    if (nom.includes('pleyel')) return 'https://www.sallepleyel.fr/fr/agenda';
    if (nom.includes('supersonic')) return 'https://www.supersonic-paris.fr/agenda/';
    return null;
  };

  const getUrlAllocine = () => {
    const code = CODES_ALLOCINE[lieu.nom];
    if (code) return `https://www.allocine.fr/seance/salle_gen_csalle=${code}.html`;
    return `https://www.allocine.fr/recherche/?q=${encodeURIComponent(lieu.nom)}`;
  };

  const getLabelBouton = () => {
    if (estCinema) return 'Toutes les séances sur Allociné';
    if (estSalleConcert || estOpera) return 'Voir la programmation complète';
    if (estTheatre) return 'Voir le programme complet';
    if (estStade) return 'Voir le calendrier';
    if (estMusee) return 'Voir les expositions';
    return 'Voir le site officiel';
  };

  useEffect(() => { chargerDonnees(); }, [lieu.id]);

  const chargerDonnees = async () => {
    setChargement(true);
    setFilmsGroupes([]);
    setEvenements([]);
    setStories([]);
    await Promise.all([
      estCinema ? chargerSeances() : chargerEvenements(),
      chargerStoriesLieu(),
    ]);
    setChargement(false);
  };

  // Lecture depuis la table seances_cinema (mise à jour hebdomadaire)
  const chargerSeances = async () => {
    try {
      const { data } = await supabase
        .from('seances_cinema')
        .select('*')
        .eq('cinema_nom', lieu.nom)
        .gte('date_seance', new Date().toISOString())
        .order('date_seance', { ascending: true });

      if (data && data.length > 0) {
        const filmsMap = {};
        data.forEach(s => {
          if (!filmsMap[s.film_titre]) {
            filmsMap[s.film_titre] = {
              titre: s.film_titre,
              affiche: s.film_affiche,
              synopsis: s.film_synopsis,
              duree: s.film_duree,
              genre: s.film_genre,
              note: s.film_note,
              annee: s.film_annee,
              seances: [],
            };
          }
          filmsMap[s.film_titre].seances.push({
            date: s.date_seance,
            version: s.version,
            salle: s.salle,
          });
        });
        setFilmsGroupes(Object.values(filmsMap));
        if (data[0]?.created_at) setDerniereMaj(data[0].created_at);
      }
    } catch {}
  };

  const chargerEvenements = async () => {
    const maintenant = new Date().toISOString();
    const nom = lieu.nom.replace(/[%_]/g, '\\$&').slice(0, 30);
    const { data } = await supabase
      .from('evenements_officiels')
      .select('*')
      .eq('actif', true)
      .gte('date_debut', maintenant)
      .or([`lieu_id.eq.${lieu.id}`, `salle.ilike.%${nom}%`, `lieu.ilike.%${nom}%`, `adresse.ilike.%${nom}%`].join(','))
      .order('date_debut', { ascending: true })
      .limit(30);
    if (data) setEvenements(data);
  };

  const chargerStoriesLieu = async () => {
    try {
      const { data } = await supabase
        .from('stories').select('*').eq('actif', true).eq('lieu_id', lieu.id)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false }).limit(20);
      if (data) setStories(data);
    } catch {}
  };

  const formatHeure = (dateStr) =>
    new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });

  const formatJour = (dateStr) => {
    const d = new Date(dateStr);
    const auj = new Date(); auj.setHours(0, 0, 0, 0);
    const dem = new Date(auj); dem.setDate(dem.getDate() + 1);
    if (d >= auj && d < dem) return "Aujourd'hui";
    if (d >= dem && d < new Date(dem.getTime() + 86400000)) return 'Demain';
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });
  };

  const formatDuree = (minutes) => {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${String(m).padStart(2, '0')}`;
};

  const formatMaj = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' });
  };

  const seancesParJour = (seancesFilm) => {
    const groupes = {};
    seancesFilm.forEach(s => {
      const jour = formatJour(s.date);
      if (!groupes[jour]) groupes[jour] = [];
      groupes[jour].push(s);
    });
    return Object.entries(groupes);
  };

  const urlOfficiel = getUrlOfficiel();

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          onPress={() => { if (filmSelectionne) setFilmSelectionne(null); else navigation.goBack(); }}
          style={{ width: 36 }}
        >
          <Ionicons name="chevron-back" size={22} color={config.couleur} />
        </TouchableOpacity>
        <Text style={[styles.headerTitre, { color: theme.text, fontSize: t(16) }]} numberOfLines={1}>
          {filmSelectionne ? filmSelectionne.titre : lieu.nom}
        </Text>
        <TouchableOpacity
          style={{ width: 36, alignItems: 'flex-end' }}
          onPress={() => navigation.navigate('CreerStory', { lieu })}
        >
          <Ionicons name="camera-outline" size={22} color={config.couleur} />
        </TouchableOpacity>
      </View>

      {filmSelectionne ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={styles.filmHero}>
            {filmSelectionne.affiche ? (
              <Image source={{ uri: filmSelectionne.affiche }} style={styles.filmAffiche} resizeMode="cover" />
            ) : (
              <View style={[styles.filmAffiche, { backgroundColor: config.claire, alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="film" size={40} color={config.couleur} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.filmTitre, { color: theme.text }]}>{filmSelectionne.titre}</Text>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {filmSelectionne.annee && (
                  <View style={[styles.badge, { backgroundColor: config.claire }]}>
                    <Text style={{ color: config.couleur, fontSize: t(11) }}>{filmSelectionne.annee}</Text>
                  </View>
                )}
                {filmSelectionne.duree && (
                  <View style={[styles.badge, { backgroundColor: '#F5F5F5' }]}>
                    <Ionicons name="time-outline" size={11} color="#666" />
                    <Text style={{ color: '#666', fontSize: t(11) }}>{formatDuree(filmSelectionne.duree)}</Text>
                  </View>
                )}
                {filmSelectionne.note && (
                  <View style={[styles.badge, { backgroundColor: '#FEF3C7' }]}>
                    <Ionicons name="star" size={11} color="#F59E0B" />
                    <Text style={{ color: '#92400E', fontSize: t(11), fontWeight: '500' }}>
                      {Math.round(filmSelectionne.note * 10) / 10}/5
                    </Text>
                  </View>
                )}
              </View>
              {filmSelectionne.genre && (
                <Text style={{ color: '#888', fontSize: t(12), marginTop: 6, lineHeight: 18 }}>
                  {filmSelectionne.genre}
                </Text>
              )}
            </View>
          </View>

          {filmSelectionne.synopsis && (
            <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
              <Text style={{ color: theme.text2, fontSize: t(14), lineHeight: 22 }}>
                {filmSelectionne.synopsis}
              </Text>
            </View>
          )}

          <View style={{ paddingHorizontal: 16 }}>
            <Text style={{ color: theme.text, fontSize: t(17), fontWeight: '500', marginBottom: 16 }}>
              Séances à {lieu.nom}
            </Text>
            {seancesParJour(filmSelectionne.seances).map(([jour, seancesDuJour]) => (
              <View key={jour} style={{ marginBottom: 20 }}>
                <Text style={[styles.jourLabel, { color: theme.text3 }]}>{jour}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {seancesDuJour.map((s, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[styles.seanceBulle, { borderColor: config.couleur }]}
                      onPress={() => Linking.openURL(getUrlAllocine())}
                    >
                      <Text style={{ color: config.couleur, fontSize: t(15), fontWeight: '600' }}>
                        {formatHeure(s.date)}
                      </Text>
                      {s.version && s.version !== 'VF' && (
                        <Text style={{ color: '#888', fontSize: t(10), marginTop: 2 }}>{s.version}</Text>
                      )}
                      {s.salle && (
                        <Text style={{ color: '#bbb', fontSize: t(9), marginTop: 1 }}>{s.salle}</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </View>

          <View style={{ paddingHorizontal: 16, marginTop: 8, gap: 10 }}>
            <TouchableOpacity
              style={[styles.btnPrincipal, { backgroundColor: config.couleur }]}
              onPress={() => Linking.openURL(getUrlAllocine())}
            >
              <Ionicons name="ticket-outline" size={18} color="#fff" />
              <Text style={{ color: '#fff', fontSize: t(15), fontWeight: '600' }}>Réserver sur Allociné</Text>
              <Ionicons name="open-outline" size={14} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
            {urlOfficiel && (
              <TouchableOpacity
                style={[styles.btnSecondaire, { borderColor: config.couleur }]}
                onPress={() => Linking.openURL(urlOfficiel)}
              >
                <Ionicons name="globe-outline" size={16} color={config.couleur} />
                <Text style={{ color: config.couleur, fontSize: t(13), fontWeight: '500' }}>Site officiel</Text>
                <Ionicons name="open-outline" size={14} color={config.couleur} />
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>

      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={[styles.bandeau, { backgroundColor: config.couleur }]}>
            <Ionicons name={config.icone} size={15} color="#fff" />
            <Text style={{ color: '#fff', fontSize: t(13), fontWeight: '600', letterSpacing: 0.5 }}>
              {lieu.sous_categorie || lieu.categorie}
            </Text>
          </View>

          {stories.length > 0 && (
            <View style={{ borderBottomWidth: 0.5, borderBottomColor: theme.border }}>
              <StoriesBar
                stories={stories}
                onPress={() => setStoryViewerVisible(true)}
                onCreer={() => navigation.navigate('CreerStory', { lieu })}
                t={t}
              />
            </View>
          )}

          <View style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {lieu.adresse && (
              <TouchableOpacity
                style={styles.infoLigne}
                onPress={() => Linking.openURL(`https://maps.apple.com/?q=${encodeURIComponent(lieu.nom)}&ll=${lieu.latitude},${lieu.longitude}`)}
              >
                <View style={[styles.infoIcone, { backgroundColor: config.couleur + '15' }]}>
                  <Ionicons name="location-outline" size={16} color={config.couleur} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text3, fontSize: t(11), marginBottom: 2 }}>Adresse</Text>
                  <Text style={{ color: theme.text, fontSize: t(14) }}>{lieu.adresse}</Text>
                </View>
                <Ionicons name="map-outline" size={15} color={config.couleur} />
              </TouchableOpacity>
            )}
            {lieu.telephone && (
              <>
                <View style={[styles.sep, { backgroundColor: theme.border }]} />
                <TouchableOpacity style={styles.infoLigne} onPress={() => Linking.openURL(`tel:${lieu.telephone}`)}>
                  <View style={[styles.infoIcone, { backgroundColor: '#F5F5F5' }]}>
                    <Ionicons name="call-outline" size={16} color={theme.text3} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text3, fontSize: t(11), marginBottom: 2 }}>Téléphone</Text>
                    <Text style={{ color: config.couleur, fontSize: t(14) }}>{lieu.telephone}</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}
          </View>

          <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
            <TouchableOpacity
              style={[styles.btnSecondaire, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => Linking.openURL(`https://maps.apple.com/?q=${encodeURIComponent(lieu.nom)}&ll=${lieu.latitude},${lieu.longitude}`)}
            >
              <Ionicons name="map-outline" size={16} color="#2563EB" />
              <Text style={{ color: '#2563EB', fontSize: t(13), fontWeight: '500' }}>Ouvrir dans Plans</Text>
            </TouchableOpacity>
          </View>

          {estCinema && (
            <View style={{ paddingHorizontal: 16 }}>
              <View style={styles.sectionTitre}>
                <View>
                  <Text style={{ color: theme.text, fontSize: t(17), fontWeight: '500' }}>
                    {chargement ? 'Chargement...' : filmsGroupes.length > 0 ? `${filmsGroupes.length} film${filmsGroupes.length > 1 ? 's' : ''} à l'affiche` : 'Programme'}
                  </Text>
                  {derniereMaj && (
                    <Text style={{ color: theme.text3, fontSize: t(10), marginTop: 2 }}>
                      Mis à jour le {formatMaj(derniereMaj)}
                    </Text>
                  )}
                </View>
                {!chargement && filmsGroupes.length > 0 && (
                  <TouchableOpacity onPress={() => Linking.openURL(getUrlAllocine())}>
                    <Text style={{ color: config.couleur, fontSize: t(12) }}>Allociné ↗</Text>
                  </TouchableOpacity>
                )}
              </View>

              {chargement ? (
                <View style={[styles.vide, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Ionicons name="film-outline" size={28} color={config.couleur} />
                  <Text style={{ color: theme.text3, fontSize: t(13), marginTop: 8 }}>Chargement...</Text>
                </View>
              ) : filmsGroupes.length === 0 ? (
                <View style={[styles.vide, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Ionicons name="film-outline" size={28} color={theme.text3} />
                  <Text style={{ color: theme.text, fontSize: t(15), fontWeight: '500', marginTop: 8, textAlign: 'center' }}>
                    Aucune séance disponible
                  </Text>
                  <Text style={{ color: theme.text3, fontSize: t(12), marginTop: 4, textAlign: 'center' }}>
                    Programmation mise à jour chaque semaine
                  </Text>
                  <TouchableOpacity
                    style={[styles.btnPrincipal, { backgroundColor: config.couleur, marginTop: 12 }]}
                    onPress={() => Linking.openURL(urlOfficiel || getUrlAllocine())}
                  >
                    <Text style={{ color: '#fff', fontSize: t(13), fontWeight: '500' }}>Voir sur Allociné</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={styles.filmsGrille}>
                    {filmsGroupes.map((film, i) => (
                      <TouchableOpacity key={i} style={styles.filmCard} onPress={() => setFilmSelectionne(film)} activeOpacity={0.85}>
                        {film.affiche ? (
                          <Image source={{ uri: film.affiche }} style={styles.filmCardAffiche} resizeMode="cover" />
                        ) : (
                          <View style={[styles.filmCardAffiche, { backgroundColor: config.claire, alignItems: 'center', justifyContent: 'center' }]}>
                            <Ionicons name="film" size={32} color={config.couleur} />
                          </View>
                        )}
                        <View style={styles.filmCardInfos}>
                          <Text style={{ color: theme.text, fontSize: t(12), fontWeight: '500', lineHeight: 16 }} numberOfLines={2}>
                            {film.titre}
                          </Text>
                          {film.note && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 }}>
                              <Ionicons name="star" size={10} color="#F59E0B" />
                              <Text style={{ color: '#888', fontSize: t(10) }}>{Math.round(film.note * 10) / 10}/5</Text>
                            </View>
                          )}
                          <Text style={{ color: config.couleur, fontSize: t(11), marginTop: 4, fontWeight: '500' }}>
                            {film.seances.length} séance{film.seances.length > 1 ? 's' : ''}
                          </Text>
                          <Text style={{ color: '#888', fontSize: t(10), marginTop: 2 }}>
                            {formatJour(film.seances[0].date) === "Aujourd'hui" ? "Auj." : formatJour(film.seances[0].date).slice(0, 8)} · {formatHeure(film.seances[0].date)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity
                    style={[styles.btnSecondaire, { borderColor: config.couleur, marginTop: 12 }]}
                    onPress={() => Linking.openURL(getUrlAllocine())}
                  >
                    <Ionicons name="film-outline" size={16} color={config.couleur} />
                    <Text style={{ color: config.couleur, fontSize: t(13), fontWeight: '500' }}>Toutes les séances sur Allociné</Text>
                    <Ionicons name="open-outline" size={14} color={config.couleur} />
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {!estCinema && (
            <View style={{ paddingHorizontal: 16 }}>
              <View style={styles.sectionTitre}>
                <Text style={{ color: theme.text, fontSize: t(17), fontWeight: '500' }}>
                  {estSalleConcert ? 'Programmation' : estTheatre ? "À l'affiche" : estOpera ? 'Programmation' : estStade ? 'Calendrier' : estMusee ? 'Expositions & événements' : 'Événements'}
                </Text>
                {evenements.length > 0 && (
                  <View style={[styles.badgeCount, { backgroundColor: config.claire }]}>
                    <Text style={{ color: config.couleur, fontSize: t(11), fontWeight: '500' }}>{evenements.length}</Text>
                  </View>
                )}
              </View>

              {chargement ? (
                <View style={[styles.vide, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Ionicons name={config.icone} size={28} color={config.couleur} />
                  <Text style={{ color: theme.text3, fontSize: t(13), marginTop: 8 }}>Chargement...</Text>
                </View>
              ) : evenements.length === 0 ? (
                <View style={[styles.vide, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Ionicons name="calendar-outline" size={28} color={theme.text3} />
                  <Text style={{ color: theme.text, fontSize: t(15), fontWeight: '500', marginTop: 8, textAlign: 'center' }}>
                    Aucun événement dans Luma
                  </Text>
                  {urlOfficiel && (
                    <Text style={{ color: theme.text3, fontSize: t(12), marginTop: 4, textAlign: 'center', lineHeight: 18 }}>
                      Consulte le site officiel pour la programmation complète
                    </Text>
                  )}
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  {evenements.map(ev => {
                    const catEv = CATEGORIES[ev.categorie] || CATEGORIES['Art'];
                    return (
                      <TouchableOpacity
                        key={ev.id}
                        style={[styles.evCard, { backgroundColor: theme.card, borderColor: theme.border, borderLeftWidth: 3, borderLeftColor: config.couleur }]}
                        onPress={() => navigation.navigate('DetailEvenementOfficiel', { evenement: ev })}
                        activeOpacity={0.7}
                      >
                        <View style={{ flexDirection: 'row', gap: 12, padding: 12 }}>
                          {ev.image_url ? (
                            <Image source={{ uri: ev.image_url }} style={styles.evImage} />
                          ) : (
                            <View style={[styles.evImagePlaceholder, { backgroundColor: config.claire }]}>
                              <Ionicons name={config.icone} size={22} color={config.couleur} />
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: theme.text, fontSize: t(14), fontWeight: '500', marginBottom: 4 }} numberOfLines={2}>
                              {ev.titre}
                            </Text>
                            {ev.date_debut && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                                <Ionicons name="calendar-outline" size={12} color={config.couleur} />
                                <Text style={{ color: config.couleur, fontSize: t(12), fontWeight: '500' }}>
                                  {formatDateParis(ev.date_debut)}
                                </Text>
                              </View>
                            )}
                            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                              {ev.categorie && (
                                <View style={[styles.tag, { backgroundColor: catEv.claire }]}>
                                  <Text style={{ color: catEv.texte, fontSize: t(10), fontWeight: '500' }}>{ev.categorie}</Text>
                                </View>
                              )}
                              {ev.gratuit && (
                                <View style={[styles.tag, { backgroundColor: '#DCFCE7' }]}>
                                  <Text style={{ color: '#15803D', fontSize: t(10), fontWeight: '500' }}>Gratuit</Text>
                                </View>
                              )}
                              {ev.prix_min && (
                                <View style={[styles.tag, { backgroundColor: '#FEF3C7' }]}>
                                  <Text style={{ color: '#92400E', fontSize: t(10) }}>Dès {ev.prix_min}€</Text>
                                </View>
                              )}
                            </View>
                          </View>
                          <Ionicons name="chevron-forward" size={15} color={config.couleur} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {urlOfficiel && (
                <TouchableOpacity
                  style={[styles.btnPrincipal, { backgroundColor: config.couleur, marginTop: 16 }]}
                  onPress={() => Linking.openURL(urlOfficiel)}
                >
                  <Ionicons name={estSalleConcert ? 'musical-notes-outline' : estTheatre ? 'easel-outline' : estOpera ? 'mic-outline' : estStade ? 'trophy-outline' : estMusee ? 'image-outline' : 'globe-outline'} size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: t(15), fontWeight: '600' }}>{getLabelBouton()}</Text>
                  <Ionicons name="open-outline" size={14} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
            <TouchableOpacity
              style={[styles.btnStory, { borderColor: config.couleur }]}
              onPress={() => navigation.navigate('CreerStory', { lieu })}
            >
              <Ionicons name="camera-outline" size={18} color={config.couleur} />
              <Text style={{ color: config.couleur, fontSize: t(14), fontWeight: '500' }}>Partager une story ici</Text>
            </TouchableOpacity>
          </View>

          <View style={{ paddingHorizontal: 16, marginTop: 10 }}>
            <TouchableOpacity
              style={[styles.btnCreer, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => navigation.navigate('AjoutEvenement')}
            >
              <Ionicons name="add-circle-outline" size={18} color={theme.text3} />
              <Text style={{ color: theme.text3, fontSize: t(14) }}>Créer un événement ici</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {storyViewerVisible && stories.length > 0 && (
        <Modal visible animationType="fade" statusBarTranslucent>
          <StoryViewer
            stories={stories}
            onFermer={() => setStoryViewerVisible(false)}
            onStoryDeleted={(id) => setStories(prev => prev.filter(s => s.id !== id))}
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, paddingTop: 56, borderBottomWidth: 0.5 },
  headerTitre: { flex: 1, fontWeight: '500', textAlign: 'center' },
  bandeau: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, paddingHorizontal: 16 },
  infoCard: { margin: 16, marginBottom: 12, borderRadius: 16, borderWidth: 0.5, padding: 4 },
  infoLigne: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 12 },
  infoIcone: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sep: { height: 0.5, marginHorizontal: 12 },
  sectionTitre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  badgeCount: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  filmsGrille: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  filmCard: { width: '47%', borderRadius: 12, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 0.5, borderColor: '#E8E8E8' },
  filmCardAffiche: { width: '100%', height: 180 },
  filmCardInfos: { padding: 10 },
  filmHero: { flexDirection: 'row', gap: 14, padding: 16, paddingBottom: 12 },
  filmAffiche: { width: 100, height: 150, borderRadius: 12 },
  filmTitre: { fontSize: 18, fontWeight: '600', letterSpacing: -0.3, lineHeight: 24 },
  jourLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  seanceBulle: { borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', minWidth: 72 },
  evCard: { borderRadius: 14, borderWidth: 0.5, overflow: 'hidden' },
  evImage: { width: 64, height: 64, borderRadius: 10, flexShrink: 0 },
  evImagePlaceholder: { width: 64, height: 64, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  tag: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  vide: { borderRadius: 16, borderWidth: 0.5, padding: 32, alignItems: 'center' },
  btnPrincipal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 14, padding: 16 },
  btnSecondaire: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, padding: 12, borderWidth: 0.5 },
  btnStory: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, padding: 14, borderWidth: 1.5 },
  btnCreer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, padding: 14, borderWidth: 0.5 },
});