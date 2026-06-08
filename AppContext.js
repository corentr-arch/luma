import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const AppContext = createContext();

const CATEGORIES_COULEURS_BASE = {
  'Sport':              { forte: '#2563EB', claire: '#DBEAFE', texte: '#1E40AF' },
  'Musique':            { forte: '#A855F7', claire: '#F3E8FF', texte: '#7E22CE' },
  'Apéro':              { forte: '#F59E0B', claire: '#FEF3C7', texte: '#92400E' },
  'Entraide':           { forte: '#22C55E', claire: '#DCFCE7', texte: '#15803D' },
  'Art':                { forte: '#EC4899', claire: '#FCE7F3', texte: '#9D174D' },
  'Marché':             { forte: '#EF4444', claire: '#FEE2E2', texte: '#991B1B' },
  'Nature & Bien-être': { forte: '#10B981', claire: '#D1FAE5', texte: '#065F46' },
  'Famille':            { forte: '#F97316', claire: '#FFEDD5', texte: '#9A3412' },
  'Cours':              { forte: '#6366F1', claire: '#EEF2FF', texte: '#3730A3' },
};

const CAT_ICONES_BASE = {
  'Sport':              'football-outline',
  'Musique':            'musical-notes-outline',
  'Apéro':              'wine-outline',
  'Entraide':           'heart-outline',
  'Art':                'color-palette-outline',
  'Marché':             'storefront-outline',
  'Nature & Bien-être': 'leaf-outline',
  'Famille':            'people-outline',
  'Cours':              'school-outline',
};

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
    const chargerReglages = async () => {
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
    };
    chargerReglages();
  }, []);

  const sauvegarderReglages = useCallback(async (nouveauxReglages) => {
    try {
      const actuels = {
        modeSombre, tailleTexte, daltonien, rayonDefaut,
        animationsReduites, visibiliteDefaut, notifications,
      };
      await AsyncStorage.setItem(REGLAGES_KEY, JSON.stringify({ ...actuels, ...nouveauxReglages }));
    } catch {}
  }, [modeSombre, tailleTexte, daltonien, rayonDefaut, animationsReduites, visibiliteDefaut, notifications]);

  const setModeSombre = useCallback((v) => {
    setModeSombreState(v);
    sauvegarderReglages({ modeSombre: v });
  }, [sauvegarderReglages]);

  const setTailleTexte = useCallback((v) => {
    setTailleTexteState(v);
    sauvegarderReglages({ tailleTexte: v });
  }, [sauvegarderReglages]);

  const setDaltonien = useCallback((v) => {
    setDaltonienState(v);
    sauvegarderReglages({ daltonien: v });
  }, [sauvegarderReglages]);

  const setRayonDefaut = useCallback((v) => {
    setRayonDefautState(v);
    sauvegarderReglages({ rayonDefaut: v });
  }, [sauvegarderReglages]);

  const setAnimationsReduites = useCallback((v) => {
    setAnimationsReduitesState(v);
    sauvegarderReglages({ animationsReduites: v });
  }, [sauvegarderReglages]);

  const setVisibiliteDefaut = useCallback((v) => {
    setVisibiliteDefautState(v);
    sauvegarderReglages({ visibiliteDefaut: v });
  }, [sauvegarderReglages]);

  const setNotifications = useCallback((fn) => {
    setNotificationsState(prev => {
      const next = typeof fn === 'function' ? fn(prev) : fn;
      sauvegarderReglages({ notifications: next });
      return next;
    });
  }, [sauvegarderReglages]);

  useEffect(() => {
    const chargerProfil = async (userId) => {
      const { data } = await supabase
        .from('profiles').select('*').eq('id', userId).single();
      if (data) setProfil(data);
    };

    const chargerFavoris = async (userId) => {
      const { data } = await supabase
        .from('favoris').select('*, evenements(*)').eq('user_id', userId);
      if (data) setFavoris(data.map(f => ({ ...f.evenements, favoriId: f.id })).filter(Boolean));
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
      await supabase.from('favoris').delete()
        .eq('evenement_id', evenement.id).eq('user_id', user.id);
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
    tailleTexte === 'petite' ? 0.85
    : tailleTexte === 'grande' ? 1.2
    : tailleTexte === 'tres_grande' ? 1.4
    : 1,
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

  const CATEGORIES_COULEURS = useMemo(() => CATEGORIES_COULEURS_BASE, []);
  const CAT_ICONES = useMemo(() => CAT_ICONES_BASE, []);

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