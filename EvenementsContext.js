import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const EvenementsContext = createContext();

const CACHE_KEY = 'luma_evenements_v3';
const CACHE_TTL = 3 * 60 * 1000;
const ANTI_SPAM = 30 * 1000;

export function EvenementsProvider({ children }) {
  const [evenements, setEvenements] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreurReseau, setErreurReseau] = useState(false);
  const dernierChargement = useRef(0);
  const appState = useRef(AppState.currentState);
  const channelRef = useRef(null);

  const chargerDepuisCache = async () => {
    try {
      const json = await AsyncStorage.getItem(CACHE_KEY);
      if (!json) return false;
      const { data, timestamp } = JSON.parse(json);
      if (Date.now() - timestamp > CACHE_TTL) return false;
      if (data?.length > 0) {
        setEvenements(data);
        setChargement(false);
        return true;
      }
    } catch {}
    return false;
  };

  const sauvegarderCache = async (data) => {
    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
    } catch {}
  };

  const chargerEvenements = useCallback(async (forceRefresh = false) => {
    const maintenant = Date.now();
    if (!forceRefresh && maintenant - dernierChargement.current < ANTI_SPAM) return;

    const cacheValide = await chargerDepuisCache();
    if (cacheValide && !forceRefresh) {
      chargerDepuisReseau(false);
      return;
    }

    setChargement(true);
    await chargerDepuisReseau(true);
  }, []);

  const chargerDepuisReseau = async (afficherChargement = true) => {
    try {
      const maintenant = new Date().toISOString();
      const { data, error } = await supabase
        .from('evenements')
        .select(`
          id, titre, description, lieu, adresse, latitude, longitude,
          date_evenement, categorie, participants, max, sans_max,
          type, auteur_id, suspendu, created_at,
          profiles:auteur_id(prenom, avatar_url)
        `)
        .eq('suspendu', false)
        .or(`type.eq.fixe,date_evenement.gte.${maintenant}`)
        .order('date_evenement', { ascending: true, nullsFirst: false })
        .limit(500);

      if (error) throw error;

      if (data) {
        // Filtre les doublons par id
        const uniques = [...new Map(data.map(e => [e.id, e])).values()];
        setEvenements(uniques);
        await sauvegarderCache(uniques);
        setErreurReseau(false);
        dernierChargement.current = Date.now();
      }
    } catch {
      setErreurReseau(true);
    } finally {
      if (afficherChargement) setChargement(false);
    }
  };

  useEffect(() => {
    chargerEvenements();

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        chargerEvenements();
      }
      appState.current = nextState;
    });

    // Temps réel
    channelRef.current = supabase
      .channel('evenements_live_v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'evenements' }, (payload) => {
        if (payload.eventType === 'INSERT' && !payload.new.suspendu) {
          setEvenements(prev => {
            if (prev.find(e => e.id === payload.new.id)) return prev;
            return [...prev, payload.new].sort((a, b) => {
              if (!a.date_evenement) return 1;
              if (!b.date_evenement) return -1;
              return new Date(a.date_evenement) - new Date(b.date_evenement);
            });
          });
        } else if (payload.eventType === 'UPDATE') {
          if (payload.new.suspendu) {
            setEvenements(prev => prev.filter(e => e.id !== payload.new.id));
          } else {
            setEvenements(prev => prev.map(e => e.id === payload.new.id ? { ...e, ...payload.new } : e));
          }
        } else if (payload.eventType === 'DELETE') {
          setEvenements(prev => prev.filter(e => e.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      appStateSub.remove();
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  return (
    <EvenementsContext.Provider value={{
      evenements,
      chargement,
      erreurReseau,
      chargerEvenements: () => chargerEvenements(true),
    }}>
      {children}
    </EvenementsContext.Provider>
  );
}

export function useEvenements() { return useContext(EvenementsContext); }