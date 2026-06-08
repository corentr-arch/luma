import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, Modal, ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../AppContext';
import { supabase } from '../supabase';
import ErreurReseau from '../components/ErreurReseau';

const TYPES_NOTIF = {
  nouvel_evenement: { icon: 'location-outline',         bg: '#DBEAFE', couleur: '#2563EB', label: 'Événement' },
  participation:    { icon: 'people-outline',            bg: '#DCFCE7', couleur: '#22C55E', label: 'Participation' },
  commentaire:      { icon: 'chatbubble-outline',        bg: '#F3E8FF', couleur: '#A855F7', label: 'Commentaire' },
  demande:          { icon: 'shield-outline',            bg: '#FEF3C7', couleur: '#F59E0B', label: 'Demande' },
  message:          { icon: 'mail-outline',              bg: '#FCE7F3', couleur: '#EC4899', label: 'Message' },
  systeme:          { icon: 'information-circle-outline', bg: '#F5F5F5', couleur: '#888888', label: 'Système' },
};

const CATEGORIES_NOTIF = {
  'Sport':              { forte: '#2563EB', claire: '#DBEAFE', texte: '#1E40AF', icon: 'football-outline' },
  'Musique':            { forte: '#A855F7', claire: '#F3E8FF', texte: '#7E22CE', icon: 'musical-notes-outline' },
  'Apéro':              { forte: '#F59E0B', claire: '#FEF3C7', texte: '#92400E', icon: 'wine-outline' },
  'Entraide':           { forte: '#22C55E', claire: '#DCFCE7', texte: '#15803D', icon: 'heart-outline' },
  'Art':                { forte: '#EC4899', claire: '#FCE7F3', texte: '#9D174D', icon: 'color-palette-outline' },
  'Marché':             { forte: '#EF4444', claire: '#FEE2E2', texte: '#991B1B', icon: 'storefront-outline' },
  'Nature & Bien-être': { forte: '#10B981', claire: '#D1FAE5', texte: '#065F46', icon: 'leaf-outline' },
  'Famille':            { forte: '#F97316', claire: '#FFEDD5', texte: '#9A3412', icon: 'people-outline' },
  'Cours':              { forte: '#6366F1', claire: '#EEF2FF', texte: '#3730A3', icon: 'school-outline' },
};

const RAYONS_OPTIONS = [
  { key: 1000,  label: '1 km' },
  { key: 2000,  label: '2 km' },
  { key: 5000,  label: '5 km' },
  { key: 10000, label: '10 km' },
  { key: 20000, label: '20 km' },
];

