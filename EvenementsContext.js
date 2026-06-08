import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';

const EvenementsContext = createContext();

function calculerDateFinReelle(evenement) {
  if (evenement.type === 'fixe') return null;
  if (evenement.date_fin) return new Date(evenement.date_fin);
  if (evenement.duree_minutes && evenement.date_evenement) {
    const fin = new Date(evenement.date_evenement);
    fin.setMinutes(fin.getMinutes() + evenement.duree_minutes);
    return fin;
  }
  if (evenement.date_evenement) return new Date(evenement.date_evenement);
  return null;
}

function estExpire(evenement) {
  if (evenement.type === 'fixe') return false;
  if (evenement.suspendu) return true;
  const fin = calculerDateFinReelle(evenement);
  if (!fin) return false;
  return fin < new Date();
}

export function EvenementsProvider({ children }) {
  const [evenements, setEvenements] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreurReseau, setErreurReseau] = useState(false);

  const chargerEvenements = useCallback(async (positionUser = null, rayonMetres = null) => {
    try {
      let data, error;

      if (positionUser && rayonMetres) {
        const result = await supabase.rpc('evenements_dans_rayon', {
          lat: positionUser.latitude,
          lng: positionUser.longitude,
          rayon_metres: rayonMetres,
        });
        data = result.data;
        error = result.error;

        if (error) {
          const fallback = await supabase
            .from('evenements')
            .select(`*, profiles:auteur_id(prenom, handle, avatar_url, score_confiance, telephone_verifie, email_verifie)`)
            .eq('visibilite', 'public')
            .eq('suspendu', false)
            .order('created_at', { ascending: false })
            .limit(150);
          data = fallback.data;
          error = fallback.error;
        }
      } else {
        const result = await supabase
          .from('evenements')
          .select(`*, profiles:auteur_id(prenom, handle, avatar_url, score_confiance, telephone_verifie, email_verifie)`)
          .eq('visibilite', 'public')
          .eq('suspendu', false)
          .order('created_at', { ascending: false })
          .limit(150);
        data = result.data;
        error = result.error;
      }

      if (error) {
        setErreurReseau(true);
        setChargement(false);
        return;
      }

      // Nettoie les expirés en base
      const expires = (data || []).filter(e => estExpire(e));
      if (expires.length > 0) {
        supabase
          .from('evenements')
          .update({ suspendu: true })
          .in('id', expires.map(e => e.id))
          .then(() => {});
      }

      const filtres = (data || []).filter(e => !estExpire(e));

      setErreurReseau(false);
      setEvenements(filtres.map(e => ({
        ...e,
        participants: e.participants_count || 0,
        max: e.max_participants,
        sansMax: e.sans_max,
        validationRequise: e.validation_requise,
        commentaires: [],
        dateFinReelle: calculerDateFinReelle(e),
      })));
    } catch {
      setErreurReseau(true);
    }
    setChargement(false);
  }, []);

  useEffect(() => {
    chargerEvenements();

    // Vérifie toutes les 30 secondes si des événements ont expiré
    const expirationCheck = setInterval(() => {
      setEvenements(prev => {
        const restants = prev.filter(e => !estExpire(e));
        const disparus = prev.filter(e => estExpire(e));
        if (disparus.length > 0) {
          supabase
            .from('evenements')
            .update({ suspendu: true })
            .in('id', disparus.map(e => e.id))
            .then(() => {});
        }
        return restants.length !== prev.length ? restants : prev;
      });
    }, 30000);

    const retryInterval = setInterval(() => {
      if (erreurReseau) chargerEvenements();
    }, 10000);

    const subscription = supabase
      .channel('evenements_changes')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'evenements',
      }, () => chargerEvenements())
      .subscribe();

    return () => {
      clearInterval(expirationCheck);
      clearInterval(retryInterval);
      supabase.removeChannel(subscription);
    };
  }, [chargerEvenements, erreurReseau]);

  const ajouterEvenement = useCallback(async (evenement) => {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return { succes: false, erreur: 'non_connecte' };

    const { data: profilExiste } = await supabase
      .from('profiles').select('id, is_organisateur').eq('id', user.id).single();
    if (!profilExiste) return { succes: false, erreur: 'profil_introuvable' };

    // Vérifie la limite anti-spam via la fonction SQL
    const { data: peutCreer, error: limiteError } = await supabase
      .rpc('peut_creer_evenement', { user_uuid: user.id });

    if (limiteError || !peutCreer) {
      return {
        succes: false,
        erreur: 'limite_atteinte',
        message: profilExiste.is_organisateur
          ? 'Erreur inattendue.'
          : 'Tu as atteint la limite de 3 événements actifs simultanés. Supprime ou attends la fin d\'un événement existant pour en créer un nouveau.',
      };
    }

    const { data, error } = await supabase.from('evenements').insert({
      titre: evenement.titre,
      description: evenement.description || '',
      categorie: evenement.categorie,
      type: evenement.type,
      lieu: evenement.lieu,
      duree: evenement.duree || '',
      duree_minutes: evenement.dureeMinutes || null,
      date_evenement: evenement.dateEvenement || null,
      date_fin: evenement.dateFin || null,
      latitude: evenement.latitude,
      longitude: evenement.longitude,
      max_participants: evenement.max,
      sans_max: evenement.sansMax || false,
      visibilite: evenement.visibilite || 'public',
      validation_requise: evenement.validationRequise || false,
      auteur_id: user.id,
      participants_count: 0,
      suspendu: false,
    }).select().single();

    if (error) return { succes: false, erreur: 'insertion_echouee' };

    const nouvelEvenement = {
      ...data,
      participants: 0,
      max: data.max_participants,
      sansMax: data.sans_max,
      validationRequise: data.validation_requise,
      commentaires: [],
      dateFinReelle: calculerDateFinReelle(data),
    };
    setEvenements(prev => [nouvelEvenement, ...prev]);
    return { succes: true, evenement: nouvelEvenement };
  }, []);

  const supprimerEvenement = useCallback(async (evenementId) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from('evenements')
      .update({ suspendu: true })
      .eq('id', evenementId)
      .eq('auteur_id', user.id);

    if (!error) {
      setEvenements(prev => prev.filter(e => e.id !== evenementId));
      return true;
    }
    return false;
  }, []);

  return (
    <EvenementsContext.Provider value={{
      evenements, ajouterEvenement, supprimerEvenement,
      chargement, erreurReseau, chargerEvenements,
    }}>
      {children}
    </EvenementsContext.Provider>
  );
}

export function useEvenements() { return useContext(EvenementsContext); }