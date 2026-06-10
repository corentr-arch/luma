import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Linking, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { useApp, CATEGORIES, formatDateParis } from '../AppContext';
import { supabase } from '../supabase';

export default function DetailLieu({ route, navigation }) {
  const { lieu } = route.params;
  const { theme, facteurTexte } = useApp();
  const [evenements, setEvenements] = useState([]);
  const [chargement, setChargement] = useState(true);
  const t = (size) => size * facteurTexte;

  const estCinema = lieu.sous_categorie === 'Cinéma';
  const estSalleConcert = lieu.sous_categorie === 'Salle de concert' || lieu.categorie === 'Musique';
  const estStade = lieu.sous_categorie === 'Stade';

  // Config couleur selon type
  const getConfig = () => {
    if (estCinema) return { couleur: '#9F1239', claire: '#FFF1F2', icone: 'film', label: 'Cinéma' };
    if (estSalleConcert) return { couleur: '#A855F7', claire: '#F3E8FF', icone: 'musical-notes', label: 'Salle de concert' };
    if (estStade) return { couleur: '#2563EB', claire: '#DBEAFE', icone: 'trophy', label: 'Stade' };
    return CATEGORIES[lieu.categorie] || { couleur: '#6B7280', claire: '#F3F4F6', icone: 'location', label: lieu.categorie };
  };

  const config = getConfig();

  // URL du site officiel pour voir les séances/programmation
  const getUrlOfficiel = () => {
    if (lieu.url) return lieu.url;
    const nom = (lieu.nom || '').toLowerCase();
    if (nom.includes('pathe') || nom.includes('pathé') || nom.includes('gaumont')) return 'https://www.pathe.fr';
    if (nom.includes('ugc')) return 'https://www.ugc.fr';
    if (nom.includes('mk2')) return 'https://www.mk2.com';
    if (nom.includes('grand rex')) return 'https://www.legrandrex.com';
    if (nom.includes('louxor')) return 'https://www.cinemalouxor.fr';
    if (nom.includes('champo')) return 'https://www.lechampo.com';
    if (nom.includes('cinémathèque') || nom.includes('cinematheque')) return 'https://www.cinematheque.fr';
    if (nom.includes('forum des images')) return 'https://www.forumdesimages.fr';
    if (nom.includes('olympia')) return 'https://www.olympiahall.com';
    if (nom.includes('bataclan')) return 'https://www.bataclan.fr';
    if (nom.includes('cigale')) return 'https://www.lacigale.fr';
    if (nom.includes('zenith') || nom.includes('zénith')) return 'https://www.zenith-paris.com';
    if (nom.includes('accor arena') || nom.includes('bercy')) return 'https://www.accor-arena.com';
    if (nom.includes('philharmonie')) return 'https://philharmoniedeparis.fr/fr/agenda';
    if (nom.includes('opéra garnier') || nom.includes('opera garnier')) return 'https://www.operadeparis.fr/saison/agenda';
    if (nom.includes('opéra bastille') || nom.includes('opera bastille')) return 'https://www.operadeparis.fr/saison/agenda';
    if (nom.includes('parc des princes')) return 'https://www.psg.fr/matches';
    if (nom.includes('stade de france')) return 'https://www.stadefrance.com/agenda';
    if (nom.includes('roland garros')) return 'https://www.rolandgarros.com/fr-fr';
    return null;
  };

  const getLabelBouton = () => {
    if (estCinema) return 'Voir les séances';
    if (estSalleConcert) return 'Voir la programmation';
    if (estStade) return 'Voir le calendrier';
    return 'Voir le site officiel';
  };

  const getIconeBouton = () => {
    if (estCinema) return 'film-outline';
    if (estSalleConcert) return 'musical-notes-outline';
    if (estStade) return 'trophy-outline';
    return 'globe-outline';
  };

  useEffect(() => {
    chargerEvenements();
  }, [lieu.id]);

  const chargerEvenements = async () => {
    setChargement(true);
    try {
      const maintenant = new Date().toISOString();
      const { data } = await supabase
        .from('evenements_officiels')
        .select('*')
        .eq('actif', true)
        .or(`lieu_id.eq.${lieu.id},lieu.ilike.%${encodeURIComponent(lieu.nom)}%`)
        .gte('date_debut', maintenant)
        .order('date_debut', { ascending: true })
        .limit(30);
      if (data) setEvenements(data);
    } catch {}
    setChargement(false);
  };

  const urlOfficiel = getUrlOfficiel();

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 36 }}>
          <Ionicons name="chevron-back" size={22} color={config.couleur} />
        </TouchableOpacity>
        <Text style={[styles.headerTitre, { color: theme.text, fontSize: t(16) }]} numberOfLines={1}>
          {lieu.nom}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Bandeau type */}
        <View style={[styles.bandeau, { backgroundColor: config.couleur }]}>
          <Ionicons name={config.icone} size={15} color="#fff" />
          <Text style={{ color: '#fff', fontSize: t(13), fontWeight: '600', letterSpacing: 0.5 }}>
            {lieu.sous_categorie || lieu.categorie}
          </Text>
        </View>

        {/* Infos */}
        <View style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {lieu.adresse && (
            <View style={styles.infoLigne}>
              <View style={[styles.infoIcone, { backgroundColor: config.couleur + '15' }]}>
                <Ionicons name="location-outline" size={16} color={config.couleur} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text3, fontSize: t(11), marginBottom: 2 }}>Adresse</Text>
                <Text style={{ color: theme.text, fontSize: t(14) }}>{lieu.adresse}</Text>
              </View>
            </View>
          )}

          {lieu.horaires && (
            <>
              <View style={[styles.sep, { backgroundColor: theme.border }]} />
              <View style={styles.infoLigne}>
                <View style={[styles.infoIcone, { backgroundColor: '#F5F5F5' }]}>
                  <Ionicons name="time-outline" size={16} color={theme.text3} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text3, fontSize: t(11), marginBottom: 2 }}>Horaires</Text>
                  <Text style={{ color: theme.text, fontSize: t(13) }}>{lieu.horaires}</Text>
                </View>
              </View>
            </>
          )}

          {lieu.telephone && (
            <>
              <View style={[styles.sep, { backgroundColor: theme.border }]} />
              <TouchableOpacity
                style={styles.infoLigne}
                onPress={() => Linking.openURL(`tel:${lieu.telephone}`)}
              >
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

        {/* Bouton principal — séances / programmation */}
        {urlOfficiel && (
          <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            <TouchableOpacity
              style={[styles.btnPrincipal, { backgroundColor: config.couleur }]}
              onPress={() => Linking.openURL(urlOfficiel)}
            >
              <Ionicons name={getIconeBouton()} size={18} color="#fff" />
              <Text style={{ color: '#fff', fontSize: t(15), fontWeight: '600' }}>
                {getLabelBouton()}
              </Text>
              <Ionicons name="open-outline" size={15} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
            <Text style={{ color: theme.text3, fontSize: t(11), textAlign: 'center', marginTop: 6 }}>
              Ouvre le site officiel
            </Text>
          </View>
        )}

        {/* Événements liés dans Luma */}
        <View style={{ paddingHorizontal: 16 }}>
          <View style={styles.sectionTitre}>
            <Text style={{ color: theme.text, fontSize: t(17), fontWeight: '500' }}>
              Dans Luma
            </Text>
            {!chargement && (
              <View style={[styles.badge, { backgroundColor: config.claire }]}>
                <Text style={{ color: config.couleur, fontSize: t(11), fontWeight: '500' }}>
                  {evenements.length} événement{evenements.length !== 1 ? 's' : ''}
                </Text>
              </View>
            )}
          </View>

          {chargement ? (
            <View style={[styles.vide, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={{ color: theme.text3, fontSize: t(13) }}>Chargement...</Text>
            </View>
          ) : evenements.length === 0 ? (
            <View style={[styles.vide, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Ionicons name="calendar-outline" size={28} color={theme.text3} />
              <Text style={{ color: theme.text, fontSize: t(15), fontWeight: '500', marginTop: 8 }}>
                Aucun événement dans Luma
              </Text>
              <Text style={{ color: theme.text3, fontSize: t(13), marginTop: 4, textAlign: 'center', lineHeight: 20 }}>
                Sois le premier à créer un événement ici !
              </Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {evenements.map(ev => {
                const catEv = CATEGORIES[ev.categorie] || CATEGORIES['Art'];
                return (
                  <TouchableOpacity
                    key={ev.id}
                    style={[styles.evCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                    onPress={() => navigation.navigate('DetailEvenementOfficiel', { evenement: ev })}
                    activeOpacity={0.7}
                  >
                    <View style={{ flexDirection: 'row', gap: 12, padding: 12 }}>
                      {ev.image_url ? (
                        <Image source={{ uri: ev.image_url }} style={styles.evImage} />
                      ) : (
                        <View style={[styles.evImagePlaceholder, { backgroundColor: catEv.claire }]}>
                          <Ionicons name={catEv.icone} size={22} color={catEv.forte} />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.text, fontSize: t(14), fontWeight: '500', marginBottom: 4 }} numberOfLines={2}>
                          {ev.titre}
                        </Text>
                        {ev.date_debut && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                            <Ionicons name="calendar-outline" size={12} color={catEv.forte} />
                            <Text style={{ color: catEv.forte, fontSize: t(12), fontWeight: '500' }}>
                              {formatDateParis(ev.date_debut)}
                            </Text>
                          </View>
                        )}
                        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                          <View style={[styles.tag, { backgroundColor: catEv.claire }]}>
                            <Text style={{ color: catEv.texte, fontSize: t(10), fontWeight: '500' }}>
                              {ev.categorie}
                            </Text>
                          </View>
                          {ev.gratuit && (
                            <View style={[styles.tag, { backgroundColor: '#DCFCE7' }]}>
                              <Text style={{ color: '#15803D', fontSize: t(10), fontWeight: '500' }}>Gratuit</Text>
                            </View>
                          )}
                          {ev.prix_min && (
                            <View style={[styles.tag, { backgroundColor: '#FEF3C7' }]}>
                              <Text style={{ color: '#92400E', fontSize: t(10) }}>
                                À partir de {ev.prix_min}€
                              </Text>
                            </View>
                          )}
                          {ev.source === 'ticketmaster' && (
                            <View style={[styles.tag, { backgroundColor: '#FEF3C7' }]}>
                              <Text style={{ color: '#92400E', fontSize: t(9) }}>🎟️ Ticketmaster</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={15} color={catEv.forte} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Créer un événement */}
        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
          <TouchableOpacity
            style={[styles.btnCreer, { backgroundColor: theme.card, borderColor: config.couleur }]}
            onPress={() => navigation.navigate('AjoutEvenement')}
          >
            <Ionicons name="add-circle-outline" size={18} color={config.couleur} />
            <Text style={{ color: config.couleur, fontSize: t(14), fontWeight: '500' }}>
              Créer un événement ici
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 16, paddingTop: 56, borderBottomWidth: 0.5,
  },
  headerTitre: { flex: 1, fontWeight: '500', textAlign: 'center' },
  bandeau: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, paddingHorizontal: 16,
  },
  infoCard: {
    margin: 16, marginBottom: 0,
    borderRadius: 16, borderWidth: 0.5, padding: 4,
  },
  infoLigne: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 12 },
  infoIcone: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sep: { height: 0.5, marginHorizontal: 12 },
  btnPrincipal: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, borderRadius: 14, padding: 16, marginTop: 16,
  },
  sectionTitre: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12,
  },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  evCard: { borderRadius: 14, borderWidth: 0.5, overflow: 'hidden' },
  evImage: { width: 64, height: 64, borderRadius: 10, flexShrink: 0 },
  evImagePlaceholder: {
    width: 64, height: 64, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  tag: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  vide: { borderRadius: 16, borderWidth: 0.5, padding: 32, alignItems: 'center' },
  btnCreer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 14, padding: 14, borderWidth: 1.5,
  },
});