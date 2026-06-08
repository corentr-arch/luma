import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useRef } from 'react';
import { supabase } from '../supabase';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    id: 1,
    titre: 'Bienvenue sur Luma',
    sous_titre: 'rejoins ton quartier',
    description: 'Découvre ce qui se passe autour de toi en temps réel. Événements sportifs, apéros, marchés, concerts — tout est près de chez toi.',
    icone: 'location',
    couleur: '#2563EB',
    bg: '#DBEAFE',
    items: [
      { icon: 'map-outline',        texte: 'Carte interactive en temps réel' },
      { icon: 'search-outline',     texte: 'Recherche par catégorie ou date' },
      { icon: 'navigate-outline',   texte: 'Filtré par ton rayon géographique' },
    ],
  },
  {
    id: 2,
    titre: 'Crée et rejoins',
    sous_titre: 'des événements locaux',
    description: 'Organise un événement en quelques secondes. Choisis le lieu sur la carte, la durée, le nombre de participants.',
    icone: 'add-circle',
    couleur: '#22C55E',
    bg: '#DCFCE7',
    items: [
      { icon: 'timer-outline',            texte: 'Événements temporaires ou lieux fixes' },
      { icon: 'shield-checkmark-outline', texte: 'Validation manuelle des participants' },
      { icon: 'star-outline',             texte: 'Avis et notes après l\'événement' },
    ],
  },
  {
    id: 3,
    titre: 'Une communauté',
    sous_titre: 'de confiance',
    description: 'Tous les événements se déroulent en lieu public. Les profils sont vérifiés, les scores de confiance visibles.',
    icone: 'shield-checkmark',
    couleur: '#A855F7',
    bg: '#F3E8FF',
    items: [
      { icon: 'location-outline', texte: 'Lieux publics uniquement — jamais d\'adresse privée' },
      { icon: 'person-outline',   texte: 'Profils publics avec historique' },
      { icon: 'flag-outline',     texte: 'Signalement intégré' },
    ],
  },
  {
    id: 4,
    titre: 'C\'est parti !',
    sous_titre: 'explore ta ville',
    description: 'La carte t\'attend. Explore les événements près de toi, ou crée le tien en appuyant sur le bouton +.',
    icone: 'rocket',
    couleur: '#F59E0B',
    bg: '#FEF3C7',
    items: [
      { icon: 'chatbubble-outline',    texte: 'Commente et pose des questions' },
      { icon: 'bookmark-outline',      texte: 'Sauvegarde tes événements favoris' },
      { icon: 'notifications-outline', texte: 'Alertes personnalisées par catégorie' },
    ],
  },
];

export default function OnboardingScreen() {
  const [slideActuel, setSlideActuel] = useState(0);
  const [chargement, setChargement] = useState(false);
  const scrollRef = useRef(null);

  const allerSlide = (index) => {
    scrollRef.current?.scrollTo({ x: index * width, animated: true });
    setSlideActuel(index);
  };

  // Ne navigue pas manuellement — met juste onboarding_vu à true
  // App.js détecte le changement et redirige automatiquement
  const terminer = async () => {
    setChargement(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('profiles')
          .update({ onboarding_vu: true })
          .eq('id', user.id);
      }
    } catch {}
    setChargement(false);
  };

  const slide = SLIDES[slideActuel];

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        style={{ flex: 1 }}
      >
        {SLIDES.map((s, index) => (
          <View key={s.id} style={[styles.slide, { width }]}>
            {index < SLIDES.length - 1 && (
              <TouchableOpacity style={styles.passerBtn} onPress={terminer}>
                <Text style={styles.passerTexte}>Passer</Text>
              </TouchableOpacity>
            )}
            <View style={styles.iconeCentreWrap}>
              <View style={[styles.iconeExterne, { backgroundColor: s.bg }]}>
                <View style={[styles.iconeInterne, { backgroundColor: s.couleur }]}>
                  <Ionicons name={s.icone} size={52} color="#fff" />
                </View>
              </View>
            </View>
            <View style={styles.texteWrap}>
              <Text style={styles.slideTitre}>{s.titre}</Text>
              <Text style={[styles.slideSousTitre, { color: s.couleur }]}>{s.sous_titre}</Text>
              <Text style={styles.slideDescription}>{s.description}</Text>
            </View>
            <View style={styles.itemsWrap}>
              {s.items.map((item, i) => (
                <View key={i} style={[styles.item, { backgroundColor: s.bg }]}>
                  <View style={[styles.itemIcone, { backgroundColor: s.couleur }]}>
                    <Ionicons name={item.icon} size={16} color="#fff" />
                  </View>
                  <Text style={styles.itemTexte}>{item.texte}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.bas}>
        <View style={styles.indicateurs}>
          {SLIDES.map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => allerSlide(i)}
              style={[styles.indicateur, {
                backgroundColor: i === slideActuel ? slide.couleur : '#E0E0E0',
                width: i === slideActuel ? 24 : 8,
              }]}
            />
          ))}
        </View>
        <View style={styles.boutonsRow}>
          {slideActuel > 0 && (
            <TouchableOpacity
              style={styles.btnRetour}
              onPress={() => allerSlide(slideActuel - 1)}
            >
              <Ionicons name="chevron-back" size={20} color="#888" />
            </TouchableOpacity>
          )}
          {slideActuel < SLIDES.length - 1 ? (
            <TouchableOpacity
              style={[styles.btnSuivant, { backgroundColor: slide.couleur }]}
              onPress={() => allerSlide(slideActuel + 1)}
            >
              <Text style={styles.btnSuivantTexte}>Suivant</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.btnSuivant, { backgroundColor: '#111', opacity: chargement ? 0.7 : 1 }]}
              onPress={terminer}
              disabled={chargement}
            >
              <Ionicons name="rocket" size={18} color="#fff" />
              <Text style={styles.btnSuivantTexte}>C'est parti !</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  slide: { flex: 1, paddingHorizontal: 28, paddingTop: 60, paddingBottom: 20 },
  passerBtn: { alignSelf: 'flex-end', padding: 8 },
  passerTexte: { color: '#888', fontSize: 14 },
  iconeCentreWrap: { alignItems: 'center', marginTop: 20, marginBottom: 32 },
  iconeExterne: { width: 160, height: 160, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  iconeInterne: { width: 120, height: 120, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  texteWrap: { marginBottom: 28 },
  slideTitre: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5, marginBottom: 4, color: '#111' },
  slideSousTitre: { fontSize: 18, fontWeight: '500', marginBottom: 12 },
  slideDescription: { fontSize: 15, color: '#555', lineHeight: 24 },
  itemsWrap: { gap: 10 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 14 },
  itemIcone: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  itemTexte: { fontSize: 14, flex: 1, lineHeight: 20, color: '#333' },
  bas: { paddingHorizontal: 28, paddingBottom: 48, paddingTop: 16, backgroundColor: '#fff', gap: 16 },
  indicateurs: { flexDirection: 'row', justifyContent: 'center', gap: 6, alignItems: 'center' },
  indicateur: { height: 8, borderRadius: 4 },
  boutonsRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  btnRetour: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: '#E0E0E0', alignItems: 'center', justifyContent: 'center' },
  btnSuivant: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, padding: 16 },
  btnSuivantTexte: { color: '#fff', fontSize: 16, fontWeight: '600' },
});