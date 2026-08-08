import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, FlatList, Alert, Image, Linking, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useApp } from '../AppContext';
import { supabase } from '../supabase';

const TAILLES = [
  { key: 'petite',      label: 'Petite',       desc: 'Police réduite, plus de contenu visible' },
  { key: 'normale',     label: 'Normale',      desc: 'Taille par défaut' },
  { key: 'grande',      label: 'Grande',       desc: 'Plus lisible' },
  { key: 'tres_grande', label: 'Très grande',  desc: 'Accessibilité maximale' },
];

const RAYONS_OPTIONS = [
  { key: null,  label: 'Tout afficher',  desc: 'Toute l\'Île-de-France' },
  { key: 1000,  label: '1 km',           desc: 'Ton quartier immédiat' },
  { key: 5000,  label: '5 km',           desc: 'Ton arrondissement et alentours' },
  { key: 10000, label: '10 km',          desc: 'Grande partie de Paris' },
  { key: 20000, label: '20 km',          desc: 'Paris et proche banlieue' },
];

const VISIBILITES = [
  { key: 'public', label: 'Public',  desc: 'Tout le monde voit ton profil et tes événements' },
  { key: 'amis',   label: 'Amis',    desc: 'Uniquement tes abonnés voient ton activité' },
  { key: 'prive',  label: 'Privé',   desc: 'Seul toi vois tes événements' },
];

const Toggle = ({ value, onToggle, couleur = '#34C759' }) => (
  <TouchableOpacity
    onPress={onToggle}
    activeOpacity={0.85}
    style={[styles.toggle, { backgroundColor: value ? couleur : 'rgba(120,120,128,0.16)' }]}
  >
    <View style={[styles.toggleKnob, { transform: [{ translateX: value ? 20 : 2 }] }]} />
  </TouchableOpacity>
);

const ModalChoix = ({ visible, onClose, titre, options, valeurActuelle, onSelect, theme, t }) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
      <View style={styles.modalSheet}>
        <View style={styles.modalHandle} />
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitre, { fontSize: t(17) }]}>{titre}</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
            <Ionicons name="close" size={16} color="#888" />
          </TouchableOpacity>
        </View>
        <FlatList
          data={options}
          keyExtractor={item => String(item.key)}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.modalOption, valeurActuelle === item.key && styles.modalOptionActif]}
              onPress={() => { onSelect(item.key); onClose(); }}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalOptionLabel, { fontSize: t(15), color: valeurActuelle === item.key ? '#2563EB' : '#111' }]}>
                  {item.label}
                </Text>
                {item.desc && <Text style={[styles.modalOptionDesc, { fontSize: t(12) }]}>{item.desc}</Text>}
              </View>
              {valeurActuelle === item.key && <Ionicons name="checkmark" size={18} color="#2563EB" />}
            </TouchableOpacity>
          )}
        />
      </View>
    </TouchableOpacity>
  </Modal>
);

