import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, ScrollView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useRef } from 'react';
import * as Location from 'expo-location';
import { supabase } from '../supabase';

const { width } = Dimensions.get('window');

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

export default function OnboardingScreen() {
  const [etapeActuelle, setEtapeActuelle] = useState(0);
  const [chargement, setChargement] = useState(false);
  const scrollRef = useRef(null);

  const allerEtapeSuivante = () => {
    if (etapeActuelle < ETAPES.length - 1) {
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
        await supabase.from('profiles').update({ onboarding_vu: true }).eq('id', user.id);
      }
    } catch {}
    setChargement(false);
  };

  const etape = ETAPES[etapeActuelle];

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
      </ScrollView>

      {/* Indicateurs */}
      <View style={styles.indicateurs}>
        {ETAPES.map((_, i) => (
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
            {etapeActuelle === ETAPES.length - 1 ? 'Commencer' : 'Suivant'}
          </Text>
          <Ionicons
            name={etapeActuelle === ETAPES.length - 1 ? 'checkmark' : 'arrow-forward'}
            size={18}
            color="#fff"
          />
        </TouchableOpacity>

        {etapeActuelle < ETAPES.length - 1 && (
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
});