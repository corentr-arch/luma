import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function enregistrerNotifications() {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Luma',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563EB',
      });
    }

    const { status: existant } = await Notifications.getPermissionsAsync();
    let statut = existant;

    if (existant !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      statut = status;
    }

    if (statut !== 'granted') return null;

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '3687e53e-3daf-4916-9132-a720982a44db',
    });

    const token = tokenData.data;

    // ✅ Sauvegarde le token en base
    const { data: { user } } = await supabase.auth.getUser();
    if (user && token) {
      await supabase.from('profiles')
        .update({ push_token: token })
        .eq('id', user.id);
    }

    return token;
  } catch (e) {
    console.log('Notifications non disponibles:', e.message);
    return null;
  }
}

export function ajouterListenerReponse(callback) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

export function ajouterListenerReception(callback) {
  return Notifications.addNotificationReceivedListener(callback);
}
