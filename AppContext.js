import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

const AppContext = createContext();

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

export function mappingCategorie(tags, titre, description, lieu) {
  const tout = [
    ...(Array.isArray(tags) ? tags : [String(tags || '')]),
    titre || '', description || '', lieu || '',
  ].join(' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (tout.match(/\b(esport|gaming|jeux.video|nintendo|playstation|xbox|twitch)\b/)) return 'Gaming';
  if (tout.match(/\b(cinema|ugc|mk2|pathe|gaumont|louxor|film|projection|seance|cine)\b/)) return 'Cinéma';
  if (tout.match(/\b(theatre|comedie.francaise|odeon|piece.de.theatre|mise.en.scene|danse|ballet|opera|cirque|humour|stand.up)\b/)) return 'Théâtre';
  if (tout.match(/\b(concert|festival|jazz|blues|rock|metal|pop|electro|rap|rnb|hip.hop|classique|orchestre|symphonie|chanson|musique)\b/)) return 'Musique';
  if (tout.match(/\b(sport|fitness|yoga|pilates|running|marathon|match|tournoi|natation|tennis|foot|rugby|basket|gym)\b/)) return 'Sport';
  if (tout.match(/\b(nature|jardin|jardinage|meditation|sophrologie|bien.etre|balade|foret)\b/)) return 'Nature & Bien-être';
  if (tout.match(/\b(enfant|famille|kids|jeunesse|bebe|conte|animation.enfant)\b/)) return 'Famille';
  if (tout.match(/\b(marche|brocante|vide.grenier|salon|foire|braderie)\b/)) return 'Marché';
  if (tout.match(/\b(solidarite|benevol|entraide|humanitaire|don|collecte)\b/)) return 'Entraide';
  if (tout.match(/\b(conference|debat|atelier|workshop|masterclass|formation|cours|visite.guidee|lecture|livre)\b/)) return 'Cours';
  if (tout.match(/\b(exposition|expo|galerie|vernissage|art|peinture|sculpture|photo|musee)\b/)) return 'Art';
  return 'Art';
}

export function formatDateParis(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    const heureUTC = d.getUTCHours();
    const minutesUTC = d.getUTCMinutes();
    const pasDheure = heureUTC === 0 && minutesUTC === 0;
    if (pasDheure) {
      return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Paris' });
    }
    return d.toLocaleDateString('fr-FR', {
      weekday: 'short', day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris',
    });
  } catch { return null; }
}

