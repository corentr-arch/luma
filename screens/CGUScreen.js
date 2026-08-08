import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../AppContext';

export default function CGUScreen({ navigation }) {
  const { facteurTexte } = useApp();
  const t = (s) => s * facteurTexte;

  const SECTIONS = [
    {
      titre: '1. Objet',
      contenu: 'Luma est une application mobile de découverte locale permettant aux utilisateurs de créer, partager et rejoindre des événements dans leur quartier. Les présentes conditions régissent l\'utilisation de l\'application.',
    },
    {
      titre: '2. Inscription',
      contenu: 'L\'inscription est gratuite et ouverte à toute personne majeure. Chaque utilisateur est responsable de la confidentialité de ses identifiants et de toute activité effectuée depuis son compte.',
    },
    {
      titre: '3. Règles de la communauté',
      contenu: '• Lieux publics uniquement\n• Respect de tous les utilisateurs\n• Aucune adresse personnelle ou privée\n• Pas de spam, publicité ou contenu inapproprié\n• Signaler tout contenu qui enfreint ces règles',
    },
    {
      titre: '4. Contenu utilisateur',
      contenu: 'En publiant du contenu (événements, stories, messages), tu accordes à Luma une licence non exclusive d\'utilisation. Tu restes responsable du contenu que tu publies et garantis que celui-ci ne viole pas les droits de tiers.',
    },
    {
      titre: '5. Stories',
      contenu: 'Les stories sont géolocalisées et visibles par tous les utilisateurs pendant 24 heures. Après ce délai, elles sont automatiquement supprimées. Luma se réserve le droit de supprimer tout contenu inapproprié sans préavis.',
    },
    {
      titre: '6. Données personnelles',
      contenu: 'Luma collecte uniquement les données nécessaires au fonctionnement de l\'application : email, prénom, position géographique (avec ton accord), et contenu publié. Tes données ne sont jamais vendues à des tiers.',
    },
    {
      titre: '7. Localisation',
      contenu: 'L\'accès à ta position géographique est optionnel mais améliore l\'expérience. Tu peux désactiver la localisation à tout moment dans les réglages de ton téléphone.',
    },
    {
      titre: '8. Responsabilité',
      contenu: 'Luma met en relation des utilisateurs mais ne peut être tenu responsable du contenu publié ni des rencontres organisées. Chaque utilisateur participe aux événements sous sa propre responsabilité.',
    },
    {
      titre: '9. Suppression du compte',
      contenu: 'Tu peux supprimer ton compte à tout moment depuis les Réglages > Compte > Supprimer le compte. Toutes tes données seront supprimées dans un délai de 30 jours.',
    },
    {
      titre: '10. Modifications',
      contenu: 'Luma se réserve le droit de modifier ces conditions à tout moment. Les utilisateurs seront notifiés de toute modification importante.',
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color="#2563EB" />
          <Text style={{ color: '#2563EB', fontSize: t(16) }}>Retour</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitre, { fontSize: t(16) }]}>CGU</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.heroBadge}>
          <Ionicons name="document-text" size={24} color="#2563EB" />
        </View>
        <Text style={[styles.titre, { fontSize: t(22) }]}>Conditions d'utilisation</Text>
        <Text style={[styles.version, { fontSize: t(12) }]}>Dernière mise à jour : août 2026</Text>

        {SECTIONS.map((section, i) => (
          <View key={i} style={styles.section}>
            <Text style={[styles.sectionTitre, { fontSize: t(15) }]}>{section.titre}</Text>
            <Text style={[styles.sectionContenu, { fontSize: t(13) }]}>{section.contenu}</Text>
          </View>
        ))}

        <View style={styles.footer}>
          <Ionicons name="location" size={20} color="#2563EB" />
          <Text style={[styles.footerTxt, { fontSize: t(13) }]}>
            luma — rejoins ton quartier
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf8' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 54 : 16, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.06)', backgroundColor: '#fafaf8' },
  backBtn: { flexDirection: 'row', alignItems: 'center', width: 70 },
  headerTitre: { fontWeight: '600', color: '#111', flex: 1, textAlign: 'center' },
  scroll: { padding: 20, paddingBottom: 48 },
  heroBadge: { width: 56, height: 56, borderRadius: 17, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center', marginBottom: 16, alignSelf: 'center' },
  titre: { fontWeight: '700', color: '#111', textAlign: 'center', letterSpacing: -0.5, marginBottom: 6 },
  version: { color: '#aaa', textAlign: 'center', marginBottom: 24 },
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.06)' },
  sectionTitre: { fontWeight: '600', color: '#111', marginBottom: 8, letterSpacing: -0.2 },
  sectionContenu: { color: '#666', lineHeight: 20 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, padding: 16 },
  footerTxt: { color: '#aaa', fontWeight: '500' },
});