export default function ReglagresScreen({ navigation }) {
  const {
    modeSombre, setModeSombre,
    tailleTexte, setTailleTexte,
    daltonien, setDaltonien,
    rayonDefaut, setRayonDefaut,
    animationsReduites, setAnimationsReduites,
    visibiliteDefaut, setVisibiliteDefaut,
    utilisateursBlockes, bloquerUtilisateur,
    notifications, setNotifications,
    profil, deconnexion,
    facteurTexte,
  } = useApp();

  const [modalTaille, setModalTaille] = useState(false);
  const [modalRayon, setModalRayon] = useState(false);
  const [modalVisibilite, setModalVisibilite] = useState(false);
  const [modalBloques, setModalBloques] = useState(false);
  const t = (size) => size * facteurTexte;

  const scoreConfiance = profil?.score_confiance || 0;
  const initiales = profil?.prenom ? profil.prenom.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U';

  const supprimerCompte = () => {
    Alert.alert('Supprimer le compte', 'Cette action est irréversible. Toutes tes données seront supprimées.', [
      { text: 'Annuler' },
      {
        text: 'Supprimer définitivement', style: 'destructive',
        onPress: async () => {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            await supabase.from('messages_luma').delete().eq('auteur_id', user.id);
            await supabase.from('conversation_membres').delete().eq('user_id', user.id);
            await supabase.from('stories').update({ actif: false }).eq('user_id', user.id);
            await supabase.from('participations').delete().eq('user_id', user.id);
            await supabase.from('favoris').delete().eq('user_id', user.id);
            await supabase.from('notifications').delete().eq('user_id', user.id);
            await supabase.from('evenements').delete().eq('auteur_id', user.id);
            await supabase.storage.from('avatars').remove([`${user.id}/avatar.jpg`]);
            await supabase.from('profiles').delete().eq('id', user.id);
            await supabase.auth.signOut();
          } catch { Alert.alert('Erreur', 'Une erreur est survenue.'); }
        },
      },
    ]);
  };

  const Ligne = ({ icone, bg, couleur, label, sub, right, onPress, rouge }) => (
    <TouchableOpacity
      style={styles.ligne}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.ligneIcone, { backgroundColor: bg }]}>
        <Ionicons name={icone} size={15} color={rouge ? '#DC2626' : (couleur || '#111')} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.ligneLabel, { fontSize: t(15), color: rouge ? '#DC2626' : '#111' }]}>{label}</Text>
        {sub && <Text style={[styles.ligneSub, { fontSize: t(12) }]}>{sub}</Text>}
      </View>
      {right !== undefined ? right : onPress ? (
        <Ionicons name="chevron-forward" size={14} color={rouge ? '#DC2626' : '#ddd'} />
      ) : null}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.titre, { fontSize: t(28) }]}>Réglages</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Carte profil ── */}
        <TouchableOpacity style={styles.compteCard} onPress={() => navigation.navigate('Compte')} activeOpacity={0.88}>
          {profil?.avatar_url ? (
            <Image source={{ uri: profil.avatar_url }} style={styles.compteAvatar} />
          ) : (
            <View style={[styles.compteAvatar, styles.compteAvatarDefaut]}>
              <Text style={{ color: '#fff', fontSize: 24, fontWeight: '600' }}>{initiales}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.compteNom, { fontSize: t(17) }]}>{profil?.prenom || 'Utilisateur'}</Text>
            <Text style={[styles.compteHandle, { fontSize: t(13) }]}>
              {profil?.handle || ''}
              {profil?.arrondissement ? ` · ${profil.arrondissement}` : ''}
            </Text>
            {/* Score bar */}
            <View style={styles.scoreWrap}>
              <View style={styles.scoreBar}>
                <View style={[styles.scoreRempli, {
                  width: `${scoreConfiance}%`,
                  backgroundColor: scoreConfiance >= 70 ? '#22C55E' : scoreConfiance >= 40 ? '#F59E0B' : '#EF4444',
                }]} />
              </View>
              <Text style={styles.scoreTxt}>{scoreConfiance}%</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
        </TouchableOpacity>

        {/* ── Apparence ── */}
        <Text style={[styles.groupTitre, { fontSize: t(12) }]}>APPARENCE</Text>
        <View style={styles.group}>
          <Ligne
            icone="moon-outline" bg="#111" couleur="#fff"
            label="Mode sombre"
            right={<Toggle value={modeSombre} onToggle={() => setModeSombre(!modeSombre)} />}
          />
          <Ligne
            icone="text-outline" bg="#F3E8FF" couleur="#7E22CE"
            label="Taille du texte"
            sub={TAILLES.find(tp => tp.key === tailleTexte)?.label || 'Normale'}
            onPress={() => setModalTaille(true)}
          />
          <Ligne
            icone="eye-outline" bg="#F5F5F5" couleur="#555"
            label="Mode daltonien"
            sub={daltonien ? 'Actif — deutéranopie' : 'Inactif'}
            right={<Toggle value={daltonien} couleur="#7C3AED" onToggle={() => setDaltonien(!daltonien)} />}
          />
          <Ligne
            icone="flash-outline" bg="#FEF3C7" couleur="#92400E"
            label="Réduire les animations"
            sub={animationsReduites ? 'Actif' : 'Inactif'}
            right={<Toggle value={animationsReduites} couleur="#F59E0B" onToggle={() => setAnimationsReduites(!animationsReduites)} />}
          />
        </View>

        {/* ── Carte & localisation ── */}
        <Text style={[styles.groupTitre, { fontSize: t(12) }]}>CARTE & LOCALISATION</Text>
        <View style={styles.group}>
          <Ligne
            icone="navigate-outline" bg="#DBEAFE" couleur="#1D4ED8"
            label="Rayon par défaut"
            sub={RAYONS_OPTIONS.find(r => r.key === rayonDefaut)?.label || 'Tout afficher'}
            onPress={() => setModalRayon(true)}
          />
        </View>

        {/* ── Notifications ── */}
        <Text style={[styles.groupTitre, { fontSize: t(12) }]}>NOTIFICATIONS</Text>
        <View style={styles.group}>
          <Ligne
            icone="location-outline" bg="#DCFCE7" couleur="#15803D"
            label="Événements à proximité"
            sub={notifications?.proximite ? 'Activé' : 'Désactivé'}
            right={<Toggle value={notifications?.proximite} couleur="#22C55E" onToggle={() => setNotifications(n => ({ ...n, proximite: !n.proximite }))} />}
          />
          <Ligne
            icone="mail-outline" bg="#DBEAFE" couleur="#1D4ED8"
            label="Nouveaux messages"
            sub={notifications?.messages ? 'Activé' : 'Désactivé'}
            right={<Toggle value={notifications?.messages} couleur="#2563EB" onToggle={() => setNotifications(n => ({ ...n, messages: !n.messages }))} />}
          />
          <Ligne
            icone="chatbubble-outline" bg="#FCE7F3" couleur="#9D174D"
            label="Commentaires"
            sub={notifications?.commentaires ? 'Activé' : 'Désactivé'}
            right={<Toggle value={notifications?.commentaires} couleur="#EC4899" onToggle={() => setNotifications(n => ({ ...n, commentaires: !n.commentaires }))} />}
          />
          <Ligne
            icone="star-outline" bg="#FEF3C7" couleur="#92400E"
            label="Places libérées"
            sub={notifications?.places ? 'Activé' : 'Désactivé'}
            right={<Toggle value={notifications?.places} couleur="#F59E0B" onToggle={() => setNotifications(n => ({ ...n, places: !n.places }))} />}
          />
          <Ligne
            icone="options-outline" bg="#DBEAFE" couleur="#1D4ED8"
            label="Gérer par catégorie"
            onPress={() => navigation.navigate('Notifications')}
          />
        </View>

        {/* ── Confidentialité ── */}
        <Text style={[styles.groupTitre, { fontSize: t(12) }]}>CONFIDENTIALITÉ</Text>
        <View style={styles.group}>
          <Ligne
            icone="shield-outline" bg="#DBEAFE" couleur="#1D4ED8"
            label="Visibilité du profil"
            sub={VISIBILITES.find(v => v.key === visibiliteDefaut)?.label || 'Public'}
            onPress={() => setModalVisibilite(true)}
          />
          <Ligne
            icone="ban-outline" bg="#FEE2E2" couleur="#DC2626"
            label="Utilisateurs bloqués"
            sub={utilisateursBlockes?.length === 0 ? 'Aucun' : `${utilisateursBlockes.length} bloqué${utilisateursBlockes.length > 1 ? 's' : ''}`}
            onPress={() => setModalBloques(true)}
          />
          <Ligne
            icone="download-outline" bg="#F5F5F5" couleur="#555"
            label="Export de mes données (RGPD)"
            sub="Reçois toutes tes données sous 48h"
            onPress={() => Alert.alert('Export RGPD', 'Ta demande a été enregistrée. Tu recevras tes données sous 48h.')}
          />
        </View>

        {/* ── Communauté ── */}
        <Text style={[styles.groupTitre, { fontSize: t(12) }]}>COMMUNAUTÉ</Text>
        <View style={styles.group}>
          <Ligne
            icone="document-text-outline" bg="#DBEAFE" couleur="#1D4ED8"
            label="Conditions d'utilisation"
            onPress={() => navigation.navigate('CGU')}
          />
          <Ligne
            icone="chatbubbles-outline" bg="#DCFCE7" couleur="#15803D"
            label="Règles de la communauté"
            onPress={() => Alert.alert('Règles Luma', '1. Lieux publics uniquement\n2. Respect de chacun\n3. Pas d\'adresse personnelle\n4. Signaler tout contenu inapproprié\n5. Pas de spam ni de publicité')}
          />
          <Ligne
            icone="help-circle-outline" bg="#FEF3C7" couleur="#92400E"
            label="Aide & FAQ"
            onPress={() => Alert.alert('Aide', 'Carte : appuie sur un marqueur\nStory : bouton caméra en haut\nMessages : Nouveau → cherche un utilisateur')}
          />
          <Ligne
            icone="star-half-outline" bg="#F3E8FF" couleur="#7E22CE"
            label="Proposer une amélioration"
            onPress={() => Linking.openURL('mailto:feedback@luma.app?subject=Amélioration Luma')}
          />
        </View>

        {/* ── Compte ── */}
        <Text style={[styles.groupTitre, { fontSize: t(12) }]}>COMPTE</Text>
        <View style={styles.group}>
          <Ligne
            icone="log-out-outline" bg="#FEE2E2" couleur="#DC2626"
            label="Se déconnecter" rouge
            onPress={() => Alert.alert('Se déconnecter ?', 'Tu seras redirigé vers la page de connexion.', [
              { text: 'Annuler' },
              { text: 'Se déconnecter', style: 'destructive', onPress: deconnexion },
            ])}
          />
          <Ligne
            icone="trash-outline" bg="#FEE2E2" couleur="#DC2626"
            label="Supprimer le compte" rouge
            sub="Action irréversible"
            onPress={supprimerCompte}
          />
        </View>

        <Text style={[styles.version, { fontSize: t(12) }]}>luma v1.0 · rejoins ton quartier</Text>
      </ScrollView>

      {/* Modals */}
      <ModalChoix visible={modalTaille} onClose={() => setModalTaille(false)} titre="Taille du texte" options={TAILLES} valeurActuelle={tailleTexte} onSelect={setTailleTexte} t={t} />
      <ModalChoix visible={modalRayon} onClose={() => setModalRayon(false)} titre="Rayon par défaut" options={RAYONS_OPTIONS} valeurActuelle={rayonDefaut} onSelect={setRayonDefaut} t={t} />
      <ModalChoix visible={modalVisibilite} onClose={() => setModalVisibilite(false)} titre="Visibilité" options={VISIBILITES} valeurActuelle={visibiliteDefaut} onSelect={setVisibiliteDefaut} t={t} />

      <Modal visible={modalBloques} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalBloques(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitre, { fontSize: t(17) }]}>Utilisateurs bloqués</Text>
              <TouchableOpacity onPress={() => setModalBloques(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={16} color="#888" />
              </TouchableOpacity>
            </View>
            {!utilisateursBlockes?.length ? (
              <View style={{ padding: 40, alignItems: 'center', gap: 10 }}>
                <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: '#f0f0ee', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="ban-outline" size={24} color="#ddd" />
                </View>
                <Text style={{ color: '#aaa', fontSize: t(14) }}>Aucun utilisateur bloqué</Text>
              </View>
            ) : (
              <FlatList
                data={utilisateursBlockes}
                keyExtractor={item => String(item.id)}
                renderItem={({ item }) => (
                  <View style={styles.modalOption}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.modalOptionLabel, { fontSize: t(15) }]}>{item.prenom || 'Utilisateur'}</Text>
                      {item.handle && <Text style={[styles.modalOptionDesc, { fontSize: t(12) }]}>{item.handle}</Text>}
                    </View>
                    <TouchableOpacity
                      onPress={() => bloquerUtilisateur(item)}
                      style={styles.debloquerBtn}
                    >
                      <Text style={{ color: '#DC2626', fontSize: t(13), fontWeight: '500' }}>Débloquer</Text>
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7' },
  header: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 58 : 20, paddingBottom: 8, backgroundColor: '#f2f2f7' },
  titre: { fontWeight: '700', color: '#111', letterSpacing: -0.5 },
  scroll: { paddingBottom: 40 },

  compteCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#111', margin: 16, marginTop: 8,
    borderRadius: 20, padding: 16,
  },
  compteAvatar: { width: 56, height: 56, borderRadius: 28, flexShrink: 0 },
  compteAvatarDefaut: { backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  compteNom: { color: '#fff', fontWeight: '600', letterSpacing: -0.3 },
  compteHandle: { color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  scoreWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  scoreBar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden', maxWidth: 80 },
  scoreRempli: { height: '100%', borderRadius: 2 },
  scoreTxt: { color: 'rgba(255,255,255,0.4)', fontSize: 11 },

  groupTitre: { color: '#8E8E93', fontWeight: '500', letterSpacing: 0.04, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 8 },
  group: { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 14, overflow: 'hidden' },

  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, paddingHorizontal: 14, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.05)' },
  ligneIcone: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  ligneLabel: { color: '#111' },
  ligneSub: { color: '#aaa', marginTop: 1 },

  toggle: { width: 50, height: 30, borderRadius: 15, justifyContent: 'center', flexShrink: 0 },
  toggleKnob: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff', position: 'absolute', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 2 },

  version: { textAlign: 'center', color: '#C0C0C0', padding: 24 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '75%' },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.06)' },
  modalTitre: { fontWeight: '600', color: '#111' },
  modalCloseBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f0f0ee', alignItems: 'center', justifyContent: 'center' },
  modalOption: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.05)', gap: 10 },
  modalOptionActif: { backgroundColor: '#EFF6FF' },
  modalOptionLabel: { fontWeight: '400', color: '#111' },
  modalOptionDesc: { color: '#aaa', marginTop: 2 },
  debloquerBtn: { backgroundColor: '#FEE2E2', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
});