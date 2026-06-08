import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../AppContext';

const SECTIONS = [
  {
    titre: 'Présentation de Luma',
    contenu: `Luma est une application mobile communautaire permettant à ses utilisateurs de créer, découvrir et rejoindre des événements locaux et des lieux de rencontre dans l'espace public.

Luma est actuellement en phase bêta. Certaines fonctionnalités peuvent être incomplètes, temporairement indisponibles ou modifiées sans préavis. L'utilisation de l'application en phase bêta implique l'acceptation de cet état de fait.`,
  },
  {
    titre: 'Acceptation des conditions',
    contenu: `En créant un compte ou en utilisant Luma, tu acceptes sans réserve les présentes Conditions Générales d'Utilisation (CGU).

Si tu n'acceptes pas ces conditions, tu dois cesser d'utiliser l'application immédiatement.

Ces CGU peuvent être mises à jour à tout moment. Tu seras informé des modifications importantes par notification dans l'application.`,
  },
  {
    titre: 'Inscription et compte',
    contenu: `Pour utiliser Luma, tu dois créer un compte avec une adresse e-mail valide et un mot de passe.

Tu es responsable de la confidentialité de tes identifiants. Toute activité réalisée depuis ton compte est sous ta responsabilité.

Tu t'engages à fournir des informations exactes et à les maintenir à jour. Les comptes créés avec de fausses informations pourront être supprimés sans préavis.

Tu dois avoir au moins 16 ans pour utiliser Luma.`,
  },
  {
    titre: 'Règles de la communauté',
    contenu: `Luma est une plateforme de rencontres en lieu public. En utilisant l'application, tu t'engages à respecter les règles suivantes :

- Tous les événements doivent se dérouler dans des lieux publics accessibles à tous. Il est strictement interdit de communiquer ou de demander des adresses privées.

- Le respect de tous les membres est obligatoire. Tout comportement discriminatoire, harcelant, menaçant ou offensant est interdit.

- Il est interdit de publier des contenus à caractère sexuel, violent, haineux, illégal ou portant atteinte aux droits de tiers.

- Il est interdit d'utiliser Luma à des fins commerciales ou publicitaires sans autorisation préalable.

- La création de faux profils ou de faux événements est interdite.

- Les mineurs de moins de 16 ans ne sont pas autorisés à utiliser l'application.

Le non-respect de ces règles peut entraîner la suspension ou la suppression définitive du compte, sans préavis ni remboursement.`,
  },
  {
    titre: 'Responsabilité des événements',
    contenu: `Luma est une plateforme de mise en relation. Nous ne sommes pas organisateurs des événements publiés par les utilisateurs et ne sommes pas responsables de leur déroulement.

Chaque organisateur est entièrement responsable de l'événement qu'il crée, de son déroulement et de la sécurité des participants.

Luma ne garantit pas la réalité, la qualité ou la sécurité des événements publiés. Tu participes à tout événement sous ta propre responsabilité.

En cas de problème lors d'un événement, tu dois contacter les autorités compétentes directement. Luma ne peut pas intervenir en temps réel.`,
  },
  {
    titre: 'Contenu publié',
    contenu: `Tu restes propriétaire des contenus que tu publies sur Luma (descriptions, photos de profil, commentaires).

En publiant un contenu, tu accordes à Luma une licence non exclusive, gratuite et mondiale pour afficher et distribuer ce contenu dans le cadre du fonctionnement de l'application.

Tu garantis que les contenus que tu publies ne violent pas les droits de tiers (droits d'auteur, droit à l'image, vie privée).

Luma se réserve le droit de supprimer tout contenu jugé inapproprié sans préavis.`,
  },
  {
    titre: 'Données personnelles',
    contenu: `Luma collecte et traite tes données personnelles conformément au Règlement Général sur la Protection des Données (RGPD).

Données collectées : adresse e-mail, prénom, photo de profil (optionnelle), localisation (avec ta permission), événements créés et participations.

Tes données sont hébergées de manière sécurisée sur les serveurs de Supabase (infrastructure européenne).

Tes données ne sont jamais vendues à des tiers ni utilisées à des fins publicitaires.

Tu disposes d'un droit d'accès, de rectification et de suppression de tes données. Tu peux supprimer ton compte à tout moment depuis les Réglages de l'application, ce qui entraîne la suppression définitive de toutes tes données.

Pour toute demande relative à tes données personnelles, utilise la fonction "Proposer une amélioration" dans les Réglages.`,
  },
  {
    titre: 'Disponibilité du service',
    contenu: `Luma est fourni "tel quel", sans garantie de disponibilité continue.

En phase bêta, des interruptions de service, des pertes de données ou des dysfonctionnements peuvent survenir. Nous mettons tout en œuvre pour les minimiser mais ne pouvons pas les garantir.

Luma se réserve le droit de modifier, suspendre ou arrêter tout ou partie du service à tout moment.`,
  },
  {
    titre: 'Propriété intellectuelle',
    contenu: `L'application Luma, son design, son code et ses contenus propres sont protégés par le droit de la propriété intellectuelle.

Il est interdit de copier, reproduire, modifier ou distribuer tout ou partie de l'application sans autorisation écrite préalable.`,
  },
  {
    titre: 'Droit applicable',
    contenu: `Les présentes CGU sont régies par le droit français.

En cas de litige, une solution amiable sera recherchée en priorité. À défaut, les tribunaux compétents seront ceux du ressort du siège social de Luma.`,
  },
  {
    titre: 'Contact',
    contenu: `Pour toute question relative aux présentes CGU ou à l'utilisation de l'application, utilise la fonction "Proposer une amélioration" dans les Réglages de l'application.`,
  },
];