const REGLAGES_KEY = 'luma_reglages_v2';
const CACHE_EVENEMENTS_KEY = 'luma_cache_evenements_v1';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function AppProvider({ children }) {
  // ── Réglages ──────────────────────────────────────────────────────────────
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

  // ── Profil & données ──────────────────────────────────────────────────────
  const [profil, setProfil] = useState(null);
  const [favoris, setFavoris] = useState([]);
  const [evenementCible, setEvenementCible] = useState(null);

  // ── Chargement réglages ───────────────────────────────────────────────────
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

  // ── Setters avec sauvegarde ───────────────────────────────────────────────
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
    // ✅ Applique la visibilité en base
    if (profil?.id) {
      supabase.from('profiles')
        .update({ visibilite: v })
        .eq('id', profil.id)
        .then(() => {});
    }
  }, [sauvegarderReglages, profil]);

  const setNotifications = useCallback((fn) => {
    setNotificationsState(prev => {
      const next = typeof fn === 'function' ? fn(prev) : fn;
      sauvegarderReglages({ notifications: next });
      return next;
    });
  }, [sauvegarderReglages]);

  // ✅ Bloquer un utilisateur — persisté en AsyncStorage ET en base
  const bloquerUtilisateur = useCallback(async (utilisateur) => {
    setUtilisateursBlockes(prev => {
      const existe = prev.find(u => u.id === utilisateur.id);
      const nouveauxBloques = existe
        ? prev.filter(u => u.id !== utilisateur.id)
        : [...prev, utilisateur];
      sauvegarderReglages({ utilisateursBlockes: nouveauxBloques });
      return nouveauxBloques;
    });
    // Sauvegarde en base si connecté
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const existe = utilisateursBlockes.find(u => u.id === utilisateur.id);
      if (existe) {
        await supabase.from('utilisateurs_bloques')
          .delete()
          .eq('user_id', user.id)
          .eq('bloque_id', utilisateur.id);
      } else {
        await supabase.from('utilisateurs_bloques')
          .insert({ user_id: user.id, bloque_id: utilisateur.id });
      }
    } catch {}
  }, [utilisateursBlockes, sauvegarderReglages]);

  // ── Profil & auth ─────────────────────────────────────────────────────────
  useEffect(() => {
    const chargerProfil = async (userId) => {
      try {
        const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if (data) setProfil(data);
      } catch {}
    };

    const chargerFavoris = async (userId) => {
      try {
        const { data } = await supabase.from('favoris')
          .select('*, evenements(*)')
          .eq('user_id', userId);
        if (data) setFavoris(data.map(f => ({ ...f.evenements, favoriId: f.id })).filter(Boolean));
      } catch {}
    };

    const chargerBloques = async (userId) => {
      try {
        const { data } = await supabase.from('utilisateurs_bloques')
          .select('bloque_id, profiles:bloque_id(id, prenom, handle)')
          .eq('user_id', userId);
        if (data && data.length > 0) {
          const bloques = data.map(b => b.profiles).filter(Boolean);
          setUtilisateursBlockes(bloques);
          sauvegarderReglages({ utilisateursBlockes: bloques });
        }
      } catch {}
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        chargerProfil(session.user.id);
        chargerFavoris(session.user.id);
        chargerBloques(session.user.id);
      } else {
        setProfil(null);
        setFavoris([]);
      }
    });

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        chargerProfil(user.id);
        chargerFavoris(user.id);
        chargerBloques(user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Favoris ───────────────────────────────────────────────────────────────
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

  // ── Cache événements ──────────────────────────────────────────────────────
  const sauvegarderCacheEvenements = useCallback(async (data) => {
    try {
      await AsyncStorage.setItem(CACHE_EVENEMENTS_KEY, JSON.stringify({
        data,
        timestamp: Date.now(),
      }));
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

  // ── Déconnexion sécurisée ─────────────────────────────────────────────────
  const deconnexion = useCallback(async () => {
    try {
      // Invalide le token push
      const { data: { user } } = await supabase.auth.getUser();
      if (user && profil?.id) {
        await supabase.from('profiles')
          .update({ push_token: null })
          .eq('id', profil.id);
      }
    } catch {}
    await supabase.auth.signOut();
    setFavoris([]);
    setProfil([]);
    // Vide le cache
    try {
      await AsyncStorage.removeItem(CACHE_EVENEMENTS_KEY);
    } catch {}
  }, [profil]);

  // ── Theme ─────────────────────────────────────────────────────────────────
  const facteurTexte = useMemo(() =>
    tailleTexte === 'petite' ? 0.85
    : tailleTexte === 'grande' ? 1.2
    : tailleTexte === 'tres_grande' ? 1.4
    : 1,
  [tailleTexte]);

  // ✅ Thème daltonien — remplace les couleurs problématiques rouge/vert
  const theme = useMemo(() => {
    const base = modeSombre ? {
      bg: '#0A0A0A', bg2: '#111111', bg3: '#1A1A1A',
      text: '#FFFFFF', text2: '#E5E5E5', text3: '#555555',
      border: '#222222', card: '#111111', tabBar: '#0A0A0A',
      actif: '#FFFFFF', inactif: '#444444',
    } : {
      bg: '#F5F5F5', bg2: '#FFFFFF', bg3: '#F0F0F0',
      text: '#111111', text2: '#333333', text3: '#888888',
      border: '#E8E8E8', card: '#FFFFFF', tabBar: '#FFFFFF',
      actif: '#111111', inactif: '#BBBBBB',
    };

    // ✅ Mode daltonien — palette deutéranopie (rouge-vert)
    if (daltonien) {
      return {
        ...base,
        // Remplace le vert par du bleu, le rouge par de l'orange
        daltonien: true,
        couleurSucces: '#2563EB',    // bleu au lieu de vert
        couleurErreur: '#F59E0B',    // orange au lieu de rouge
        couleurAlerte: '#A855F7',    // violet au lieu de jaune
      };
    }

    return { ...base, daltonien: false, couleurSucces: '#22C55E', couleurErreur: '#EF4444', couleurAlerte: '#F59E0B' };
  }, [modeSombre, daltonien]);

  // ✅ Durée d'animation — réduite si animationsReduites
  const dureAnimation = useMemo(() =>
    animationsReduites ? 0 : 300,
  [animationsReduites]);

  // ── CATEGORIES_COULEURS & CAT_ICONES ──────────────────────────────────────
  const CATEGORIES_COULEURS = useMemo(() => {
    const result = {};
    Object.entries(CATEGORIES).forEach(([nom, c]) => {
      // ✅ Applique le mode daltonien aux couleurs de catégories
      if (daltonien && nom === 'Entraide') {
        result[nom] = { forte: '#2563EB', claire: '#DBEAFE', texte: '#1E40AF' };
      } else if (daltonien && nom === 'Marché') {
        result[nom] = { forte: '#F59E0B', claire: '#FEF3C7', texte: '#92400E' };
      } else {
        result[nom] = { forte: c.forte, claire: c.claire, texte: c.texte };
      }
    });
    return result;
  }, [daltonien]);

  const CAT_ICONES = useMemo(() => {
    const result = {};
    Object.entries(CATEGORIES).forEach(([nom, c]) => { result[nom] = c.icone; });
    return result;
  }, []);

  // ── Visibilité — filtre les événements selon la visibilité ────────────────
  const filtrerParVisibilite = useCallback((evenements, userId) => {
    if (visibiliteDefaut === 'prive') return evenements.filter(e => e.auteur_id === userId);
    if (visibiliteDefaut === 'amis') return evenements; // À implémenter avec système de follows
    return evenements; // public
  }, [visibiliteDefaut]);

  // ── Value ─────────────────────────────────────────────────────────────────
  const value = useMemo(() => ({
    // Réglages
    modeSombre, setModeSombre,
    tailleTexte, setTailleTexte,
    daltonien, setDaltonien,
    rayonDefaut, setRayonDefaut,
    animationsReduites, setAnimationsReduites,
    visibiliteDefaut, setVisibiliteDefaut,
    utilisateursBlockes, bloquerUtilisateur,
    notifications, setNotifications,
    reglagesCharges,

    // Profil
    profil, setProfil,
    favoris, ajouterFavori, estFavori,
    deconnexion,

    // Theme & UX
    facteurTexte, theme, dureAnimation,
    CATEGORIES_COULEURS, CAT_ICONES,

    // Navigation
    evenementCible, setEvenementCible,

    // Cache
    sauvegarderCacheEvenements, lireCacheEvenements,

    // Utilitaires
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
