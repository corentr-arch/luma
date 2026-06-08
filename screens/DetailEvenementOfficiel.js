import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Linking, Share, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../AppContext';

const COULEUR_SALLE  = '#F97316';
const COULEUR_CINEMA = '#9F1239';
const COULEUR_THEATRE = '#4F46E5';
const COULEUR_SPORT  = '#16A34A';
const COULEUR_GAMING = '#7C3AED';

const TYPE_SPECIAL_CONFIG = {
  salle:             { couleur: COULEUR_SALLE,   icone: 'musical-notes',   label: 'Salle de concert' },
  cinema:            { couleur: COULEUR_CINEMA,  icone: 'film',            label: 'Cinéma' },
  theatre:           { couleur: COULEUR_THEATRE, icone: 'comedy',          label: 'Théâtre' },
  sport_competition: { couleur: COULEUR_SPORT,   icone: 'trophy',          label: 'Compétition sportive' },
  gaming:            { couleur: COULEUR_GAMING,  icone: 'game-controller', label: 'Jeux vidéo / Esport' },
  officiel:          { couleur: '#2563EB',        icone: 'calendar-outline', label: 'Agenda Paris' },
};

const SOURCE_CONFIG = {
  que_faire_paris: { label: 'Que faire à Paris', couleur: '#2563EB', bg: '#DBEAFE' },
  openagenda:      { label: 'OpenAgenda',         couleur: '#F97316', bg: '#FFF7ED' },
  ticketmaster:    { label: 'Ticketmaster',        couleur: '#EF4444', bg: '#FEE2E2' },
};

function detecterTypeSpecial(ev) {
  const titre = (ev.titre || '').toLowerCase();
  const lieu = (ev.lieu || '').toLowerCase();
  const desc = (ev.description || '').toLowerCase();
  const salle = (ev.salle || '').toLowerCase();
  const cat = (ev.categorie || '').toLowerCase();
  const tout = titre + ' ' + lieu + ' ' + desc + ' ' + salle;
  if (ev.source === 'openagenda') return 'salle';
  if (tout.includes('gaming') || tout.includes('esport') || tout.includes('jeux vidéo') || tout.includes('game')) return 'gaming';
  if (tout.includes('compétition') || tout.includes('match') || tout.includes('tournoi') || tout.includes('championnat')) return 'sport_competition';
  if (lieu.includes('cinéma') || lieu.includes('ugc') || lieu.includes('mk2') || lieu.includes('pathé') || lieu.includes('gaumont')) return 'cinema';
  if (lieu.includes('théâtre') || lieu.includes('comédie') || lieu.includes('odéon')) return 'theatre';
  return 'officiel';
}

