import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, ScrollView, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useRef } from 'react';
import * as Location from 'expo-location';
import { supabase } from '../supabase';
import { CATEGORIES } from '../AppContext';

const { width, height } = Dimensions.get('window');

const INTERETS = [
  { nom: 'Musique',            icone: 'musical-notes-outline', couleur: '#A855F7' },
  { nom: 'Sport',              icone: 'football-outline',       couleur: '#2563EB' },
  { nom: 'Art',                icone: 'color-palette-outline',  couleur: '#EC4899' },
  { nom: 'Cinéma',             icone: 'film-outline',           couleur: '#9F1239' },
  { nom: 'Théâtre',            icone: 'easel-outline',          couleur: '#4F46E5' },
  { nom: 'Nature & Bien-être', icone: 'leaf-outline',           couleur: '#10B981' },
  { nom: 'Apéro',              icone: 'wine-outline',           couleur: '#F59E0B' },
  { nom: 'Famille',            icone: 'people-outline',         couleur: '#F97316' },
  { nom: 'Cours',              icone: 'school-outline',         couleur: '#6366F1' },
  { nom: 'Marché',             icone: 'storefront-outline',     couleur: '#EF4444' },
  { nom: 'Entraide',           icone: 'heart-outline',          couleur: '#22C55E' },
  { nom: 'Gaming',             icone: 'game-controller-outline', couleur: '#7C3AED' },
];

// Faux marqueurs pour l'illustration de la carte
const FAUX_MARQUEURS = [
  { x: 0.15, y: 0.25, c: '#A855F7' },
  { x: 0.35, y: 0.15, c: '#2563EB' },
  { x: 0.55, y: 0.30, c: '#EC4899' },
  { x: 0.70, y: 0.20, c: '#10B981' },
  { x: 0.25, y: 0.50, c: '#F59E0B' },
  { x: 0.50, y: 0.55, c: '#EF4444' },
  { x: 0.75, y: 0.45, c: '#A855F7' },
  { x: 0.40, y: 0.70, c: '#2563EB' },
  { x: 0.65, y: 0.65, c: '#EC4899' },
  { x: 0.20, y: 0.75, c: '#7C3AED' },
  { x: 0.80, y: 0.70, c: '#F97316' },
];

