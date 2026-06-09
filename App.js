import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, LogBox } from 'react-native';

import { supabase } from './supabase';
import { EvenementsProvider } from './EvenementsContext';
import { AppProvider, useApp } from './AppContext';
import { MessagerieProvider, useMessagerie } from './MessagerieContext';
import { enregistrerNotifications, ajouterListenerReponse } from './notifications';

import ConnexionScreen from './screens/ConnexionScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import CarteScreen from './screens/CarteScreen';
import ExplorerScreen from './screens/ExplorerScreen';
import MessagerieScreen from './screens/MessagerieScreen';
import ReglagresScreen from './screens/ReglagresScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import AjoutEvenementScreen from './screens/AjoutEvenementScreen';
import DetailEvenementScreen from './screens/DetailEvenementScreen';
import DetailEvenementOfficielScreen from './screens/DetailEvenementOfficiel';
import DetailLieuScreen from './screens/DetailLieu';
import ConversationScreen from './screens/ConversationScreen';
import CompteScreen from './screens/CompteScreen';
import ProfilPublicScreen from './screens/ProfilPublicScreen';
import CGUScreen from './screens/CGUScreen';

LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
  '`expo-notifications` functionality is not fully supported',
  'Notifications.getExpoPushTokenAsync',
]);

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function Onglets() {
  const { theme, facteurTexte } = useApp();
  const { totalNonLus } = useMessagerie();
  const t = (size) => size * facteurTexte;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, size }) => {
          const icons = {
            Carte:    focused ? 'map'         : 'map-outline',
            Explorer: focused ? 'search'      : 'search-outline',
            Messages: focused ? 'chatbubbles' : 'chatbubbles-outline',
            Réglages: focused ? 'settings'    : 'settings-outline',
          };
          if (route.name === 'Messages' && totalNonLus > 0) {
            return (
              <View>
                <Ionicons
                  name={icons[route.name]}
                  size={size}
                  color={focused ? theme.actif : theme.inactif}
                />
                <View style={{
                  position: 'absolute', top: -4, right: -8,
                  backgroundColor: '#EF4444', borderRadius: 8,
                  minWidth: 16, height: 16,
                  alignItems: 'center', justifyContent: 'center',
                  paddingHorizontal: 3,
                }}>
                  <Text style={{ color: '#fff', fontSize: t(10), fontWeight: '500' }}>
                    {totalNonLus}
                  </Text>
                </View>
              </View>
            );
          }
          return (
            <Ionicons
              name={icons[route.name]}
              size={size}
              color={focused ? theme.actif : theme.inactif}
            />
          );
        },
        tabBarActiveTintColor: theme.actif,
        tabBarInactiveTintColor: theme.inactif,
        tabBarStyle: {
          backgroundColor: theme.tabBar,
          borderTopColor: theme.border,
          borderTopWidth: 0.5,
        },
        tabBarLabelStyle: { fontSize: t(10), fontWeight: '500' },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Carte" component={CarteScreen} />
      <Tab.Screen name="Explorer" component={ExplorerScreen} />
      <Tab.Screen name="Messages" component={MessagerieScreen} />
      <Tab.Screen name="Réglages" component={ReglagresScreen} />
    </Tab.Navigator>
  );
}

function Navigation() {
  const [session, setSession] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [onboardingVu, setOnboardingVu] = useState(true);
  const { theme } = useApp();
  const navigationRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session: sess } } = await supabase.auth.getSession();
      setSession(sess);

      if (sess?.user) {
        enregistrerNotifications();
        const { data: profil } = await supabase
          .from('profiles')
          .select('onboarding_vu')
          .eq('id', sess.user.id)
          .single();
        setOnboardingVu(profil?.onboarding_vu ?? false);
      }

      setChargement(false);
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      setSession(sess);
      if (sess?.user) {
        enregistrerNotifications();
        const { data: profil } = await supabase
          .from('profiles')
          .select('onboarding_vu')
          .eq('id', sess.user.id)
          .single();
        setOnboardingVu(profil?.onboarding_vu ?? false);
      }
    });

    const reponseListener = ajouterListenerReponse((response) => {
      const data = response.notification.request.content.data;
      if (data?.evenementId && navigationRef.current) {
        navigationRef.current.navigate('DetailEvenement', { evenement: { id: data.evenementId } });
      }
      if (data?.convId && navigationRef.current) {
        navigationRef.current.navigate('Conversation', { convId: data.convId });
      }
    });

    return () => {
      subscription.unsubscribe();
      reponseListener.remove();
    };
  }, []);

  if (chargement) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' }}>
        <View style={{
          width: 52, height: 52, borderRadius: 14,
          backgroundColor: '#2563EB',
          alignItems: 'center', justifyContent: 'center',
          marginBottom: 16,
        }}>
          <Ionicons name="location" size={26} color="#fff" />
        </View>
        <Text style={{ color: '#fff', fontSize: 26, fontWeight: '600', letterSpacing: -0.5, marginBottom: 8 }}>
          Luma
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, marginBottom: 32 }}>
          rejoins ton quartier
        </Text>
        <ActivityIndicator color="#2563EB" size="small" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          <Stack.Screen name="Connexion" component={ConnexionScreen} />
        ) : !onboardingVu ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={Onglets} />
            <Stack.Screen name="Compte" component={CompteScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="AjoutEvenement" component={AjoutEvenementScreen} />
            <Stack.Screen name="DetailEvenement" component={DetailEvenementScreen} />
            <Stack.Screen name="DetailEvenementOfficiel" component={DetailEvenementOfficielScreen} />
            <Stack.Screen name="DetailLieu" component={DetailLieuScreen} />
            <Stack.Screen name="Conversation" component={ConversationScreen} />
            <Stack.Screen name="ProfilPublic" component={ProfilPublicScreen} />
            <Stack.Screen name="CGU" component={CGUScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AppProvider>
      <EvenementsProvider>
        <MessagerieProvider>
          <Navigation />
        </MessagerieProvider>
      </EvenementsProvider>
    </AppProvider>
  );
}