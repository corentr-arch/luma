import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView,
  Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { supabase } from '../supabase';

const CATEGORIES = [
  { nom: 'Sport',              icon: 'football-outline',      bg: '#DBEAFE', c: '#1E40AF' },
  { nom: 'Musique',            icon: 'musical-notes-outline', bg: '#F3E8FF', c: '#7E22CE' },
  { nom: 'Apéro',              icon: 'wine-outline',          bg: '#FEF3C7', c: '#92400E' },
  { nom: 'Entraide',           icon: 'heart-outline',         bg: '#DCFCE7', c: '#15803D' },
  { nom: 'Art',                icon: 'color-palette-outline', bg: '#FCE7F3', c: '#9D174D' },
  { nom: 'Marché',             icon: 'storefront-outline',    bg: '#FEE2E2', c: '#991B1B' },
  { nom: 'Nature & Bien-être', icon: 'leaf-outline',          bg: '#D1FAE5', c: '#065F46' },
  { nom: 'Famille',            icon: 'people-outline',        bg: '#FFEDD5', c: '#9A3412' },
  { nom: 'Cours',              icon: 'school-outline',        bg: '#EEF2FF', c: '#3730A3' },
];

export default function ConnexionScreen() {
  const [mode, setMode] = useState('connexion');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [prenom, setPrenom] = useState('');
  const [afficherMdp, setAfficherMdp] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState('');

  const traduitErreur = (message) => {
    if (!message) return 'Une erreur est survenue.';
    if (message.includes('Invalid login credentials')) return 'Email ou mot de passe incorrect.';
    if (message.includes('Email not confirmed')) return 'Ton email n\'est pas encore confirmé. Vérifie ta boîte mail.';
    if (message.includes('User already registered')) return 'Un compte existe déjà avec cet email.';
    if (message.includes('Password should be at least')) return 'Le mot de passe doit faire au moins 6 caractères.';
    if (message.includes('Unable to validate email address')) return 'Adresse email invalide.';
    if (message.includes('Email logins are disabled')) return 'La connexion par email est temporairement désactivée.';
    if (message.includes('Signups not allowed')) return 'Les inscriptions sont temporairement désactivées.';
    if (message.includes('rate limit')) return 'Trop de tentatives. Attends quelques minutes.';
    if (message.includes('network')) return 'Problème de connexion. Vérifie ton accès internet.';
    return message;
  };

  const valider = async () => {
    setErreur('');
    if (mode === 'inscription' && !prenom.trim()) { setErreur('Merci d\'entrer ton prénom.'); return; }
    if (!email.trim()) { setErreur('Merci d\'entrer ton email.'); return; }
    if (!motDePasse) { setErreur('Merci d\'entrer ton mot de passe.'); return; }
    if (motDePasse.length < 6) { setErreur('Le mot de passe doit faire au moins 6 caractères.'); return; }

    setChargement(true);

    if (mode === 'connexion') {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: motDePasse,
      });
      if (error) { setErreur(traduitErreur(error.message)); setChargement(false); return; }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: motDePasse,
        options: { data: { prenom: prenom.trim() } },
      });

      if (error) { setErreur(traduitErreur(error.message)); setChargement(false); return; }

      if (data?.user) {
        setTimeout(async () => {
          const { data: profilExiste } = await supabase
            .from('profiles').select('id').eq('id', data.user.id).single();
          if (!profilExiste) {
            const handle = `@${prenom.toLowerCase().trim().replace(/[^a-zA-Z0-9]/g, '')}_${Math.floor(Math.random() * 9000) + 1000}`;
            await supabase.from('profiles').insert({
              id: data.user.id,
              prenom: prenom.trim(),
              handle,
              email_verifie: false,
              onboarding_vu: false,
            });
            await supabase.from('preferences_notifications').insert({ user_id: data.user.id });
          }
        }, 1000);

        if (data.user.confirmed_at || data.session) return;

        Alert.alert(
          'Compte créé !',
          'Vérifie ta boîte mail pour confirmer ton adresse email.',
          [{ text: 'OK', onPress: () => setMode('connexion') }]
        );
      }
    }
    setChargement(false);
  };

  const reinitialiserMotDePasse = async () => {
    if (!email.trim()) { setErreur('Entre ton email pour réinitialiser ton mot de passe.'); return; }
    setChargement(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
    setChargement(false);
    if (error) setErreur(traduitErreur(error.message));
    else Alert.alert('Email envoyé', 'Vérifie ta boîte mail pour réinitialiser ton mot de passe.');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Header noir */}
        <View style={styles.top}>
          <View style={styles.logoRow}>
            <View style={styles.logoIcone}>
              <Ionicons name="location" size={22} color="#fff" />
            </View>
            {/* Luma avec majuscule */}
            <Text style={styles.logoTexte}>Luma</Text>
          </View>
          <Text style={styles.tagline}>rejoins ton quartier</Text>

          {/* Valeurs */}
          <View style={styles.valeursRow}>
            {[
              { icon: 'location-outline',   bg: '#DBEAFE', c: '#1E40AF', label: 'Événements près de toi' },
              { icon: 'shield-outline',      bg: '#DCFCE7', c: '#15803D', label: 'Communauté de confiance' },
              { icon: 'people-outline',      bg: '#F3E8FF', c: '#7E22CE', label: 'Rencontres locales' },
            ].map((v, i) => (
              <View key={i} style={[styles.valeurItem, { backgroundColor: v.bg }]}>
                <Ionicons name={v.icon} size={18} color={v.c} />
                <Text style={[styles.valeurLabel, { color: v.c }]}>{v.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Formulaire blanc */}
        <View style={styles.corps}>
          <View style={styles.switchRow}>
            {['connexion', 'inscription'].map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.switchBtn, mode === m && styles.switchActif]}
                onPress={() => { setMode(m); setErreur(''); }}
              >
                <Ionicons
                  name={m === 'connexion' ? 'log-in-outline' : 'person-add-outline'}
                  size={15}
                  color={mode === m ? '#fff' : '#888'}
                />
                <Text style={[styles.switchTexte, mode === m && styles.switchTexteActif]}>
                  {m === 'connexion' ? 'Connexion' : 'Inscription'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {mode === 'inscription' && (
            <View style={styles.champWrap}>
              <View style={styles.champLabelRow}>
                <View style={[styles.champIcone, { backgroundColor: '#DBEAFE' }]}>
                  <Ionicons name="person-outline" size={13} color="#2563EB" />
                </View>
                <Text style={styles.champLabel}>Prénom</Text>
              </View>
              <TextInput
                style={styles.champ}
                placeholder="Ton prénom"
                placeholderTextColor="#BBBBBB"
                value={prenom}
                onChangeText={(v) => { setPrenom(v); setErreur(''); }}
                autoCapitalize="words"
                maxLength={50}
              />
            </View>
          )}

          <View style={styles.champWrap}>
            <View style={styles.champLabelRow}>
              <View style={[styles.champIcone, { backgroundColor: '#DCFCE7' }]}>
                <Ionicons name="mail-outline" size={13} color="#22C55E" />
              </View>
              <Text style={styles.champLabel}>Adresse e-mail</Text>
            </View>
            <TextInput
              style={styles.champ}
              placeholder="nom@exemple.com"
              placeholderTextColor="#BBBBBB"
              value={email}
              onChangeText={(v) => { setEmail(v); setErreur(''); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.champWrap}>
            <View style={styles.champLabelRow}>
              <View style={[styles.champIcone, { backgroundColor: '#F3E8FF' }]}>
                <Ionicons name="lock-closed-outline" size={13} color="#A855F7" />
              </View>
              <Text style={styles.champLabel}>Mot de passe</Text>
            </View>
            <View style={styles.champMdpWrap}>
              <TextInput
                style={styles.champMdp}
                placeholder="•••••• (6 caractères min)"
                placeholderTextColor="#BBBBBB"
                value={motDePasse}
                onChangeText={(v) => { setMotDePasse(v); setErreur(''); }}
                secureTextEntry={!afficherMdp}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setAfficherMdp(!afficherMdp)} style={styles.oeilBtn}>
                <Ionicons name={afficherMdp ? 'eye-off-outline' : 'eye-outline'} size={18} color="#888" />
              </TouchableOpacity>
            </View>
          </View>

          {erreur !== '' && (
            <View style={styles.erreurWrap}>
              <Ionicons name="alert-circle-outline" size={15} color="#EF4444" />
              <Text style={styles.erreurTexte}>{erreur}</Text>
            </View>
          )}

          {mode === 'connexion' && (
            <TouchableOpacity style={styles.oublie} onPress={reinitialiserMotDePasse}>
              <Text style={styles.oublieTexte}>Mot de passe oublié ?</Text>
            </TouchableOpacity>
          )}

          {mode === 'inscription' && (
            <View style={[styles.infoVerif, { backgroundColor: '#DBEAFE' }]}>
              <Ionicons name="information-circle-outline" size={14} color="#2563EB" />
              <Text style={styles.infoVerifTexte}>
                En créant un compte tu acceptes les règles de la communauté Luma — lieux publics uniquement, respect de tous.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.btnPrincipal, { opacity: chargement ? 0.7 : 1 }]}
            onPress={valider}
            disabled={chargement}
          >
            {chargement ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons
                  name={mode === 'connexion' ? 'log-in-outline' : 'rocket-outline'}
                  size={18} color="#fff"
                />
                <Text style={styles.btnTexte}>
                  {mode === 'connexion' ? 'Se connecter' : 'Créer mon compte'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Catégories preview */}
          <View style={styles.categoriesPreview}>
            <Text style={styles.categoriesPreviewTitre}>9 catégories d'événements</Text>
            <View style={styles.categoriesPreviewRow}>
              {CATEGORIES.map((cat, i) => (
                <View key={i} style={[styles.catPreview, { backgroundColor: cat.bg }]}>
                  <Ionicons name={cat.icon} size={13} color={cat.c} />
                  <Text style={[styles.catPreviewTexte, { color: cat.c }]}>{cat.nom}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  scroll: { flexGrow: 1 },
  top: { backgroundColor: '#111', padding: 28, paddingTop: 68, paddingBottom: 24 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  logoIcone: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  logoTexte: { fontSize: 28, fontWeight: '600', color: '#fff', letterSpacing: -0.5 },
  tagline: { fontSize: 14, color: 'rgba(255,255,255,0.3)', marginBottom: 20 },
  valeursRow: { gap: 8 },
  valeurItem: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 12 },
  valeurLabel: { fontSize: 13, fontWeight: '500' },
  corps: { flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingTop: 28 },
  switchRow: { flexDirection: 'row', backgroundColor: '#F5F5F5', borderRadius: 12, padding: 3, marginBottom: 22 },
  switchBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10, borderRadius: 10 },
  switchActif: { backgroundColor: '#111' },
  switchTexte: { fontSize: 14, color: '#888' },
  switchTexteActif: { color: '#fff', fontWeight: '500' },
  champWrap: { marginBottom: 14 },
  champLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 7 },
  champIcone: { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  champLabel: { fontSize: 12, color: '#555', fontWeight: '500' },
  champ: { backgroundColor: '#F5F5F5', borderRadius: 12, padding: 14, fontSize: 14, color: '#111' },
  champMdpWrap: { backgroundColor: '#F5F5F5', borderRadius: 12, flexDirection: 'row', alignItems: 'center' },
  champMdp: { flex: 1, padding: 14, fontSize: 14, color: '#111' },
  oeilBtn: { padding: 14 },
  erreurWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12, marginBottom: 12 },
  erreurTexte: { flex: 1, fontSize: 13, color: '#EF4444', lineHeight: 18 },
  oublie: { alignItems: 'flex-end', marginBottom: 16, marginTop: -6 },
  oublieTexte: { fontSize: 13, color: '#2563EB' },
  infoVerif: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 10, marginBottom: 14 },
  infoVerifTexte: { flex: 1, fontSize: 12, color: '#1E40AF', lineHeight: 17 },
  btnPrincipal: { backgroundColor: '#111', borderRadius: 14, padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 },
  btnTexte: { color: '#fff', fontSize: 15, fontWeight: '500' },
  categoriesPreview: { marginTop: 24, paddingTop: 20, borderTopWidth: 0.5, borderTopColor: '#F0F0F0' },
  categoriesPreviewTitre: { fontSize: 12, color: '#888', fontWeight: '500', marginBottom: 10, textAlign: 'center' },
  categoriesPreviewRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, justifyContent: 'center' },
  catPreview: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  catPreviewTexte: { fontSize: 11, fontWeight: '500' },
});