export default function OnboardingScreen() {
  const [slideActuel, setSlideActuel] = useState(0);
  const [pseudo, setPseudo] = useState('');
  const [interetsChoisis, setInteretsChoisis] = useState([]);
  const [chargement, setChargement] = useState(false);
  const scrollRef = useRef(null);

  const allerSlide = (index) => {
    scrollRef.current?.scrollTo({ x: index * width, animated: true });
    setSlideActuel(index);
  };

  const toggleInteret = (nom) => {
    setInteretsChoisis(prev =>
      prev.includes(nom) ? prev.filter(i => i !== nom) : [...prev, nom]
    );
  };

  const demanderLocalisation = async () => {
    await Location.requestForegroundPermissionsAsync();
    allerSlide(3);
  };

  const terminer = async () => {
    setChargement(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const updates = { onboarding_vu: true };
        if (pseudo.trim()) updates.pseudo = pseudo.trim();
        if (interetsChoisis.length > 0) updates.interets = interetsChoisis;
        await supabase.from('profiles').update(updates).eq('id', user.id);
      }
    } catch {}
    setChargement(false);
  };

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

        {/* ── Slide 1 — Accroche ── */}
        <View style={[styles.slide, { width }]}>
          <View style={styles.slideInner}>
            {/* Illustration carte */}
            <View style={styles.carteIllustration}>
              {/* Fond carte */}
              <View style={styles.carteFond}>
                {/* Seine stylisée */}
                <View style={styles.seine} />
                {/* Marqueurs */}
                {FAUX_MARQUEURS.map((m, i) => (
                  <View key={i} style={[styles.fauxMarqueur, {
                    left: m.x * 260,
                    top: m.y * 180,
                    backgroundColor: m.c,
                  }]}>
                    <View style={[styles.fauxQueue, { borderTopColor: m.c }]} />
                  </View>
                ))}
              </View>
              {/* Logo centré sur la carte */}
              <View style={styles.logoSurCarte}>
                <View style={styles.logoIcone}>
                  <Ionicons name="location" size={14} color="#fff" />
                </View>
                <Text style={styles.logoTexte}>Luma</Text>
              </View>
            </View>

            <View style={styles.texteBloc}>
              <Text style={styles.titrePrincipal}>Paris dans{'\n'}ta poche</Text>
              <Text style={styles.sousTitrePrincipal}>
                Découvre ce qui se passe autour de toi — concerts, cinémas, marchés, événements de quartier
              </Text>
            </View>
          </View>
        </View>

        {/* ── Slide 2 — Fonctionnalités ── */}
        <View style={[styles.slide, { width }]}>
          <TouchableOpacity style={styles.passerBtn} onPress={terminer}>
            <Text style={styles.passerTexte}>Passer</Text>
          </TouchableOpacity>
          <View style={styles.slideInner}>
            <Text style={styles.titreCentré}>Ce que tu peux faire</Text>
            <Text style={styles.sousTitreCentré}>Une seule app pour tout ce qui se passe près de chez toi</Text>

            <View style={styles.cartesFeatures}>
              <View style={[styles.carteFeature, { borderColor: '#A855F720' }]}>
                <View style={[styles.featureIcone, { backgroundColor: '#A855F7' }]}>
                  <Ionicons name="map-outline" size={22} color="#fff" />
                </View>
                <Text style={styles.featureTitre}>Explore</Text>
                <Text style={styles.featureDesc}>Concerts, cinémas, théâtres, marchés et salles de sport autour de toi</Text>
              </View>

              <View style={[styles.carteFeature, { borderColor: '#22C55E20' }]}>
                <View style={[styles.featureIcone, { backgroundColor: '#22C55E' }]}>
                  <Ionicons name="people-outline" size={22} color="#fff" />
                </View>
                <Text style={styles.featureTitre}>Rejoins</Text>
                <Text style={styles.featureDesc}>Des événements créés par tes voisins — apéros, sport, balades, entraide</Text>
              </View>

              <View style={[styles.carteFeature, { borderColor: '#F59E0B20' }]}>
                <View style={[styles.featureIcone, { backgroundColor: '#F59E0B' }]}>
                  <Ionicons name="add-circle-outline" size={22} color="#fff" />
                </View>
                <Text style={styles.featureTitre}>Crée</Text>
                <Text style={styles.featureDesc}>Organise ton propre événement en quelques secondes, en lieu public</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Slide 3 — Localisation ── */}
        <View style={[styles.slide, { width }]}>
          <TouchableOpacity style={styles.passerBtn} onPress={terminer}>
            <Text style={styles.passerTexte}>Passer</Text>
          </TouchableOpacity>
          <View style={[styles.slideInner, { justifyContent: 'center' }]}>
            <View style={styles.localisationIcone}>
              <View style={styles.localisationAnneaux}>
                <View style={[styles.anneau, { width: 140, height: 140, opacity: 0.08 }]} />
                <View style={[styles.anneau, { width: 100, height: 100, opacity: 0.12 }]} />
                <View style={[styles.anneau, { width: 64, height: 64, opacity: 0.2 }]} />
              </View>
              <View style={styles.localisationBulle}>
                <Ionicons name="navigate" size={28} color="#2563EB" />
              </View>
            </View>

            <Text style={[styles.titreCentré, { marginTop: 32 }]}>Active ta localisation</Text>
            <Text style={[styles.sousTitreCentré, { marginBottom: 32 }]}>
              Pour voir les événements et lieux autour de toi en temps réel
            </Text>

            {/* Bouton localisation */}
            <TouchableOpacity
              style={styles.btnLocalisation}
              onPress={demanderLocalisation}
            >
              <Ionicons name="location-outline" size={20} color="#fff" />
              <Text style={styles.btnLocalisationTexte}>Autoriser la localisation</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnPlusTard} onPress={() => allerSlide(3)}>
              <Text style={styles.btnPlusTardTexte}>Plus tard</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Slide 4 — Profil ── */}
        <View style={[styles.slide, { width }]}>
          <View style={styles.slideInner}>
            <Text style={styles.titreCentré}>Ton profil</Text>
            <Text style={[styles.sousTitreCentré, { marginBottom: 20 }]}>Optionnel — tu peux compléter plus tard</Text>

            {/* Pseudo */}
            <View style={styles.inputWrap}>
              <Ionicons name="person-outline" size={18} color="#888" style={styles.inputIcone} />
              <TextInput
                style={styles.input}
                placeholder="Ton pseudo"
                placeholderTextColor="#aaa"
                value={pseudo}
                onChangeText={setPseudo}
                maxLength={30}
                autoCorrect={false}
              />
            </View>

            {/* Centres d'intérêt */}
            <Text style={styles.interetsLabel}>Tes centres d'intérêt</Text>
            <View style={styles.interetsGrille}>
              {INTERETS.map(interet => {
                const actif = interetsChoisis.includes(interet.nom);
                return (
                  <TouchableOpacity
                    key={interet.nom}
                    style={[styles.interetChip, {
                      backgroundColor: actif ? interet.couleur : '#F5F5F5',
                      borderColor: actif ? interet.couleur : '#E8E8E8',
                    }]}
                    onPress={() => toggleInteret(interet.nom)}
                  >
                    <Ionicons
                      name={interet.icone}
                      size={13}
                      color={actif ? '#fff' : interet.couleur}
                    />
                    <Text style={[styles.interetTexte, { color: actif ? '#fff' : '#444' }]}>
                      {interet.nom}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

      </ScrollView>

      {/* ── Barre de navigation ── */}
      <View style={styles.bas}>
        {/* Indicateurs */}
        <View style={styles.indicateurs}>
          {[0, 1, 2, 3].map(i => (
            <TouchableOpacity
              key={i}
              onPress={() => allerSlide(i)}
              style={[styles.indicateur, {
                backgroundColor: i === slideActuel ? '#111' : '#E0E0E0',
                width: i === slideActuel ? 24 : 8,
              }]}
            />
          ))}
        </View>

        {/* Boutons */}
        <View style={styles.boutonsRow}>
          {slideActuel > 0 && (
            <TouchableOpacity
              style={styles.btnRetour}
              onPress={() => allerSlide(slideActuel - 1)}
            >
              <Ionicons name="chevron-back" size={20} color="#888" />
            </TouchableOpacity>
          )}

          {slideActuel === 0 && (
            <TouchableOpacity
              style={styles.btnPrincipal}
              onPress={() => allerSlide(1)}
            >
              <Text style={styles.btnPrincipalTexte}>Découvrir Luma</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          )}

          {slideActuel === 1 && (
            <TouchableOpacity
              style={styles.btnPrincipal}
              onPress={() => allerSlide(2)}
            >
              <Text style={styles.btnPrincipalTexte}>Suivant</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          )}

          {slideActuel === 2 && (
            <TouchableOpacity
              style={styles.btnPrincipal}
              onPress={demanderLocalisation}
            >
              <Text style={styles.btnPrincipalTexte}>Suivant</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          )}

          {slideActuel === 3 && (
            <TouchableOpacity
              style={[styles.btnPrincipal, { backgroundColor: '#111', opacity: chargement ? 0.7 : 1 }]}
              onPress={terminer}
              disabled={chargement}
            >
              <Ionicons name="rocket-outline" size={18} color="#fff" />
              <Text style={styles.btnPrincipalTexte}>
                {chargement ? 'Chargement...' : 'C\'est parti !'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  slide: { flex: 1, paddingTop: 56 },
  slideInner: { flex: 1, paddingHorizontal: 24, paddingBottom: 16 },
  passerBtn: { alignSelf: 'flex-end', paddingHorizontal: 24, paddingVertical: 8 },
  passerTexte: { color: '#888', fontSize: 14 },

  // Carte illustration
  carteIllustration: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 8,
  },
  carteFond: {
    width: 280,
    height: 200,
    borderRadius: 20,
    backgroundColor: '#EEF2F7',
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 0.5,
    borderColor: '#D8E0EC',
  },
  seine: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    height: 18,
    backgroundColor: '#C8D8EC',
    borderRadius: 9,
    marginHorizontal: 10,
    transform: [{ skewY: '-2deg' }],
  },
  fauxMarqueur: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  fauxQueue: {
    position: 'absolute',
    bottom: -5,
    width: 0,
    height: 0,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderTopWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    left: 4,
  },
  logoSurCarte: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  logoIcone: {
    width: 16,
    height: 16,
    borderRadius: 5,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoTexte: { fontSize: 11, fontWeight: '500', color: '#111' },

  // Textes
  texteBloc: { gap: 12 },
  titrePrincipal: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -1,
    color: '#111',
    lineHeight: 40,
  },
  sousTitrePrincipal: {
    fontSize: 15,
    color: '#666',
    lineHeight: 23,
  },
  titreCentré: {
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.5,
    color: '#111',
    textAlign: 'center',
    marginBottom: 8,
  },
  sousTitreCentré: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 8,
  },

  // Features
  cartesFeatures: { gap: 10, marginTop: 16 },
  carteFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    backgroundColor: '#FAFAFA',
  },
  featureIcone: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  featureTitre: { fontSize: 15, fontWeight: '600', color: '#111', marginBottom: 2 },
  featureDesc: { fontSize: 12, color: '#777', lineHeight: 17, flex: 1 },

  // Localisation
  localisationIcone: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 160,
  },
  localisationAnneaux: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  anneau: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#2563EB',
  },
  localisationBulle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  btnLocalisation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  btnLocalisationTexte: { color: '#fff', fontSize: 15, fontWeight: '600' },
  btnPlusTard: { alignItems: 'center', padding: 8 },
  btnPlusTardTexte: { color: '#888', fontSize: 14 },

  // Profil
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 14,
    marginBottom: 20,
    height: 52,
  },
  inputIcone: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: '#111' },
  interetsLabel: { fontSize: 13, fontWeight: '500', color: '#888', marginBottom: 10 },
  interetsGrille: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  interetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderWidth: 1.5,
  },
  interetTexte: { fontSize: 12, fontWeight: '500' },

  // Navigation bas
  bas: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    paddingTop: 12,
    backgroundColor: '#fff',
    gap: 14,
    borderTopWidth: 0.5,
    borderTopColor: '#F0F0F0',
  },
  indicateurs: { flexDirection: 'row', justifyContent: 'center', gap: 6, alignItems: 'center' },
  indicateur: { height: 8, borderRadius: 4 },
  boutonsRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  btnRetour: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrincipal: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 16,
  },
  btnPrincipalTexte: { color: '#fff', fontSize: 16, fontWeight: '600' },
});