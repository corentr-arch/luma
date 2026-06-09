import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const AppContext = createContext();

// Catégories unifiées — lieux ET événements
export const CATEGORIES = {
  'Sport':              { forte: '#2563EB', claire: '#DBEAFE', texte: '#1E40AF', icone: 'football-outline' },
  'Musique':            { forte: '#A855F7', claire: '#F3E8FF', texte: '#7E22CE', icone: 'musical-notes-outline' },
  'Apéro':              { forte: '#F59E0B', claire: '#FEF3C7', texte: '#92400E', icone: 'wine-outline' },
  'Entraide':           { forte: '#22C55E', claire: '#DCFCE7', texte: '#15803D', icone: 'heart-outline' },
  'Art':                { forte: '#EC4899', claire: '#FCE7F3', texte: '#9D174D', icone: 'color-palette-outline' },
  'Théâtre':            { forte: '#4F46E5', claire: '#EEF2FF', texte: '#3730A3', icone: 'easel-outline' },
  'Cinéma':             { forte: '#9F1239', claire: '#FFF1F2', texte: '#881337', icone: 'film-outline' },
  'Marché':             { forte: '#EF4444', claire: '#FEE2E2', texte: '#991B1B', icone: 'storefront-outline' },
  'Nature & Bien-être': { forte: '#10B981', claire: '#D1FAE5', texte: '#065F46', icone: 'leaf-outline' },
  'Famille':            { forte: '#F97316', claire: '#FFEDD5', texte: '#9A3412', icone: 'people-outline' },
  'Cours':              { forte: '#6366F1', claire: '#EEF2FF', texte: '#3730A3', icone: 'school-outline' },
  'Gaming':             { forte: '#7C3AED', claire: '#EDE9FE', texte: '#5B21B6', icone: 'game-controller-outline' },
};

// Mapping événements officiels → catégorie unifiée
export function mappingCategorie(tags, titre, description, lieu) {
  const tout = [
    ...(Array.isArray(tags) ? tags : [String(tags || '')]),
    titre || '', description || '', lieu || '',
  ].join(' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Gaming — très spécifique
  if (tout.match(/\b(esport|gaming|jeux.video|game.controller|nintendo|playstation|xbox|twitch|streamer|tournoi.gaming)\b/)) return 'Gaming';

  // Cinéma
  if (tout.match(/\b(cinema|ugc|mk2|pathe|gaumont|louxor|film|projection|seance|avant.premiere|cine.club|cinematheque|pellicule)\b/)) return 'Cinéma';

  // Théâtre
  if (tout.match(/\b(theatre|comedie.francaise|odeon|piece.de.theatre|mise.en.scene|dramaturgie|comedie|humour|stand.up|one.man.show|sketch|cirque|acrobat|danse|ballet|opera|lyrique)\b/)) return 'Théâtre';

  // Musique
  if (tout.match(/\b(concert|festival|jazz|blues|rock|metal|pop|electro|rap|rnb|hip.hop|folk|classique|orchestre|symphonie|philharmonie|chanson|live.music|dj.set|musique)\b/)) return 'Musique';

  // Sport
  if (tout.match(/\b(sport|fitness|yoga|pilates|running|marathon|match|tournoi|championnat|competition|natation|tennis|foot|rugby|basket|volley|escalade|boxe|judo|karate|gym|zumba|musculation|randonnee)\b/)) return 'Sport';

  // Nature & Bien-être
  if (tout.match(/\b(nature|jardin|jardinage|botanique|plantes|environnement|ecologie|meditation|sophrologie|relaxation|bien.etre|balade.nature|foret|parc)\b/)) return 'Nature & Bien-être';

  // Famille
  if (tout.match(/\b(enfant|famille|kids|jeunesse|bebe|conte|animation.enfant|spectacle.jeunesse|eveil|scolaire|parent)\b/)) return 'Famille';

  // Marché
  if (tout.match(/\b(marche|brocante|vide.grenier|salon|foire|braderie|puces|artisanat)\b/)) return 'Marché';

  // Entraide
  if (tout.match(/\b(solidarite|benevol|entraide|humanitaire|social|don|collecte|association|citoyen)\b/)) return 'Entraide';

  // Cours
  if (tout.match(/\b(conference|debat|atelier|workshop|masterclass|formation|cours|initiation|stage|visite.guidee|lecture|librairie|livre|litterature|patrimoine|histoire|architecture|poesie|slam)\b/)) return 'Cours';

  // Art — tout le reste culturel
  if (tout.match(/\b(exposition|expo|galerie|vernissage|art|peinture|sculpture|photo|street.art|installation|musee|collection)\b/)) return 'Art';

  return 'Art'; // fallback
}

// Formate la date en heure Paris — corrige le décalage UTC
export function formatDateParis(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;

    // Heure UTC 00:00 = pas d'heure définie dans l'API QFP → affiche juste la date
    const heureUTC = d.getUTCHours();
    const minutesUTC = d.getUTCMinutes();
    const pasDheure = heureUTC === 0 && minutesUTC === 0;

    if (pasDheure) {
      return d.toLocaleDateString('fr-FR', {
        weekday: 'short', day: 'numeric', month: 'short',
        timeZone: 'Europe/Paris',
      });
    }

    return d.toLocaleDateString('fr-FR', {
      weekday: 'short', day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'Europe/Paris',
    });
  } catch { return null; }
}

