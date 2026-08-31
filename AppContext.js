import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const AppContext = createContext();

export const CATEGORIES = {
  'Sport':              { forte: '#2563EB', claire: '#DBEAFE', texte: '#1E40AF', icone: 'football-outline' },
  'Musique':            { forte: '#A855F7', claire: '#F3E8FF', texte: '#7E22CE', icone: 'musical-notes-outline' },
  'Apero':              { forte: '#F59E0B', claire: '#FEF3C7', texte: '#92400E', icone: 'wine-outline' },
  'Entraide':           { forte: '#22C55E', claire: '#DCFCE7', texte: '#15803D', icone: 'heart-outline' },
  'Art':                { forte: '#EC4899', claire: '#FCE7F3', texte: '#9D174D', icone: 'color-palette-outline' },
  'Theatre':            { forte: '#4F46E5', claire: '#EEF2FF', texte: '#3730A3', icone: 'easel-outline' },
  'Cinema':             { forte: '#9F1239', claire: '#FFF1F2', texte: '#881337', icone: 'film-outline' },
  'Marche':             { forte: '#EF4444', claire: '#FEE2E2', texte: '#991B1B', icone: 'storefront-outline' },
  'Nature':             { forte: '#10B981', claire: '#D1FAE5', texte: '#065F46', icone: 'leaf-outline' },
  'Famille':            { forte: '#F97316', claire: '#FFEDD5', texte: '#9A3412', icone: 'people-outline' },
  'Cours':              { forte: '#6366F1', claire: '#EEF2FF', texte: '#3730A3', icone: 'school-outline' },
  'Gaming':             { forte: '#7C3AED', claire: '#EDE9FE', texte: '#5B21B6', icone: 'game-controller-outline' },
};

