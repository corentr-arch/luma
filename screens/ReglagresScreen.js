import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Modal, FlatList, Alert, Image, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useApp } from '../AppContext';
import { supabase } from '../supabase';

const TAILLES = [
  { key: 'petite',      label: 'Petite',       desc: 'Police plus petite pour voir plus de contenu' },
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
  { key: 'public', label: 'Public',  desc: 'Tout le monde voit tes événements et ton profil' },
  { key: 'amis',   label: 'Amis',    desc: 'Uniquement tes abonnés voient ton activité' },
  { key: 'prive',  label: 'Privé',   desc: 'Seul toi vois tes événements' },
];

const Toggle = ({ value, onToggle, couleur = '#111' }) => (
  <TouchableOpacity
    onPress={onToggle}
    style={[styles.toggle, { backgroundColor: value ? couleur : '#E0E0E0' }]}
    activeOpacity={0.8}
  >
    <View style={[styles.toggleKnob, { transform: [{ translateX: value ? 18 : 2 }] }]} />
  </TouchableOpacity>
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
    facteurTexte, theme,
  } = useApp();

  const [modalTaille, setModalTaille] = useState(false);
  const [modalRayon, setModalRayon] = useState(false);
  const [modalVisibilite, setModalVisibilite] = useState(false);
  const [modalBloques, setModalBloques] = useState(false);
  const t = (size) => size * facteurTexte;

  const scoreConfiance = profil?.score_confiance || 0;
  const initiales = profil?.prenom
    ? profil.prenom.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const supprimerCompte = () => {
    Alert.alert(
      'Supprimer le compte',
      'Cette action est irréversible. Toutes tes données seront définitivement supprimées.',
      [
        { text: 'Annuler' },
        {
          text: 'Supprimer définitivement',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) return;
              // Supprime dans l'ordre pour respecter les FK
              await supabase.from('messages_luma').delete().eq('auteur_id', user.id);
              await supabase.from('conversation_membres').delete().eq('user_id', user.id);
              await supabase.from('stories').update({ actif: false }).eq('user_id', user.id);
              await supabase.from('participations').delete().eq('user_id', user.id);
              await supabase.from('favoris').delete().eq('user_id', user.id);
              await supabase.from('notifications').delete().eq('user_id', user.id);
              await supabase.from('preferences_notifications').delete().eq('user_id', user.id);
              await supabase.from('evenements').delete().eq('auteur_id', user.id);
              await supabase.storage.from('avatars').remove([`${user.id}/avatar.jpg`]);
              await supabase.from('profiles').delete().eq('id', user.id);
              await supabase.auth.signOut();
            } catch {
              Alert.alert('Erreur', 'Une erreur est survenue lors de la suppression.');
            }
          },
        },
      ]
    );
  };

  const exporterDonnees = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      Alert.alert(
        'Export RGPD',
        'Nous allons préparer tes données. Un email te sera envoyé sous 48h à l\'adresse associée à ton compte.',
        [
          { text: 'Annuler' },
          {
            text: 'Confirmer',
            onPress: async () => {
              // Insère une demande d'export en base
              await supabase.from('demandes_rgpd').insert({
                user_id: user.id,
                email: user.email,
                statut: 'en_attente',
              });
              Alert.alert('Demande envoyée', 'Tu recevras tes données sous 48h.');
            }
          }
        ]
      );
    } catch {
      Alert.alert('Erreur', 'Impossible d\'envoyer la demande.');
    }
  };

  const Section = ({ titre, children }) => (
    <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
      {titre && <Text style={[styles.sectionTitre, { color: theme.text3, fontSize: t(11) }]}>{titre}</Text>}
      {children}
    </View>
  );

  const Ligne = ({ iconeName, bg, couleurIcone, label, sub, right, onPress, rouge, disabled }) => (
    <TouchableOpacity
      style={[styles.ligne, { borderTopColor: theme.border, opacity: disabled ? 0.4 : 1 }]}
      onPress={disabled ? null : onPress}
      activeOpacity={onPress && !disabled ? 0.7 : 1}
    >
      <View style={[styles.icone, { backgroundColor: bg }]}>
        <Ionicons name={iconeName} size={15} color={rouge ? '#EF4444' : (couleurIcone || '#111')} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.ligneLabel, { color: rouge ? '#EF4444' : theme.text, fontSize: t(13) }]}>
          {label}
        </Text>
        {sub && <Text style={[styles.ligneSub, { color: theme.text3, fontSize: t(11) }]}>{sub}</Text>}
      </View>
      {right !== undefined
        ? right
        : onPress && !disabled
          ? <Ionicons name="chevron-forward" size={14} color={rouge ? '#EF4444' : theme.text3} />
          : null
      }
    </TouchableOpacity>
  );

  const ModalChoix = ({ visible, onClose, titre, options, valeurActuelle, onSelect }) => (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.modalSheet, { backgroundColor: theme.card }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <Text style={[styles.modalTitre, { color: theme.text, fontSize: t(16) }]}>{titre}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={theme.text3} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={options}
            keyExtractor={(item) => String(item.key)}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.modalOption, { borderBottomColor: theme.border },
                  valeurActuelle === item.key && { backgroundColor: '#DBEAFE' },
                ]}
                onPress={() => { onSelect(item.key); onClose(); }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{
                    color: valeurActuelle === item.key ? '#1E40AF' : theme.text,
                    fontSize: t(14),
                    fontWeight: valeurActuelle === item.key ? '500' : '400',
                  }}>
                    {item.label}
                  </Text>
                  {item.desc && (
                    <Text style={{ color: theme.text3, fontSize: t(12), marginTop: 2 }}>
                      {item.desc}
                    </Text>
                  )}
                </View>
                {valeurActuelle === item.key && <Ionicons name="checkmark" size={18} color="#2563EB" />}
              </TouchableOpacity>
            )}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Text style={[styles.titre, { color: theme.text, fontSize: t(22) }]}>Réglages</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Carte Mon compte ── */}
        <TouchableOpacity
          style={styles.compteCard}
          onPress={() => navigation.navigate('Compte')}
          activeOpacity={0.85}
        >
          <View style={styles.compteCardInner}>
            <View style={styles.compteCardTop}>
              {profil?.avatar_url ? (
                <Image source={{ uri: profil.avatar_url }} style={styles.compteAvatar} />
              ) : (
                <View style={[styles.compteAvatar, { backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ color: '#fff', fontSize: 22, fontWeight: '500' }}>{initiales}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontSize: t(18), fontWeight: '500', marginBottom: 2 }}>
                  {profil?.prenom || 'Utilisateur'}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: t(12), marginBottom: 8 }}>
                  {profil?.handle || '@luma_user'}
                  {profil?.arrondissement ? ` · ${profil.arrondissement}` : ''}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={[styles.scoreBarPetite, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                    <View style={[styles.scoreRempliPetit, {
                      width: `${scoreConfiance}%`,
                      backgroundColor: scoreConfiance >= 70 ? '#22C55E' : scoreConfiance >= 40 ? '#F59E0B' : '#EF4444',
                    }]} />
                  </View>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: t(11) }}>{scoreConfiance}%</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
            </View>

            <View style={[styles.compteCardBottom, { borderTopColor: 'rgba(255,255,255,0.1)' }]}>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {profil?.email_verifie && (
                  <View style={[styles.verifBadge, { backgroundColor: 'rgba(34,197,94,0.2)' }]}>
                    <Ionicons name="mail" size={10} color="#22C55E" />
                    <Text style={{ color: '#22C55E', fontSize: t(10), fontWeight: '500' }}>Email vérifié</Text>
                  </View>
                )}
                {profil?.telephone_verifie && (
                  <View style={[styles.verifBadge, { backgroundColor: 'rgba(37,99,235,0.2)' }]}>
                    <Ionicons name="call" size={10} color="#60A5FA" />
                    <Text style={{ color: '#60A5FA', fontSize: t(10), fontWeight: '500' }}>Tél vérifié</Text>
                  </View>
                )}
                {scoreConfiance >= 70 && (
                  <View style={[styles.verifBadge, { backgroundColor: 'rgba(245,158,11,0.2)' }]}>
                    <Ionicons name="shield-checkmark" size={10} color="#F59E0B" />
                    <Text style={{ color: '#F59E0B', fontSize: t(10), fontWeight: '500' }}>Profil de confiance</Text>
                  </View>
                )}
              </View>
              <View style={[styles.voirProfilBtn, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                <Text style={{ color: '#fff', fontSize: t(11), fontWeight: '500' }}>Mon profil</Text>
                <Ionicons name="arrow-forward" size={12} color="#fff" />
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* ── Carte & Préférences ── */}
        <Section titre="CARTE & PRÉFÉRENCES">
          <Ligne
            iconeName="location-outline" bg="#DBEAFE" couleurIcone="#2563EB"
            label="Rayon par défaut"
            sub={RAYONS_OPTIONS.find(r => r.key === rayonDefaut)?.label || 'Tout afficher'}
            onPress={() => setModalRayon(true)}
          />
          <Ligne
            iconeName="moon-outline" bg="#111" couleurIcone="#fff"
            label="Mode sombre"
            right={<Toggle value={modeSombre} couleur="#2563EB" onToggle={() => setModeSombre(!modeSombre)} />}
          />
        </Section>

        {/* ── Notifications ── */}
        <Section titre="NOTIFICATIONS">
          <Ligne
            iconeName="notifications-outline" bg="#DCFCE7" couleurIcone="#22C55E"
            label="Événements à proximité"
            sub={notifications.proximite ? 'Activé' : 'Désactivé'}
            right={<Toggle value={notifications.proximite} couleur="#22C55E" onToggle={() => setNotifications(n => ({ ...n, proximite: !n.proximite }))} />}
          />
          <Ligne
            iconeName="chatbubble-outline" bg="#FCE7F3" couleurIcone="#EC4899"
            label="Commentaires & réactions"
            sub={notifications.commentaires ? 'Activé' : 'Désactivé'}
            right={<Toggle value={notifications.commentaires} couleur="#EC4899" onToggle={() => setNotifications(n => ({ ...n, commentaires: !n.commentaires }))} />}
          />
          <Ligne
            iconeName="mail-outline" bg="#DBEAFE" couleurIcone="#2563EB"
            label="Nouveaux messages"
            sub={notifications.messages ? 'Activé' : 'Désactivé'}
            right={<Toggle value={notifications.messages} couleur="#2563EB" onToggle={() => setNotifications(n => ({ ...n, messages: !n.messages }))} />}
          />
          <Ligne
            iconeName="star-outline" bg="#FEF3C7" couleurIcone="#F59E0B"
            label="Places libérées"
            sub={notifications.places ? 'Activé' : 'Désactivé'}
            right={<Toggle value={notifications.places} couleur="#F59E0B" onToggle={() => setNotifications(n => ({ ...n, places: !n.places }))} />}
          />
          <Ligne
            iconeName="options-outline" bg="#DBEAFE" couleurIcone="#2563EB"
            label="Gérer mes alertes par catégorie"
            onPress={() => navigation.navigate('Notifications')}
          />
        </Section>

        {/* ── Accessibilité ── */}
        <Section titre="ACCESSIBILITÉ">
          <Ligne
            iconeName="text-outline" bg="#F3E8FF" couleurIcone="#A855F7"
            label="Taille du texte"
            sub={TAILLES.find(tp => tp.key === tailleTexte)?.label || 'Normale'}
            onPress={() => setModalTaille(true)}
          />
          <Ligne
            iconeName="eye-outline" bg="#F5F5F5" couleurIcone="#555"
            label="Mode daltonien"
            sub={daltonien ? 'Actif — couleurs adaptées deutéranopie' : 'Inactif'}
            right={<Toggle value={daltonien} couleur="#A855F7" onToggle={() => setDaltonien(!daltonien)} />}
          />
          <Ligne
            iconeName="flash-outline" bg="#FEF3C7" couleurIcone="#F59E0B"
            label="Réduire les animations"
            sub={animationsReduites ? 'Actif — transitions instantanées' : 'Inactif'}
            right={<Toggle value={animationsReduites} couleur="#F59E0B" onToggle={() => setAnimationsReduites(!animationsReduites)} />}
          />
        </Section>

        {/* ── Confidentialité ── */}
        <Section titre="CONFIDENTIALITÉ">
          <Ligne
            iconeName="shield-outline" bg="#DBEAFE" couleurIcone="#2563EB"
            label="Visibilité du profil"
            sub={VISIBILITES.find(v => v.key === visibiliteDefaut)?.label || 'Public'}
            onPress={() => setModalVisibilite(true)}
          />
          <Ligne
            iconeName="ban-outline" bg="#FEE2E2" couleurIcone="#EF4444"
            label="Utilisateurs bloqués"
            sub={utilisateursBlockes.length === 0
              ? 'Aucun utilisateur bloqué'
              : `${utilisateursBlockes.length} utilisateur${utilisateursBlockes.length > 1 ? 's' : ''} bloqué${utilisateursBlockes.length > 1 ? 's' : ''}`}
            onPress={() => setModalBloques(true)}
          />
          <Ligne
            iconeName="download-outline" bg="#F5F5F5" couleurIcone="#555"
            label="Export de mes données (RGPD)"
            sub="Reçois toutes tes données sous 48h"
            onPress={exporterDonnees}
          />
        </Section>

        {/* ── Communauté ── */}
        <Section titre="COMMUNAUTÉ">
          <Ligne
            iconeName="chatbubbles-outline" bg="#DCFCE7" couleurIcone="#22C55E"
            label="Règles de la communauté"
            onPress={() => Alert.alert(
              'Règles Luma',
              '1. Lieux publics uniquement\n2. Respect de chacun\n3. Pas d\'adresse personnelle\n4. Signaler tout contenu inapproprié\n5. Pas de spam ni de publicité'
            )}
          />
          <Ligne
            iconeName="document-text-outline" bg="#DBEAFE" couleurIcone="#2563EB"
            label="Conditions générales d'utilisation"
            onPress={() => navigation.navigate('CGU')}
          />
          <Ligne
            iconeName="help-circle-outline" bg="#FEF3C7" couleurIcone="#F59E0B"
            label="Aide & FAQ"
            onPress={() => Alert.alert(
              'Aide Luma',
              '🗺️ Carte : appuie sur un marqueur pour voir les détails\n\n📸 Story : crée une story depuis l\'appareil photo\n\n💬 Messages : démarre une conversation depuis Messagerie → Nouveau\n\n❓ Autre problème ? Utilise "Proposer une amélioration"'
            )}
          />
          <Ligne
            iconeName="star-half-outline" bg="#F3E8FF" couleurIcone="#A855F7"
            label="Proposer une amélioration"
            sub="Ton retour aide à améliorer Luma"
            onPress={() => {
              Alert.alert(
                'Merci !',
                'Comment veux-tu nous contacter ?',
                [
                  { text: 'Annuler' },
                  {
                    text: 'Email',
                    onPress: () => Linking.openURL('mailto:feedback@luma.app?subject=Amélioration Luma')
                  },
                ]
              );
            }}
          />
        </Section>

        {/* ── Compte avancé ── */}
        <Section titre="COMPTE AVANCÉ">
          <Ligne
            iconeName="log-out-outline" bg="#FEE2E2" couleurIcone="#EF4444"
            label="Se déconnecter" rouge
            onPress={() => Alert.alert(
              'Se déconnecter',
              'Tu seras redirigé vers la page de connexion.',
              [
                { text: 'Annuler' },
                { text: 'Se déconnecter', style: 'destructive', onPress: deconnexion }
              ]
            )}
          />
          <Ligne
            iconeName="trash-outline" bg="#FEE2E2"
            label="Supprimer le compte" rouge
            sub="Action irréversible"
            onPress={supprimerCompte}
          />
        </Section>

        <Text style={[styles.version, { color: theme.text3, fontSize: t(12) }]}>
          luma v1.0 · rejoins ton quartier
        </Text>
      </ScrollView>

      {/* Modals */}
      <ModalChoix visible={modalTaille} onClose={() => setModalTaille(false)} titre="Taille du texte" options={TAILLES} valeurActuelle={tailleTexte} onSelect={setTailleTexte} />
      <ModalChoix visible={modalRayon} onClose={() => setModalRayon(false)} titre="Rayon par défaut" options={RAYONS_OPTIONS} valeurActuelle={rayonDefaut} onSelect={setRayonDefaut} />
      <ModalChoix visible={modalVisibilite} onClose={() => setModalVisibilite(false)} titre="Visibilité du profil" options={VISIBILITES} valeurActuelle={visibiliteDefaut} onSelect={setVisibiliteDefaut} />

      <Modal visible={modalBloques} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalBloques(false)}>
          <View style={[styles.modalSheet, { backgroundColor: theme.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitre, { color: theme.text, fontSize: t(16) }]}>Utilisateurs bloqués</Text>
              <TouchableOpacity onPress={() => setModalBloques(false)}>
                <Ionicons name="close" size={22} color={theme.text3} />
              </TouchableOpacity>
            </View>
            {utilisateursBlockes.length === 0 ? (
              <View style={{ padding: 40, alignItems: 'center', gap: 12 }}>
                <Ionicons name="ban-outline" size={38} color={theme.text3} />
                <Text style={{ color: theme.text3, fontSize: t(14) }}>Aucun utilisateur bloqué</Text>
              </View>
            ) : (
              <FlatList
                data={utilisateursBlockes}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => (
                  <View style={[styles.modalOption, { borderBottomColor: theme.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.text, fontSize: t(14) }}>
                        {item.prenom || item.nom || 'Utilisateur'}
                      </Text>
                      {item.handle && (
                        <Text style={{ color: theme.text3, fontSize: t(12), marginTop: 2 }}>{item.handle}</Text>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={() => bloquerUtilisateur(item)}
                      style={[styles.debloquerBtn, { backgroundColor: '#FEE2E2' }]}
                    >
                      <Text style={{ color: '#EF4444', fontSize: t(12), fontWeight: '500' }}>Débloquer</Text>
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
  container: { flex: 1 },
  header: { padding: 16, paddingTop: 56, borderBottomWidth: 0.5 },
  titre: { fontWeight: '500' },
  scroll: { padding: 12, paddingBottom: 40 },
  compteCard: { borderRadius: 20, overflow: 'hidden', marginBottom: 10 },
  compteCardInner: { backgroundColor: '#111', padding: 18 },
  compteCardTop: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  compteAvatar: { width: 60, height: 60, borderRadius: 30 },
  scoreBarPetite: { flex: 1, height: 3, borderRadius: 2, overflow: 'hidden', maxWidth: 100 },
  scoreRempliPetit: { height: '100%', borderRadius: 2 },
  compteCardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 0.5 },
  verifBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 7, paddingVertical: 3 },
  voirProfilBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  section: { borderRadius: 14, marginBottom: 10, borderWidth: 0.5, overflow: 'hidden' },
  sectionTitre: { fontWeight: '700', letterSpacing: 0.06, padding: 12, paddingBottom: 6 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderTopWidth: 0.5 },
  icone: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  ligneLabel: {},
  ligneSub: { marginTop: 1 },
  toggle: { width: 40, height: 24, borderRadius: 12, justifyContent: 'center' },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', position: 'absolute', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 2 },
  version: { textAlign: 'center', padding: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 0.5 },
  modalTitre: { fontWeight: '500' },
  modalOption: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 0.5, gap: 10 },
  debloquerBtn: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
});