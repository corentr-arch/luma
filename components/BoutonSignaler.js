import { TouchableOpacity, Alert, ActionSheetIOS, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase';
import { haptiqueErreur } from '../utils/haptics';

const RAISONS = [
  'Contenu inapproprié',
  'Spam ou publicité',
  'Fausses informations',
  'Harcèlement',
  'Adresse personnelle partagée',
  'Autre',
];

export default function BoutonSignaler({ type, id, couleur = '#888', taille = 18 }) {
  const signaler = async (raison) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('signalements').insert({
        rapporteur_id: user.id,
        type_contenu: type, // 'evenement', 'story', 'profil', 'message'
        contenu_id: String(id),
        raison,
        statut: 'en_attente',
      });

      await haptiqueSucces?.();
      Alert.alert(
        'Signalement envoyé ✓',
        'Merci. Notre équipe examinera ce contenu sous 24h.',
        [{ text: 'OK' }]
      );
    } catch {
      Alert.alert('Erreur', 'Impossible d\'envoyer le signalement.');
    }
  };

  const ouvrirMenu = () => {
    haptiqueErreur?.();
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'Signaler ce contenu',
          message: 'Pourquoi signales-tu ce contenu ?',
          options: [...RAISONS, 'Annuler'],
          cancelButtonIndex: RAISONS.length,
          destructiveButtonIndex: 0,
        },
        (index) => {
          if (index < RAISONS.length) signaler(RAISONS[index]);
        }
      );
    } else {
      Alert.alert(
        'Signaler ce contenu',
        'Pourquoi signales-tu ce contenu ?',
        [
          ...RAISONS.map(r => ({ text: r, onPress: () => signaler(r) })),
          { text: 'Annuler', style: 'cancel' },
        ]
      );
    }
  };

  return (
    <TouchableOpacity onPress={ouvrirMenu} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <Ionicons name="flag-outline" size={taille} color={couleur} />
    </TouchableOpacity>
  );
}