export function formatDateParis(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
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

const REGLAGES_KEY = 'luma_reglages_v2';
const CACHE_EVENEMENTS_KEY = 'luma_cache_evenements_v1';
const CACHE_TTL = 5 * 60 * 1000;

export function AppProvider({ children }) {
  const [modeSombre, setModeSombreState] = useState(false);
  const [tailleTexte, setTailleTexteState] = useState('normale');
  const [daltonien, setDaltonienState] = useState(false);
  const [rayonDefaut, setRayonDefautState] = useState(null);
  const [animationsReduites, setAnimationsReduitesState] = useState(false);
  const [visibiliteDefaut, setVisibiliteDefautState] = useState('public');
  const [utilisateursBlockes, setUtilisateursBlockes] = useState([]);
  const [notifications, setNotificationsState] = useState({
    proximite: true, commentaires: true, places: false, messages: true,
  });
  const [reglagesCharges, setReglagesCharges] = useState(false);
  const [profil, setProfil] = useState(null);
  const [favoris, setFavoris] = useState([]);
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
          if (r.utilisateursBlockes) setUtilisateursBlockes(r.utilisateursBlockes);
        }
      } catch {}
      setReglagesCharges(true);
    })();
  }, []);

  const sauvegarderReglages = useCallback(async (nouveauxReglages) => {
    try {
      const actuels = {
        modeSombre, tailleTexte, daltonien, rayonDefaut,
        animationsReduites, visibiliteDefaut, notifications, utilisateursBlockes,
      };
      await AsyncStorage.setItem(REGLAGES_KEY, JSON.stringify({ ...actuels, ...nouveauxReglages }));
    } catch {}
  }, [modeSombre, tailleTexte, daltonien, rayonDefaut, animationsReduites, visibiliteDefaut, notifications, utilisateursBlockes]);

  const setModeSombre = useCallback((v) => { setModeSombreState(v); sauvegarderReglages({ modeSombre: v }); }, [sauvegarderReglages]);
  const setTailleTexte = useCallback((v) => { setTailleTexteState(v); sauvegarderReglages({ tailleTexte: v }); }, [sauvegarderReglages]);
  const setDaltonien = useCallback((v) => { setDaltonienState(v); sauvegarderReglages({ daltonien: v }); }, [sauvegarderReglages]);
  const setRayonDefaut = useCallback((v) => { setRayonDefautState(v); sauvegarderReglages({ rayonDefaut: v }); }, [sauvegarderReglages]);
  const setAnimationsReduites = useCallback((v) => { setAnimationsReduitesState(v); sauvegarderReglages({ animationsReduites: v }); }, [sauvegarderReglages]);

  const setVisibiliteDefaut = useCallback((v) => {
    setVisibiliteDefautState(v);
    sauvegarderReglages({ visibiliteDefaut: v });
    if (profil?.id) {
      supabase.from('profiles').update({ visibilite: v }).eq('id', profil.id).then(() => {});
    }
  }, [sauvegarderReglages, profil]);

  const setNotifications = useCallback((fn) => {
    setNotificationsState(prev => {
      const next = typeof fn === 'function' ? fn(prev) : fn;
      sauvegarderReglages({ notifications: next });
      return next;
    });
  }, [sauvegarderReglages]);

  const bloquerUtilisateur = useCallback(async (utilisateur) => {
    setUtilisateursBlockes(prev => {
      const existe = prev.find(u => u.id === utilisateur.id);
      const nouveaux = existe ? prev.filter(u => u.id !== utilisateur.id) : [...prev, utilisateur];
      sauvegarderReglages({ utilisateursBlockes: nouveaux });
      return nouveaux;
    });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const existe = utilisateursBlockes.find(u => u.id === utilisateur.id);
      if (existe) {
        await supabase.from('utilisateurs_bloques').delete().eq('user_id', user.id).eq('bloque_id', utilisateur.id);
      } else {
        await supabase.from('utilisateurs_bloques').insert({ user_id: user.id, bloque_id: utilisateur.id });
      }
    } catch {}
  }, [utilisateursBlockes, sauvegarderReglages]);

  useEffect(() => {
    const chargerProfil = async (userId) => {
      try {
        const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if (data) setProfil(data);
      } catch {}
    };

    const chargerFavoris = async (userId) => {
      try {
        const { data } = await supabase.from('favoris').select('*, evenements(*)').eq('user_id', userId);
        if (data) setFavoris(data.map(f => ({ ...f.evenements, favoriId: f.id })).filter(Boolean));
      } catch {}
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        chargerProfil(session.user.id);
        chargerFavoris(session.user.id);
      } else {
        setProfil(null);
        setFavoris([]);
      }
    });

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        chargerProfil(user.id);
        chargerFavoris(user.id);
      }
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

  const sauvegarderCacheEvenements = useCallback(async (data) => {
    try {
      await AsyncStorage.setItem(CACHE_EVENEMENTS_KEY, JSON.stringify({ data, timestamp: Date.now() }));
    } catch {}
  }, []);

  const lireCacheEvenements = useCallback(async () => {
    try {
      const json = await AsyncStorage.getItem(CACHE_EVENEMENTS_KEY);
      if (!json) return null;
      const { data, timestamp } = JSON.parse(json);
      if (Date.now() - timestamp > CACHE_TTL) return null;
      return data;
    } catch { return null; }
  }, []);

  const deconnexion = useCallback(async () => {
    try {
      if (profil?.id) {
        await supabase.from('profiles').update({ push_token: null }).eq('id', profil.id);
      }
    } catch {}
    await supabase.auth.signOut();
    setFavoris([]);
    setProfil(null);
    try { await AsyncStorage.removeItem(CACHE_EVENEMENTS_KEY); } catch {}
  }, [profil]);

  const facteurTexte = useMemo(() =>
    tailleTexte === 'petite' ? 0.85
    : tailleTexte === 'grande' ? 1.2
    : tailleTexte === 'tres_grande' ? 1.4
    : 1,
  [tailleTexte]);

  const theme = useMemo(() => {
    if (modeSombre) {
      return {
        bg: '#0A0A0A', bg2: '#111111', bg3: '#1A1A1A',
        text: '#FFFFFF', text2: '#E5E5E5', text3: '#555555',
        border: '#222222', card: '#111111', tabBar: '#0A0A0A',
        actif: '#FFFFFF', inactif: '#444444',
        couleurSucces: '#22C55E', couleurErreur: '#EF4444', couleurAlerte: '#F59E0B',
      };
    }
    return {
      bg: '#F5F5F5', bg2: '#FFFFFF', bg3: '#F0F0F0',
      text: '#111111', text2: '#333333', text3: '#888888',
      border: '#E8E8E8', card: '#FFFFFF', tabBar: '#FFFFFF',
      actif: '#111111', inactif: '#BBBBBB',
      couleurSucces: '#22C55E', couleurErreur: '#EF4444', couleurAlerte: '#F59E0B',
    };
  }, [modeSombre]);

  const dureAnimation = useMemo(() => animationsReduites ? 0 : 300, [animationsReduites]);

  const CATEGORIES_COULEURS = useMemo(() => {
    const result = {};
    Object.entries(CATEGORIES).forEach(([nom, c]) => {
      result[nom] = { forte: c.forte, claire: c.claire, texte: c.texte };
    });
    return result;
  }, []);

  const CAT_ICONES = useMemo(() => {
    const result = {};
    Object.entries(CATEGORIES).forEach(([nom, c]) => { result[nom] = c.icone; });
    return result;
  }, []);

  const filtrerParVisibilite = useCallback((evenements, userId) => {
    if (visibiliteDefaut === 'prive') return evenements.filter(e => e.auteur_id === userId);
    return evenements;
  }, [visibiliteDefaut]);

  const value = useMemo(() => ({
    modeSombre, setModeSombre,
    tailleTexte, setTailleTexte,
    daltonien, setDaltonien,
    rayonDefaut, setRayonDefaut,
    animationsReduites, setAnimationsReduites,
    visibiliteDefaut, setVisibiliteDefaut,
    utilisateursBlockes, bloquerUtilisateur,
    notifications, setNotifications,
    reglagesCharges,
    profil, setProfil,
    favoris, ajouterFavori, estFavori,
    deconnexion,
    facteurTexte, theme, dureAnimation,
    CATEGORIES_COULEURS, CAT_ICONES,
    evenementCible, setEvenementCible,
    sauvegarderCacheEvenements, lireCacheEvenements,
    filtrerParVisibilite,
  }), [
    modeSombre, tailleTexte, daltonien, rayonDefaut,
    animationsReduites, visibiliteDefaut, utilisateursBlockes,
    favoris, notifications, profil, facteurTexte, theme, dureAnimation,
    CATEGORIES_COULEURS, CAT_ICONES, reglagesCharges,
    ajouterFavori, estFavori, bloquerUtilisateur, deconnexion,
    setModeSombre, setTailleTexte, setDaltonien, setRayonDefaut,
    setAnimationsReduites, setVisibiliteDefaut, setNotifications,
    evenementCible, setEvenementCible,
    sauvegarderCacheEvenements, lireCacheEvenements, filtrerParVisibilite,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() { return useContext(AppContext); }