const REGLAGES_KEY = 'luma_reglages_v1';

export function AppProvider({ children }) {
  const [modeSombre, setModeSombreState] = useState(false);
  const [tailleTexte, setTailleTexteState] = useState('normale');
  const [daltonien, setDaltonienState] = useState(false);
  const [rayonDefaut, setRayonDefautState] = useState(null);
  const [animationsReduites, setAnimationsReduitesState] = useState(false);
  const [visibiliteDefaut, setVisibiliteDefautState] = useState('public');
  const [utilisateursBlockes, setUtilisateursBlockes] = useState([]);
  const [favoris, setFavoris] = useState([]);
  const [profil, setProfil] = useState(null);
  const [notifications, setNotificationsState] = useState({
    proximite: true, commentaires: true, places: false,
  });
  const [reglagesCharges, setReglagesCharges] = useState(false);
  const [evenementCible, setEvenementCible] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const json = await AsyncStorage.getItem(REGLAGES_KEY);
        if (json) {
          const r = JSON.parse(json);
          if (r.modeSombre !== undefined) setModeSombreState(r.modeSombre);
          if (r.tailleTexte) setTailleTexteState(r.tailleTexte);
          if (r.daltonien !== undefined) setDaltonienState(r.daltonien);
          if (r.rayonDefaut !== undefined) setRayonDefautState(r.rayonDefaut);
          if (r.animationsReduites !== undefined) setAnimationsReduitesState(r.animationsReduites);
          if (r.visibiliteDefaut) setVisibiliteDefautState(r.visibiliteDefaut);
          if (r.notifications) setNotificationsState(r.notifications);
        }
      } catch {}
      setReglagesCharges(true);
    })();
  }, []);

  const sauvegarderReglages = useCallback(async (nouveauxReglages) => {
    try {
      const actuels = { modeSombre, tailleTexte, daltonien, rayonDefaut, animationsReduites, visibiliteDefaut, notifications };
      await AsyncStorage.setItem(REGLAGES_KEY, JSON.stringify({ ...actuels, ...nouveauxReglages }));
    } catch {}
  }, [modeSombre, tailleTexte, daltonien, rayonDefaut, animationsReduites, visibiliteDefaut, notifications]);

  const setModeSombre = useCallback((v) => { setModeSombreState(v); sauvegarderReglages({ modeSombre: v }); }, [sauvegarderReglages]);
  const setTailleTexte = useCallback((v) => { setTailleTexteState(v); sauvegarderReglages({ tailleTexte: v }); }, [sauvegarderReglages]);
  const setDaltonien = useCallback((v) => { setDaltonienState(v); sauvegarderReglages({ daltonien: v }); }, [sauvegarderReglages]);
  const setRayonDefaut = useCallback((v) => { setRayonDefautState(v); sauvegarderReglages({ rayonDefaut: v }); }, [sauvegarderReglages]);
  const setAnimationsReduites = useCallback((v) => { setAnimationsReduitesState(v); sauvegarderReglages({ animationsReduites: v }); }, [sauvegarderReglages]);
  const setVisibiliteDefaut = useCallback((v) => { setVisibiliteDefautState(v); sauvegarderReglages({ visibiliteDefaut: v }); }, [sauvegarderReglages]);
  const setNotifications = useCallback((fn) => {
    setNotificationsState(prev => {
      const next = typeof fn === 'function' ? fn(prev) : fn;
      sauvegarderReglages({ notifications: next });
      return next;
    });
  }, [sauvegarderReglages]);

  useEffect(() => {
    const chargerProfil = async (userId) => {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (data) setProfil(data);
    };
    const chargerFavoris = async (userId) => {
      const { data } = await supabase.from('favoris').select('*, evenements(*)').eq('user_id', userId);
      if (data) setFavoris(data.map(f => ({ ...f.evenements, favoriId: f.id })).filter(Boolean));
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) { chargerProfil(session.user.id); chargerFavoris(session.user.id); }
      else { setProfil(null); setFavoris([]); }
    });
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) { chargerProfil(user.id); chargerFavoris(user.id); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const ajouterFavori = useCallback(async (evenement) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const existe = favoris.find(f => f.id === evenement.id);
    if (existe) {
      await supabase.from('favoris').delete().eq('evenement_id', evenement.id).eq('user_id', user.id);
      setFavoris(prev => prev.filter(f => f.id !== evenement.id));
    } else {
      await supabase.from('favoris').insert({ evenement_id: evenement.id, user_id: user.id });
      setFavoris(prev => [...prev, evenement]);
    }
  }, [favoris]);

  const estFavori = useCallback((id) => favoris.some(f => f.id === id), [favoris]);
  const bloquerUtilisateur = useCallback((utilisateur) => {
    setUtilisateursBlockes(prev => {
      const existe = prev.find(u => u.id === utilisateur.id);
      return existe ? prev.filter(u => u.id !== utilisateur.id) : [...prev, utilisateur];
    });
  }, []);
  const deconnexion = useCallback(async () => {
    await supabase.auth.signOut();
    setFavoris([]);
    setProfil(null);
  }, []);

  const facteurTexte = useMemo(() =>
    tailleTexte === 'petite' ? 0.85 : tailleTexte === 'grande' ? 1.2 : tailleTexte === 'tres_grande' ? 1.4 : 1,
  [tailleTexte]);

  const theme = useMemo(() => modeSombre ? {
    bg: '#0A0A0A', bg2: '#111111', bg3: '#1A1A1A',
    text: '#FFFFFF', text2: '#E5E5E5', text3: '#555555',
    border: '#222222', card: '#111111', tabBar: '#0A0A0A',
    actif: '#FFFFFF', inactif: '#444444',
  } : {
    bg: '#F5F5F5', bg2: '#FFFFFF', bg3: '#F0F0F0',
    text: '#111111', text2: '#333333', text3: '#888888',
    border: '#E8E8E8', card: '#FFFFFF', tabBar: '#FFFFFF',
    actif: '#111111', inactif: '#BBBBBB',
  }, [modeSombre]);

  // Compatibilité avec l'ancien code qui utilise CATEGORIES_COULEURS et CAT_ICONES
  const CATEGORIES_COULEURS = useMemo(() => {
    const result = {};
    Object.entries(CATEGORIES).forEach(([nom, c]) => {
      result[nom] = { forte: c.forte, claire: c.claire, texte: c.texte };
    });
    return result;
  }, []);

  const CAT_ICONES = useMemo(() => {
    const result = {};
    Object.entries(CATEGORIES).forEach(([nom, c]) => {
      result[nom] = c.icone;
    });
    return result;
  }, []);

  const value = useMemo(() => ({
    modeSombre, setModeSombre,
    tailleTexte, setTailleTexte,
    daltonien, setDaltonien,
    rayonDefaut, setRayonDefaut,
    animationsReduites, setAnimationsReduites,
    visibiliteDefaut, setVisibiliteDefaut,
    utilisateursBlockes, bloquerUtilisateur,
    favoris, ajouterFavori, estFavori,
    notifications, setNotifications,
    profil, setProfil, deconnexion,
    facteurTexte, theme,
    CATEGORIES_COULEURS, CAT_ICONES,
    reglagesCharges,
    evenementCible, setEvenementCible,
  }), [
    modeSombre, tailleTexte, daltonien, rayonDefaut,
    animationsReduites, visibiliteDefaut, utilisateursBlockes,
    favoris, notifications, profil, facteurTexte, theme,
    CATEGORIES_COULEURS, CAT_ICONES, reglagesCharges,
    ajouterFavori, estFavori, bloquerUtilisateur, deconnexion,
    setModeSombre, setTailleTexte, setDaltonien, setRayonDefaut,
    setAnimationsReduites, setVisibiliteDefaut, setNotifications,
    evenementCible, setEvenementCible,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() { return useContext(AppContext); }