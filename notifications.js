import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
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
  // Expo Go SDK 53 ne supporte pas les push notifications
  if (!Device.isDevice) return null;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Luma',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    // Sur Expo Go SDK 53 les push tokens ne fonctionnent pas sur Android
    // On les ignore silencieusement
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: 'luma',
      });
      const token = tokenData?.data;
      if (token) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('profiles').update({ push_token: token }).eq('id', user.id);
        }
        return token;
      }
    } catch {
      // Silencieux — normal sur Expo Go SDK 53
      return null;
    }
  } catch {
    return null;
  }

  return null;
}

export function ajouterListenerNotification(callback) {
  try {
    return Notifications.addNotificationReceivedListener(callback);
  } catch {
    return { remove: () => {} };
  }
}

export function ajouterListenerReponse(callback) {
  try {
    return Notifications.addNotificationResponseReceivedListener(callback);
  } catch {
    return { remove: () => {} };
  }
}