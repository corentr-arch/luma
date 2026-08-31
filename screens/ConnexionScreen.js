import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { supabase } from '../supabase';

export default function ConnexionScreen() {
  const [email, setEmail] = useState('');
  const [mdp, setMdp] = useState('');
  const [chargement, setChargement] = useState(false);
  const [mdpVisible, setMdpVisible] = useState(false);
  const [mode, setMode] = useState('connexion');
  const [prenom, setPrenom] = useState('');

  const connexion = async () => {
    if (!email.trim() || !mdp.trim()) { Alert.alert('Champs requis', 'Remplis tous les champs.'); return; }
    setChargement(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: mdp });
    if (error) Alert.alert('Erreur', error.message);
    setChargement(false);
  };

  const inscription = async () => {
    if (!email.trim() || !mdp.trim() || !prenom.trim()) { Alert.alert('Champs requis', 'Remplis tous les champs.'); return; }
    if (mdp.length < 6) { Alert.alert('Mot de passe trop court', 'Minimum 6 caractères.'); return; }
    setChargement(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password: mdp,
      options: { data: { prenom: prenom.trim() } },
    });
    if (error) {
      Alert.alert('Erreur', error.message);
    } else if (data?.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id, prenom: prenom.trim(),
        score_confiance: 10, created_at: new Date().toISOString(),
      });
      Alert.alert('Compte créé !', 'Bienvenue sur Luma !');
    }
    setChargement(false);
  };

  const PERKS = [
    { icon: 'map-outline', bg: '#DBEAFE', couleur: '#1D4ED8', titre: 'Découvre autour de toi', sub: 'Événements, stories et lieux en temps réel' },
    { icon: 'people-outline', bg: '#DCFCE7', couleur: '#15803D', titre: 'Rejoins ta communauté', sub: 'Crée et participe à des événements locaux' },
    { icon: 'camera-outline', bg: '#F3E8FF', couleur: '#7E22CE', titre: 'Partage tes spots', sub: 'Stories géolocalisées, visibles 24h sur la carte' },
  ];

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          <View style={styles.hero}>
            <View style={styles.logoWrap}>
              <Ionicons name="location" size={28} color="#111" />
            </View>
            <Text style={styles.appName}>Luma</Text>
            <Text style={styles.tagline}>rejoins ton quartier</Text>
          </View>

          <View style={styles.body}>
            {mode === 'connexion' && (
              <View style={styles.perksWrap}>
                {PERKS.map((p, i) => (
                  <View key={i} style={styles.perk}>
                    <View style={[styles.perkIcone, { backgroundColor: p.bg }]}>
                      <Ionicons name={p.icon} size={16} color={p.couleur} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.perkTitre}>{p.titre}</Text>
                      <Text style={styles.perkSub}>{p.sub}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {mode === 'inscription' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>PRÉNOM</Text>
                <View style={styles.inputField}>
                  <Ionicons name="person-outline" size={17} color="#aaa" />
                  <TextInput
                    style={styles.input}
                    placeholder="Ton prénom"
                    placeholderTextColor="#aaa"
                    value={prenom}
                    onChangeText={setPrenom}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>EMAIL</Text>
              <View style={styles.inputField}>
                <Ionicons name="mail-outline" size={17} color="#aaa" />
                <TextInput
                  style={styles.input}
                  placeholder="ton@email.com"
                  placeholderTextColor="#aaa"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  returnKeyType="next"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>MOT DE PASSE</Text>
              <View style={styles.inputField}>
                <Ionicons name="lock-closed-outline" size={17} color="#aaa" />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="••••••••"
                  placeholderTextColor="#aaa"
                  value={mdp}
                  onChangeText={setMdp}
                  secureTextEntry={!mdpVisible}
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={mode === 'connexion' ? connexion : inscription}
                />
                <TouchableOpacity onPress={() => setMdpVisible(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name={mdpVisible ? 'eye-outline' : 'eye-off-outline'} size={17} color="#aaa" />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.btnPrimary, { opacity: chargement ? 0.7 : 1 }]}
              onPress={mode === 'connexion' ? connexion : inscription}
              disabled={chargement}
              activeOpacity={0.85}
            >
              {chargement
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.btnPrimaryTxt}>{mode === 'connexion' ? 'Connexion' : 'Créer mon compte'}</Text>
              }
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerTxt}>ou continue avec</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.socialRow}>
              <TouchableOpacity style={styles.socialBtn} onPress={() => Alert.alert('Bientôt disponible')} activeOpacity={0.85}>
                <Ionicons name="logo-apple" size={18} color="#111" />
                <Text style={styles.socialTxt}>Apple</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialBtn} onPress={() => Alert.alert('Bientôt disponible')} activeOpacity={0.85}>
                <Ionicons name="logo-google" size={17} color="#EA4335" />
                <Text style={styles.socialTxt}>Google</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.switchMode}>
              <Text style={styles.switchTxt}>{mode === 'connexion' ? 'Pas encore de compte ? ' : 'Déjà un compte ? '}</Text>
              <TouchableOpacity onPress={() => setMode(m => m === 'connexion' ? 'inscription' : 'connexion')}>
                <Text style={styles.switchLink}>{mode === 'connexion' ? 'Créer un compte' : 'Se connecter'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf8' },
  hero: { backgroundColor: '#111', paddingTop: Platform.OS === 'ios' ? 70 : 50, paddingBottom: 36, alignItems: 'center', gap: 10 },
  logoWrap: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  appName: { fontSize: 34, fontWeight: '700', color: '#fff', letterSpacing: -0.8 },
  tagline: { fontSize: 14, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.1 },
  body: { padding: 22, paddingBottom: 40 },
  perksWrap: { marginBottom: 22, gap: 8 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f5f5f3', borderRadius: 14, padding: 12 },
  perkIcone: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  perkTitre: { fontSize: 13, fontWeight: '600', color: '#111', marginBottom: 1 },
  perkSub: { fontSize: 11, color: '#888', lineHeight: 15 },
  inputGroup: { marginBottom: 12 },
  inputLabel: { fontSize: 11, fontWeight: '600', color: '#aaa', letterSpacing: 0.08, marginBottom: 6 },
  inputField: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f0f0ee', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13 },
  input: { flex: 1, fontSize: 15, color: '#111' },
  btnPrimary: { backgroundColor: '#111', borderRadius: 14, padding: 15, alignItems: 'center', marginTop: 6, marginBottom: 4 },
  btnPrimaryTxt: { fontSize: 15, fontWeight: '600', color: '#fff', letterSpacing: -0.2 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 18 },
  dividerLine: { flex: 1, height: 0.5, backgroundColor: 'rgba(0,0,0,0.1)' },
  dividerTxt: { fontSize: 12, color: '#aaa', fontWeight: '500' },
  socialRow: { flexDirection: 'row', gap: 10 },
  socialBtn: { flex: 1, backgroundColor: '#f0f0ee', borderRadius: 14, padding: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  socialTxt: { fontSize: 14, fontWeight: '500', color: '#111' },
  switchMode: { flexDirection: 'row', justifyContent: 'center', marginTop: 22 },
  switchTxt: { fontSize: 13, color: '#aaa' },
  switchLink: { fontSize: 13, fontWeight: '600', color: '#111' },
});