export default function CGUScreen({ navigation }) {
  const { theme, facteurTexte } = useApp();
  const t = (size) => size * facteurTexte;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 32 }}>
          <Ionicons name="chevron-back" size={22} color="#2563EB" />
        </TouchableOpacity>
        <Text style={[styles.headerTitre, { color: theme.text, fontSize: t(17) }]}>
          Conditions générales d'utilisation
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Intro */}
        <View style={[styles.introCard, { backgroundColor: '#111' }]}>
          <View style={styles.introIcone}>
            <Ionicons name="location" size={22} color="#fff" />
          </View>
          <Text style={[styles.introTitre, { fontSize: t(18) }]}>luma</Text>
          <Text style={[styles.introSub, { fontSize: t(13) }]}>
            Conditions Générales d'Utilisation
          </Text>
          <View style={[styles.introBadge, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
            <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.6)" />
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: t(12) }}>
              Version bêta — Dernière mise à jour : mai 2025
            </Text>
          </View>
        </View>

        {/* Résumé */}
        <View style={[styles.resumeCard, { backgroundColor: '#DCFCE7', borderColor: '#22C55E' }]}>
          <View style={styles.resumeHeader}>
            <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
            <Text style={[styles.resumeTitre, { fontSize: t(14) }]}>L'essentiel en 3 points</Text>
          </View>
          {[
            'Tous les événements se déroulent en lieu public — jamais d\'adresses privées.',
            'Tes données ne sont jamais vendues ni utilisées pour de la pub.',
            'Tu peux supprimer ton compte et toutes tes données à tout moment.',
          ].map((point, i) => (
            <View key={i} style={styles.resumePoint}>
              <View style={[styles.resumeDot, { backgroundColor: '#22C55E' }]} />
              <Text style={[styles.resumeTexte, { fontSize: t(13) }]}>{point}</Text>
            </View>
          ))}
        </View>

        {/* Sections */}
        {SECTIONS.map((section, i) => (
          <View
            key={i}
            style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}
          >
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionNum, { backgroundColor: '#111' }]}>
                <Text style={{ color: '#fff', fontSize: t(11), fontWeight: '700' }}>{i + 1}</Text>
              </View>
              <Text style={[styles.sectionTitre, { color: theme.text, fontSize: t(15) }]}>
                {section.titre}
              </Text>
            </View>
            <Text style={[styles.sectionContenu, { color: theme.text2, fontSize: t(13) }]}>
              {section.contenu}
            </Text>
          </View>
        ))}

        {/* Footer */}
        <View style={[styles.footer, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="shield-checkmark-outline" size={20} color="#2563EB" />
          <Text style={[styles.footerTexte, { color: theme.text3, fontSize: t(12) }]}>
            En utilisant Luma, tu confirmes avoir lu et accepté ces conditions générales d'utilisation.
          </Text>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 56, borderBottomWidth: 0.5 },
  headerTitre: { fontWeight: '500', flex: 1, textAlign: 'center' },
  scroll: { padding: 12, gap: 10 },
  introCard: { borderRadius: 16, padding: 20, alignItems: 'center', gap: 8 },
  introIcone: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  introTitre: { color: '#fff', fontWeight: '500', letterSpacing: -0.5 },
  introSub: { color: 'rgba(255,255,255,0.5)', textAlign: 'center' },
  introBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginTop: 4 },
  resumeCard: { borderRadius: 14, padding: 14, borderWidth: 1 },
  resumeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  resumeTitre: { fontWeight: '600', color: '#15803D' },
  resumePoint: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  resumeDot: { width: 6, height: 6, borderRadius: 3, marginTop: 5, flexShrink: 0 },
  resumeTexte: { color: '#15803D', flex: 1, lineHeight: 20 },
  section: { borderRadius: 14, padding: 16, borderWidth: 0.5 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  sectionNum: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sectionTitre: { fontWeight: '600', flex: 1 },
  sectionContenu: { lineHeight: 22 },
  footer: { borderRadius: 14, padding: 14, borderWidth: 0.5, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  footerTexte: { flex: 1, lineHeight: 19, fontStyle: 'italic' },
});