function formatDateLongue(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function DetailEvenementOfficiel({ route, navigation }) {
  const { evenement } = route.params;
  const { theme, facteurTexte, CATEGORIES_COULEURS, CAT_ICONES } = useApp();
  const t = (size) => size * facteurTexte;

  const typeSpecial = detecterTypeSpecial(evenement);
  const config = TYPE_SPECIAL_CONFIG[typeSpecial];
  const couleur = config.couleur;
  const src = SOURCE_CONFIG[evenement.source] || SOURCE_CONFIG.que_faire_paris;
  const cat = CATEGORIES_COULEURS[evenement.categorie] || { claire: '#DBEAFE', forte: '#2563EB', texte: '#1E40AF' };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={couleur} />
        </TouchableOpacity>
        <Text style={[styles.headerTitre, { color: theme.text, fontSize: t(16) }]} numberOfLines={1}>
          {evenement.titre}
        </Text>
        <TouchableOpacity
          style={[styles.shareBtn, { backgroundColor: couleur + '15' }]}
          onPress={() => Share.share({ message: `${evenement.titre}\n${evenement.url || ''}` })}
        >
          <Ionicons name="share-outline" size={18} color={couleur} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Image */}
        {evenement.image_url && (
          <Image
            source={{ uri: evenement.image_url }}
            style={styles.image}
            resizeMode="cover"
          />
        )}

        {/* Bandeau type */}
        <View style={[styles.typeBandeau, { backgroundColor: couleur }]}>
          <Ionicons name={config.icone} size={14} color="#fff" />
          <Text style={{ color: '#fff', fontSize: t(12), fontWeight: '600', letterSpacing: 0.5 }}>
            {config.label.toUpperCase()}
          </Text>
          <View style={{ flex: 1 }} />
          <View style={[styles.sourceBadge, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
            <Text style={{ color: '#fff', fontSize: t(10), fontWeight: '500' }}>{src.label}</Text>
          </View>
        </View>

        <View style={styles.content}>

          {/* Titre */}
          <Text style={[styles.titre, { color: theme.text, fontSize: t(22) }]}>
            {evenement.titre}
          </Text>

          {/* Badges */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            <View style={[styles.badge, { backgroundColor: cat.claire }]}>
              <Ionicons name={CAT_ICONES[evenement.categorie] || 'apps-outline'} size={13} color={cat.forte} />
              <Text style={{ color: cat.forte, fontSize: t(12), fontWeight: '500' }}>{evenement.categorie}</Text>
            </View>
            {evenement.gratuit && (
              <View style={[styles.badge, { backgroundColor: '#DCFCE7' }]}>
                <Ionicons name="checkmark-circle-outline" size={13} color="#22C55E" />
                <Text style={{ color: '#15803D', fontSize: t(12), fontWeight: '500' }}>Gratuit</Text>
              </View>
            )}
            {evenement.prix_min && (
              <View style={[styles.badge, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="ticket-outline" size={13} color="#F59E0B" />
                <Text style={{ color: '#92400E', fontSize: t(12) }}>À partir de {evenement.prix_min}€</Text>
              </View>
            )}
          </View>

          {/* Infos clés */}
          <View style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>

            {evenement.date_debut && (
              <View style={styles.infoLigne}>
                <View style={[styles.infoIcone, { backgroundColor: couleur + '15' }]}>
                  <Ionicons name="calendar-outline" size={16} color={couleur} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text3, fontSize: t(11), marginBottom: 2 }}>Date de début</Text>
                  <Text style={{ color: theme.text, fontSize: t(14), fontWeight: '500' }}>
                    {formatDateLongue(evenement.date_debut)}
                  </Text>
                </View>
              </View>
            )}

            {evenement.date_fin && evenement.date_fin !== evenement.date_debut && (
              <>
                <View style={[styles.infoSep, { backgroundColor: theme.border }]} />
                <View style={styles.infoLigne}>
                  <View style={[styles.infoIcone, { backgroundColor: '#F5F5F5' }]}>
                    <Ionicons name="flag-outline" size={16} color={theme.text3} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text3, fontSize: t(11), marginBottom: 2 }}>Date de fin</Text>
                    <Text style={{ color: theme.text, fontSize: t(14), fontWeight: '500' }}>
                      {formatDateLongue(evenement.date_fin)}
                    </Text>
                  </View>
                </View>
              </>
            )}

            {evenement.lieu && (
              <>
                <View style={[styles.infoSep, { backgroundColor: theme.border }]} />
                <View style={styles.infoLigne}>
                  <View style={[styles.infoIcone, { backgroundColor: '#F5F5F5' }]}>
                    <Ionicons name="location-outline" size={16} color={theme.text3} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text3, fontSize: t(11), marginBottom: 2 }}>Lieu</Text>
                    <Text style={{ color: theme.text, fontSize: t(14), fontWeight: '500' }}>{evenement.lieu}</Text>
                    {evenement.adresse && (
                      <Text style={{ color: theme.text3, fontSize: t(12), marginTop: 2 }}>{evenement.adresse}</Text>
                    )}
                  </View>
                </View>
              </>
            )}

            {evenement.salle && evenement.salle !== evenement.lieu && (
              <>
                <View style={[styles.infoSep, { backgroundColor: theme.border }]} />
                <View style={styles.infoLigne}>
                  <View style={[styles.infoIcone, { backgroundColor: couleur + '15' }]}>
                    <Ionicons name={config.icone} size={16} color={couleur} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text3, fontSize: t(11), marginBottom: 2 }}>Salle</Text>
                    <Text style={{ color: couleur, fontSize: t(14), fontWeight: '500' }}>{evenement.salle}</Text>
                  </View>
                </View>
              </>
            )}

            {evenement.organisateur && (
              <>
                <View style={[styles.infoSep, { backgroundColor: theme.border }]} />
                <View style={styles.infoLigne}>
                  <View style={[styles.infoIcone, { backgroundColor: '#F5F5F5' }]}>
                    <Ionicons name="people-outline" size={16} color={theme.text3} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text3, fontSize: t(11), marginBottom: 2 }}>Organisateur</Text>
                    <Text style={{ color: theme.text, fontSize: t(14) }}>{evenement.organisateur}</Text>
                  </View>
                </View>
              </>
            )}
          </View>

          {/* Description */}
          {evenement.description && (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: theme.text, fontSize: t(16), fontWeight: '500', marginBottom: 8 }}>
                À propos
              </Text>
              <Text style={{ color: theme.text2, fontSize: t(14), lineHeight: 22 }}>
                {evenement.description}
              </Text>
            </View>
          )}

          {/* Bouton principal */}
          {evenement.url && (
            <TouchableOpacity
              style={[styles.btnUrl, { backgroundColor: couleur }]}
              onPress={() => Linking.openURL(evenement.url)}
            >
              <Ionicons name="globe-outline" size={18} color="#fff" />
              <Text style={{ color: '#fff', fontSize: t(15), fontWeight: '500' }}>
                Voir sur {src.label}
              </Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>
          )}

          {/* Actions secondaires */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <TouchableOpacity
              style={[styles.btnSecondaire, { backgroundColor: theme.card, borderColor: theme.border, flex: 1 }]}
              onPress={() => Share.share({ message: `${evenement.titre}\n${evenement.lieu || ''}\n${evenement.url || ''}` })}
            >
              <Ionicons name="share-social-outline" size={17} color={theme.text} />
              <Text style={{ color: theme.text, fontSize: t(13), fontWeight: '500' }}>Partager</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnSecondaire, { backgroundColor: theme.card, borderColor: theme.border, flex: 1 }]}
              onPress={() => navigation.navigate('Carte')}
            >
              <Ionicons name="map-outline" size={17} color="#2563EB" />
              <Text style={{ color: '#2563EB', fontSize: t(13), fontWeight: '500' }}>Voir sur la carte</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, paddingTop: 56, borderBottomWidth: 0.5 },
  backBtn: { width: 32 },
  headerTitre: { flex: 1, fontWeight: '500' },
  shareBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingBottom: 40 },
  image: { width: '100%', height: 220 },
  typeBandeau: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, paddingHorizontal: 16 },
  sourceBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  content: { padding: 16 },
  titre: { fontWeight: '500', marginBottom: 12, lineHeight: 30 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  infoCard: { borderRadius: 16, borderWidth: 0.5, padding: 4, marginBottom: 16 },
  infoLigne: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 12 },
  infoIcone: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  infoSep: { height: 0.5, marginHorizontal: 12 },
  btnUrl: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, padding: 15, marginBottom: 0 },
  btnSecondaire: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, padding: 12, borderWidth: 0.5 },
});