export default function NotificationsScreen({ navigation }) {
  const { theme, facteurTexte, profil } = useApp();
  const [notifications, setNotifications] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(false);
  const [modalAlertes, setModalAlertes] = useState(false);
  const [preferences, setPreferences] = useState(null);
  const [sauvegardePref, setSauvegardePref] = useState(false);
  const t = (size) => size * facteurTexte;

  useEffect(() => {
    chargerNotifications();
    chargerPreferences();

    const sub = supabase
      .channel('notifications_realtime')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: profil?.id ? `user_id=eq.${profil.id}` : undefined,
      }, (payload) => {
        setNotifications(prev => [payload.new, ...prev]);
      })
      .subscribe();

    return () => supabase.removeChannel(sub);
  }, [profil?.id]);

  const chargerNotifications = async () => {
    setChargement(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setChargement(false); return; }

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) { setErreur(true); setChargement(false); return; }
      if (data) setNotifications(data);
      setErreur(false);
    } catch { setErreur(true); }
    setChargement(false);
  };

  const chargerPreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('preferences_notifications')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (data) setPreferences(data);
    } catch {}
  };

  const marquerToutLu = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from('notifications')
        .update({ lu: true })
        .eq('user_id', user.id)
        .eq('lu', false);
      setNotifications(prev => prev.map(n => ({ ...n, lu: true })));
    } catch {}
  };

  const supprimerNotification = async (id) => {
    try {
      await supabase.from('notifications').delete().eq('id', id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch {}
  };

  const supprimerToutes = () => {
    Alert.alert(
      'Supprimer toutes les notifications ?',
      'Cette action est irréversible.',
      [
        { text: 'Annuler' },
        {
          text: 'Supprimer', style: 'destructive',
          onPress: async () => {
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) return;
              await supabase.from('notifications').delete().eq('user_id', user.id);
              setNotifications([]);
            } catch {}
          },
        },
      ]
    );
  };

  const marquerLu = async (id) => {
    try {
      await supabase.from('notifications').update({ lu: true }).eq('id', id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, lu: true } : n));
    } catch {}
  };

  const toggleCategorie = (cat) => {
    if (!preferences) return;
    const categories = preferences.categories || [];
    const nouvelles = categories.includes(cat)
      ? categories.filter(c => c !== cat)
      : [...categories, cat];
    setPreferences({ ...preferences, categories: nouvelles });
  };

  const sauvegarderPreferences = async () => {
    if (!preferences) return;
    setSauvegardePref(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setSauvegardePref(false); return; }
      await supabase
        .from('preferences_notifications')
        .update({
          categories: preferences.categories,
          rayon_notifications: preferences.rayon_notifications,
          actif: preferences.actif,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);
      setModalAlertes(false);
      Alert.alert('Sauvegardé !', 'Tes préférences ont été mises à jour.');
    } catch { Alert.alert('Erreur', 'Impossible de sauvegarder.'); }
    setSauvegardePref(false);
  };

  const nbNonLus = notifications.filter(n => !n.lu).length;

  const formaterDate = (dateStr) => {
    const date = new Date(dateStr);
    const diff = new Date() - date;
    const minutes = Math.floor(diff / 60000);
    const heures = Math.floor(diff / 3600000);
    const jours = Math.floor(diff / 86400000);
    if (minutes < 1) return 'À l\'instant';
    if (minutes < 60) return `Il y a ${minutes} min`;
    if (heures < 24) return `Il y a ${heures}h`;
    if (jours < 7) return `Il y a ${jours}j`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 32 }}>
          <Ionicons name="chevron-back" size={22} color="#2563EB" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.titre, { color: theme.text, fontSize: t(17) }]}>
            Notifications
            {nbNonLus > 0 && <Text style={{ color: '#EF4444' }}> · {nbNonLus}</Text>}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {nbNonLus > 0 && (
            <TouchableOpacity onPress={marquerToutLu}>
              <Ionicons name="checkmark-done-outline" size={22} color="#2563EB" />
            </TouchableOpacity>
          )}
          {notifications.length > 0 && (
            <TouchableOpacity onPress={supprimerToutes}>
              <Ionicons name="trash-outline" size={20} color={theme.text3} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Bouton alertes */}
      <TouchableOpacity
        style={[styles.alerteBtn, { backgroundColor: '#DBEAFE', borderColor: '#BFDBFE' }]}
        onPress={() => setModalAlertes(true)}
      >
        <View style={[styles.alerteIcone, { backgroundColor: '#2563EB' }]}>
          <Ionicons name="notifications" size={16} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.alerteTitre, { color: '#1E40AF', fontSize: t(14) }]}>
            Gérer mes alertes
          </Text>
          <Text style={[{ color: '#3B82F6', fontSize: t(12) }]}>
            {preferences?.actif
              ? `${preferences?.categories?.length || 0} catégorie${(preferences?.categories?.length || 0) > 1 ? 's' : ''} · ${RAYONS_OPTIONS.find(r => r.key === preferences?.rayon_notifications)?.label || '5 km'}`
              : 'Notifications désactivées'
            }
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color="#2563EB" />
      </TouchableOpacity>

      {/* Contenu */}
      {chargement ? (
        <View style={styles.vide}>
          <ActivityIndicator color="#2563EB" size="large" />
        </View>
      ) : erreur ? (
        <ErreurReseau
          onReessayer={() => { setErreur(false); chargerNotifications(); }}
          message="Impossible de charger tes notifications. Vérifie ta connexion."
        />
      ) : notifications.length === 0 ? (
        <View style={styles.vide}>
          <View style={[styles.videIcone, { backgroundColor: '#DBEAFE' }]}>
            <Ionicons name="notifications-outline" size={28} color="#2563EB" />
          </View>
          <Text style={[styles.videTexte, { color: theme.text, fontSize: t(16) }]}>
            Aucune notification
          </Text>
          <Text style={[styles.videDesc, { color: theme.text3, fontSize: t(13) }]}>
            Tu seras notifié quand un événement est créé dans ton rayon.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.liste}
          renderItem={({ item }) => {
            const type = TYPES_NOTIF[item.type] || TYPES_NOTIF.systeme;
            return (
              <TouchableOpacity
                style={[
                  styles.notifRow,
                  {
                    backgroundColor: item.lu
                      ? theme.card
                      : (theme.bg === '#0A0A0A' ? '#1A1A2E' : '#EFF6FF'),
                    borderColor: item.lu ? theme.border : '#BFDBFE',
                    borderWidth: item.lu ? 0.5 : 1,
                  },
                ]}
                onPress={() => {
                  marquerLu(item.id);
                  if (item.evenement_id) {
                    navigation.navigate('DetailEvenement', { evenement: { id: item.evenement_id } });
                  }
                }}
                onLongPress={() => {
                  Alert.alert('Supprimer ?', 'Cette notification sera supprimée.', [
                    { text: 'Annuler' },
                    { text: 'Supprimer', style: 'destructive', onPress: () => supprimerNotification(item.id) },
                  ]);
                }}
              >
                <View style={[styles.notifIcone, { backgroundColor: type.bg }]}>
                  <Ionicons name={type.icon} size={18} color={type.couleur} />
                </View>
                <View style={styles.notifContenu}>
                  <View style={styles.notifTop}>
                    <Text style={[styles.notifTitre, {
                      color: theme.text, fontSize: t(13),
                      fontWeight: item.lu ? '400' : '600',
                    }]} numberOfLines={1}>
                      {item.titre}
                    </Text>
                    <Text style={{ color: theme.text3, fontSize: t(11) }}>
                      {formaterDate(item.created_at)}
                    </Text>
                  </View>
                  {item.corps && (
                    <Text style={{ color: theme.text3, fontSize: t(12), lineHeight: 17 }} numberOfLines={2}>
                      {item.corps}
                    </Text>
                  )}
                </View>
                <View style={{ gap: 6, alignItems: 'center' }}>
                  {!item.lu && <View style={styles.nonLuDot} />}
                  <TouchableOpacity onPress={() => supprimerNotification(item.id)} style={{ padding: 4 }}>
                    <Ionicons name="close" size={14} color={theme.text3} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Modal alertes */}
      <Modal
        visible={modalAlertes}
        transparent
        animationType="slide"
        onRequestClose={() => setModalAlertes(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setModalAlertes(false)}
          />
          <View style={[styles.modalSheet, { backgroundColor: theme.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitre, { color: theme.text, fontSize: t(17) }]}>Mes alertes</Text>
              <TouchableOpacity onPress={() => setModalAlertes(false)}>
                <Ionicons name="close" size={22} color={theme.text3} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContenu} showsVerticalScrollIndicator={false}>

              {/* Toggle actif */}
              {preferences && (
                <TouchableOpacity
                  style={[styles.activerRow, {
                    backgroundColor: preferences.actif ? '#DCFCE7' : theme.bg,
                    borderColor: preferences.actif ? '#22C55E' : theme.border,
                  }]}
                  onPress={() => setPreferences({ ...preferences, actif: !preferences.actif })}
                >
                  <View style={[styles.activerIcone, {
                    backgroundColor: preferences.actif ? '#22C55E' : '#F5F5F5',
                  }]}>
                    <Ionicons
                      name={preferences.actif ? 'notifications' : 'notifications-off-outline'}
                      size={18}
                      color={preferences.actif ? '#fff' : '#888'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{
                      color: preferences.actif ? '#15803D' : theme.text,
                      fontSize: t(14), fontWeight: '500',
                    }}>
                      {preferences.actif ? 'Notifications activées' : 'Notifications désactivées'}
                    </Text>
                    <Text style={{ color: preferences.actif ? '#22C55E' : theme.text3, fontSize: t(12) }}>
                      {preferences.actif ? 'Appuie pour désactiver' : 'Appuie pour activer'}
                    </Text>
                  </View>
                  <View style={[styles.toggleSwitch, { backgroundColor: preferences.actif ? '#22C55E' : '#E0E0E0' }]}>
                    <View style={[styles.toggleKnob, { transform: [{ translateX: preferences.actif ? 18 : 2 }] }]} />
                  </View>
                </TouchableOpacity>
              )}

              {/* Rayon */}
              <Text style={[styles.modalSection, { color: theme.text3, fontSize: t(11) }]}>
                RAYON DE NOTIFICATION
              </Text>
              <View style={styles.rayonsRow}>
                {RAYONS_OPTIONS.map(r => (
                  <TouchableOpacity
                    key={r.key}
                    style={[styles.rayonChip, {
                      backgroundColor: preferences?.rayon_notifications === r.key ? '#DBEAFE' : theme.bg,
                      borderColor: preferences?.rayon_notifications === r.key ? '#2563EB' : theme.border,
                      borderWidth: preferences?.rayon_notifications === r.key ? 1.5 : 0.5,
                    }]}
                    onPress={() => setPreferences({ ...preferences, rayon_notifications: r.key })}
                  >
                    <Text style={{
                      color: preferences?.rayon_notifications === r.key ? '#1E40AF' : theme.text3,
                      fontSize: t(12),
                      fontWeight: preferences?.rayon_notifications === r.key ? '500' : '400',
                    }}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Catégories */}
              <Text style={[styles.modalSection, { color: theme.text3, fontSize: t(11) }]}>CATÉGORIES</Text>
              <Text style={{ color: theme.text3, fontSize: t(12), marginBottom: 12 }}>
                Tu seras notifié uniquement pour les catégories sélectionnées.
              </Text>

              <TouchableOpacity
                style={[styles.toutBtn, { backgroundColor: theme.bg, borderColor: theme.border }]}
                onPress={() => {
                  const toutes = Object.keys(CATEGORIES_NOTIF);
                  const toutesSelectionnees = toutes.every(c => preferences?.categories?.includes(c));
                  setPreferences({
                    ...preferences,
                    categories: toutesSelectionnees ? [] : toutes,
                  });
                }}
              >
                <Text style={{ color: theme.text, fontSize: t(13) }}>
                  {Object.keys(CATEGORIES_NOTIF).every(c => preferences?.categories?.includes(c))
                    ? 'Tout désélectionner'
                    : 'Tout sélectionner'
                  }
                </Text>
              </TouchableOpacity>

              <View style={styles.categoriesGrid}>
                {Object.entries(CATEGORIES_NOTIF).map(([nom, c]) => {
                  const actif = preferences?.categories?.includes(nom);
                  return (
                    <TouchableOpacity
                      key={nom}
                      style={[styles.catBtn, {
                        backgroundColor: actif ? c.claire : theme.bg,
                        borderColor: actif ? c.forte : theme.border,
                        borderWidth: actif ? 1.5 : 0.5,
                      }]}
                      onPress={() => toggleCategorie(nom)}
                    >
                      <View style={[styles.catIcone, { backgroundColor: actif ? c.forte : '#F5F5F5' }]}>
                        <Ionicons name={c.icon} size={14} color={actif ? '#fff' : '#888'} />
                      </View>
                      <Text style={{
                        color: actif ? c.texte : theme.text3,
                        fontSize: t(12),
                        fontWeight: actif ? '500' : '400',
                        flex: 1,
                      }}>
                        {nom}
                      </Text>
                      {actif && (
                        <View style={[styles.checkMark, { backgroundColor: c.forte }]}>
                          <Ionicons name="checkmark" size={10} color="#fff" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[styles.sauvegarderBtn, {
                  backgroundColor: '#111',
                  opacity: sauvegardePref ? 0.6 : 1,
                }]}
                onPress={sauvegarderPreferences}
                disabled={sauvegardePref}
              >
                {sauvegardePref ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: t(15), fontWeight: '500' }}>Sauvegarder</Text>
                  </>
                )}
              </TouchableOpacity>
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, paddingTop: 56, borderBottomWidth: 0.5 },
  titre: { fontWeight: '500' },
  alerteBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, margin: 12, borderRadius: 14, padding: 14, borderWidth: 1 },
  alerteIcone: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  alerteTitre: { fontWeight: '500' },
  liste: { padding: 12, gap: 8 },
  notifRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 14, padding: 13 },
  notifIcone: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  notifContenu: { flex: 1 },
  notifTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, alignItems: 'flex-start' },
  notifTitre: { flex: 1, marginRight: 8 },
  nonLuDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563EB' },
  vide: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  videIcone: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  videTexte: { fontWeight: '500' },
  videDesc: { textAlign: 'center', lineHeight: 20 },
  modalContainer: { flex: 1, justifyContent: 'flex-end' },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 0.5 },
  modalTitre: { fontWeight: '500' },
  modalContenu: { padding: 16 },
  modalSection: { fontWeight: '700', letterSpacing: 0.04, marginTop: 16, marginBottom: 10 },
  activerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1.5, marginBottom: 4 },
  activerIcone: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  toggleSwitch: { width: 40, height: 24, borderRadius: 12, justifyContent: 'center' },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', position: 'absolute', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 2 },
  rayonsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  rayonChip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  toutBtn: { borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 0.5, marginBottom: 12 },
  categoriesGrid: { gap: 8, marginBottom: 16 },
  catBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12 },
  catIcone: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  checkMark: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sauvegarderBtn: { borderRadius: 14, padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 },
});