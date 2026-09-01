import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Linking, Share, Image, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp, CATEGORIES, formatDateParis } from '../AppContext';
import ReactionsRapides from '../components/ReactionsRapides';

export default function DetailEvenementOfficiel({ route, navigation }) {
  const { evenement } = route.params;
  const { facteurTexte, profil } = useApp();
  const t = (s) => s * facteurTexte;

  const cat = CATEGORIES[evenement?.categorie] || { forte: '#2563EB', claire: '#DBEAFE', texte: '#1E40AF', icone: 'calendar-outline' };

  const ouvrirLien = () => { if (evenement?.url) Linking.openURL(evenement.url); };
  const partager = () => Share.share({ message: `${evenement?.titre}\n${evenement?.url || ''}` });
  const ouvrirCarte = () => {
    if (!evenement?.latitude || !evenement?.longitude) return;
    const url = Platform.OS === 'ios'
      ? `maps://?q=${evenement.latitude},${evenement.longitude}`
      : `geo:${evenement.latitude},${evenement.longitude}`;
    Linking.openURL(url);
  };

  if (!evenement) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color="#2563EB" />
          <Text style={{ color: '#2563EB', fontSize: t(16) }}>Retour</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={partager} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="share-outline" size={22} color="#111" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Image ou placeholder */}
        {evenement.image_url ? (
          <Image source={{ uri: evenement.image_url }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.imagePlaceholder, { backgroundColor: cat.claire }]}>
            <Ionicons name={cat.icone?.replace('-outline', '') || 'calendar'} size={52} color={cat.forte} />
          </View>
        )}

        <View style={styles.body}>
          {/* Tags */}
          <View style={styles.tagsRow}>
            <View style={[styles.tag, { backgroundColor: cat.claire }]}>
              <Ionicons name={cat.icone} size={12} color={cat.forte} />
              <Text style={{ color: cat.texte, fontSize: t(12), fontWeight: '500' }}>{evenement.categorie}</Text>
            </View>
            {evenement.gratuit && (
              <View style={[styles.tag, { backgroundColor: '#DCFCE7' }]}>
                <Ionicons name="ticket-outline" size={12} color="#15803D" />
                <Text style={{ color: '#15803D', fontSize: t(12), fontWeight: '500' }}>Gratuit</Text>
              </View>
            )}
            {evenement.prix_min && (
              <View style={[styles.tag, { backgroundColor: '#FEF3C7' }]}>
                <Text style={{ color: '#92400E', fontSize: t(12) }}>Dès {evenement.prix_min}€</Text>
              </View>
            )}
          </View>

          {/* Titre */}
          <Text style={[styles.titre, { fontSize: t(24) }]}>{evenement.titre}</Text>

          {/* Infos */}
          <View style={styles.infosCard}>
            {evenement.date_debut && (
              <View style={styles.infoRow}>
                <View style={[styles.infoIcone, { backgroundColor: cat.claire }]}>
                  <Ionicons name="calendar-outline" size={16} color={cat.forte} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoLabel, { fontSize: t(11) }]}>DATE</Text>
                  <Text style={[styles.infoVal, { fontSize: t(14) }]}>{formatDateParis(evenement.date_debut)}</Text>
                  {evenement.date_fin && <Text style={[styles.infoSub, { fontSize: t(12) }]}>→ {formatDateParis(evenement.date_fin)}</Text>}
                </View>
              </View>
            )}

            {(evenement.salle || evenement.lieu) && (
              <View style={[styles.infoRow, { borderTopWidth: 0.5, borderTopColor: 'rgba(0,0,0,0.05)', marginTop: 12, paddingTop: 12 }]}>
                <View style={[styles.infoIcone, { backgroundColor: '#f0f0ee' }]}>
                  <Ionicons name="business-outline" size={16} color="#666" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoLabel, { fontSize: t(11) }]}>LIEU</Text>
                  <Text style={[styles.infoVal, { fontSize: t(14) }]}>{evenement.salle || evenement.lieu}</Text>
                  {evenement.adresse && <Text style={[styles.infoSub, { fontSize: t(12) }]}>{evenement.adresse}</Text>}
                </View>
                {evenement.latitude && evenement.longitude && (
                  <TouchableOpacity onPress={ouvrirCarte} style={[styles.mapBtn, { backgroundColor: cat.claire }]}>
                    <Ionicons name="map" size={14} color={cat.forte} />
                    <Text style={{ color: cat.forte, fontSize: t(11), fontWeight: '500' }}>Carte</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {evenement.organisateur && (
              <View style={[styles.infoRow, { borderTopWidth: 0.5, borderTopColor: 'rgba(0,0,0,0.05)', marginTop: 12, paddingTop: 12 }]}>
                <View style={[styles.infoIcone, { backgroundColor: '#f0f0ee' }]}>
                  <Ionicons name="person-outline" size={16} color="#666" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoLabel, { fontSize: t(11) }]}>ORGANISATEUR</Text>
                  <Text style={[styles.infoVal, { fontSize: t(14) }]}>{evenement.organisateur}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Réactions rapides */}
          <View style={styles.reactionsWrap}>
            <ReactionsRapides evenementOfficielId={evenement.id} profilId={profil?.id} t={t} />
          </View>

          {/* Description */}
          {evenement.description && (
            <View style={styles.descCard}>
              <Text style={[styles.descTitre, { fontSize: t(13) }]}>À PROPOS</Text>
              <Text style={[styles.desc, { fontSize: t(14) }]}>{evenement.description}</Text>
            </View>
          )}

          {/* Bouton billetterie */}
          {evenement.url && (
            <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: cat.forte }]} onPress={ouvrirLien} activeOpacity={0.85}>
              <Ionicons name="ticket-outline" size={18} color="#fff" />
              <Text style={[styles.btnPrimaryTxt, { fontSize: t(15) }]}>
                {evenement.gratuit ? 'Voir l\'événement' : 'Réserver'}
              </Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>
          )}

          {/* Boutons secondaires */}
          <View style={styles.btnsSecondaires}>
            {evenement.latitude && evenement.longitude && (
              <TouchableOpacity style={styles.btnSec} onPress={ouvrirCarte} activeOpacity={0.8}>
                <Ionicons name="map-outline" size={18} color="#111" />
                <Text style={[styles.btnSecTxt, { fontSize: t(13) }]}>Itinéraire</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.btnSec} onPress={partager} activeOpacity={0.8}>
              <Ionicons name="share-outline" size={18} color="#111" />
              <Text style={[styles.btnSecTxt, { fontSize: t(13) }]}>Partager</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSec} onPress={() => navigation.navigate('CreerStory', { evenement })} activeOpacity={0.8}>
              <Ionicons name="camera-outline" size={18} color="#111" />
              <Text style={[styles.btnSecTxt, { fontSize: t(13) }]}>Story</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf8' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 54 : 16, paddingBottom: 12, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, backgroundColor: 'rgba(250,250,248,0.95)' },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  image: { width: '100%', height: 260, marginTop: Platform.OS === 'ios' ? 96 : 60 },
  imagePlaceholder: { width: '100%', height: 220, marginTop: Platform.OS === 'ios' ? 96 : 60, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 20 },
  tagsRow: { flexDirection: 'row', gap: 7, flexWrap: 'wrap', marginBottom: 12 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  titre: { fontWeight: '700', color: '#111', letterSpacing: -0.5, marginBottom: 16, lineHeight: 30 },
  infosCard: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.06)' },
  reactionsWrap: { marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  infoIcone: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  infoLabel: { fontWeight: '700', color: '#aaa', letterSpacing: 0.06, marginBottom: 3 },
  infoVal: { fontWeight: '500', color: '#111' },
  infoSub: { color: '#aaa', marginTop: 2 },
  mapBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' },
  descCard: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.06)' },
  descTitre: { fontWeight: '700', color: '#aaa', letterSpacing: 0.06, marginBottom: 8 },
  desc: { color: '#555', lineHeight: 22 },
  btnPrimary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, padding: 16, marginBottom: 12 },
  btnPrimaryTxt: { color: '#fff', fontWeight: '700' },
  btnsSecondaires: { flexDirection: 'row', gap: 10 },
  btnSec: { flex: 1, flexDirection: 'column', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.06)' },
  btnSecTxt: { color: '#111', fontWeight: '500' },
});