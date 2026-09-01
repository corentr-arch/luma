import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, ScrollView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useRef } from 'react';
import * as Location from 'expo-location';
import { supabase } from '../supabase';

const { width } = Dimensions.get('window');

const CATEGORIES_DISPONIBLES = [
  'Sport', 'Musique', 'Apéro', 'Entraide', 'Art',
  'Marché', 'Nature & Bien-être', 'Famille', 'Cours', 'Cinéma', 'Théâtre', 'Gaming',
];

const INTERETS_PAR_DEFAUT = ['Sport', 'Musique', 'Apéro'];

const ETAPES = [
  {
    icone: 'map',
    couleur: '#2563EB',
    bg: '#DBEAFE',
    titre: 'Découvre ton quartier',
    desc: 'Une carte interactive avec les événements, stories et lieux autour de toi en temps réel.',
  },
  {
    icone: 'people',
    couleur: '#22C55E',
    bg: '#DCFCE7',
    titre: 'Rejoins ta communauté',
    desc: 'Crée ou rejoins des événements locaux — apéros, sport, concerts, marchés...',
  },
  {
    icone: 'camera',
    couleur: '#8B5CF6',
    bg: '#F3E8FF',
    titre: 'Partage tes spots',
    desc: 'Publie des stories géolocalisées visibles 24h sur la carte par tout le monde.',
  },
  {
    icone: 'location',
    couleur: '#EF4444',
    bg: '#FEE2E2',
    titre: 'Active ta localisation',
    desc: 'Pour trouver les événements les plus proches et personnaliser ton expérience.',
  },
];

const TOTAL_ETAPES = ETAPES.length + 1;

export default function OnboardingScreen() {
  const [etapeActuelle, setEtapeActuelle] = useState(0);
  const [chargement, setChargement] = useState(false);
  const [interets, setInterets] = useState(INTERETS_PAR_DEFAUT);
  const scrollRef = useRef(null);

  const toggleInteret = (cat) => {
    setInterets(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };

  const allerEtapeSuivante = () => {
    if (etapeActuelle < TOTAL_ETAPES - 1) {
      const next = etapeActuelle + 1;
      setEtapeActuelle(next);
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
    } else {
      terminer();
    }
  };

  const terminer = async () => {
    setChargement(true);
    try {
      await Location.requestForegroundPermissionsAsync();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('profiles').update({
          onboarding_vu: true,
          centres_interet: interets,
        }).eq('id', user.id);
      }
    } catch {}
    setChargement(false);
  };

  const etape = ETAPES[etapeActuelle] || ETAPES[ETAPES.length - 1];

  return (
    <View style={styles.container}>
      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        {ETAPES.map((e, i) => (
          <View key={i} style={styles.slide}>
            <View style={[styles.slideIconeWrap, { backgroundColor: e.bg }]}>
              <Ionicons name={e.icone} size={52} color={e.couleur} />
            </View>
            <Text style={styles.slideTitre}>{e.titre}</Text>
            <Text style={styles.slideDesc}>{e.desc}</Text>
          </View>
        ))}

        <View style={styles.slide}>
          <View style={[styles.slideIconeWrap, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="heart" size={52} color="#F59E0B" />
          </View>
          <Text style={styles.slideTitre}>Tes centres d'intérêt</Text>
          <Text style={styles.slideDesc}>Pour te proposer des événements qui te ressemblent. Tu peux changer ça plus tard dans ton profil.</Text>
          <View style={styles.interetsGrid}>
            {CATEGORIES_DISPONIBLES.map((cat) => {
              const actif = interets.includes(cat);
              return (
                <TouchableOpacity
                  key={cat}
                  style={[styles.interetChip, actif && styles.interetChipActif]}
                  onPress={() => toggleInteret(cat)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.interetChipTxt, actif && styles.interetChipTxtActif]}>{cat}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Indicateurs */}
      <View style={styles.indicateurs}>
        {Array.from({ length: TOTAL_ETAPES }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === etapeActuelle ? styles.dotActif : styles.dotInactif,
              i === etapeActuelle && { backgroundColor: etape.couleur },
            ]}
          />
        ))}
      </View>

      {/* Bouton */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: etape.couleur, opacity: chargement ? 0.7 : 1 }]}
          onPress={allerEtapeSuivante}
          disabled={chargement}
          activeOpacity={0.85}
        >
          <Text style={styles.btnTxt}>
            {etapeActuelle === TOTAL_ETAPES - 1 ? 'Commencer' : 'Suivant'}
          </Text>
          <Ionicons
            name={etapeActuelle === TOTAL_ETAPES - 1 ? 'checkmark' : 'arrow-forward'}
            size={18}
            color="#fff"
          />
        </TouchableOpacity>

        {etapeActuelle < TOTAL_ETAPES - 1 && (
          <TouchableOpacity onPress={terminer} style={styles.passerBtn}>
            <Text style={styles.passerTxt}>Passer</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf8' },
  slide: { width, flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, paddingTop: Platform.OS === 'ios' ? 80 : 60 },
  slideIconeWrap: { width: 120, height: 120, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 36 },
  slideTitre: { fontSize: 26, fontWeight: '700', color: '#111', textAlign: 'center', letterSpacing: -0.5, marginBottom: 14 },
  slideDesc: { fontSize: 16, color: '#888', textAlign: 'center', lineHeight: 24 },
  indicateurs: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 24 },
  dot: { height: 6, borderRadius: 3 },
  dotActif: { width: 24 },
  dotInactif: { width: 6, backgroundColor: '#E5E7EB' },
  footer: { padding: 24, paddingBottom: Platform.OS === 'ios' ? 48 : 24, gap: 12 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, padding: 16 },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  passerBtn: { alignItems: 'center', padding: 8 },
  passerTxt: { color: '#aaa', fontSize: 15, fontWeight: '500' },
  interetsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 28 },
  interetChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: '#F5F5F3', borderWidth: 1, borderColor: 'transparent' },
  interetChipActif: { backgroundColor: '#111', borderColor: '#111' },
  interetChipTxt: { fontSize: 13, fontWeight: '500', color: '#666' },
  interetChipTxtActif: { color: '#fff' },
});