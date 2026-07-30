import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, LogBox, Platform } from 'react-native';

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
import CreerStoryScreen from './screens/CreerStoryScreen';

LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
  '`expo-notifications` functionality is not fully supported',
  'Notifications.getExpoPushTokenAsync',
]);

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const ONGLETS = [
  { name: 'Carte',    label: 'Carte',     icone: 'map',          iconeOff: 'map-outline' },
  { name: 'Explorer', label: 'Explorer',  icone: 'search',       iconeOff: 'search-outline' },
  { name: 'Messages', label: 'Messages',  icone: 'chatbubbles',  iconeOff: 'chatbubbles-outline' },
  { name: 'Réglages', label: 'Profil',    icone: 'person',       iconeOff: 'person-outline' },
];

function IconeOnglet({ name, focused, couleurActif, totalNonLus }) {
  const onglet = ONGLETS.find(o => o.name === name);
  if (!onglet) return null;

  const couleur = focused ? couleurActif : '#9CA3AF';
  const icone = focused ? onglet.icone : onglet.iconeOff;

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      {/* Fond rond quand actif — style Toasty */}
      <View style={{
        width: 44,
        height: 28,
        borderRadius: 14,
        backgroundColor: focused ? couleurActif + '18' : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Ionicons name={icone} size={22} color={couleur} />
        {/* Badge messages non lus */}
        {name === 'Messages' && totalNonLus > 0 && (
          <View style={{
            position: 'absolute', top: -2, right: -2,
            backgroundColor: '#EF4444',
            borderRadius: 8, minWidth: 16, height: 16,
            alignItems: 'center', justifyContent: 'center',
            paddingHorizontal: 3,
            borderWidth: 1.5, borderColor: '#fff',
          }}>
            <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>
              {totalNonLus > 9 ? '9+' : totalNonLus}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function Onglets() {
  const { theme, facteurTexte } = useApp();
  const { totalNonLus } = useMessagerie();
  const t = (size) => size * facteurTexte;
  const couleurActif = '#111';

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => (
          <IconeOnglet
            name={route.name}
            focused={focused}
            couleurActif={couleurActif}
            totalNonLus={totalNonLus}
          />
        ),
        tabBarLabel: ({ focused }) => {
          const onglet = ONGLETS.find(o => o.name === route.name);
          return (
            <Text style={{
              fontSize: t(10),
              fontWeight: focused ? '600' : '400',
              color: focused ? couleurActif : '#9CA3AF',
              marginTop: -2,
              letterSpacing: 0.1,
            }}>
              {onglet?.label || route.name}
            </Text>
          );
        },
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 0.5,
          borderTopColor: '#F0F0F0',
          height: Platform.OS === 'ios' ? 82 : 62,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 24 : 10,
          // Ombre légère style Toasty
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.04,
          shadowRadius: 8,
          elevation: 8,
        },
        tabBarItemStyle: {
          paddingTop: 2,
        },
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

  const chargerProfil = async (userId) => {
    if (!userId) return;
    const { data: profil } = await supabase
      .from('profiles')
      .select('onboarding_vu')
      .eq('id', userId)
      .single();
    setOnboardingVu(profil?.onboarding_vu ?? false);
  };

  useEffect(() => {
    const init = async () => {
      const { data: { session: sess } } = await supabase.auth.getSession();
      setSession(sess);
      if (sess?.user) {
        enregistrerNotifications();
        await chargerProfil(sess.user.id);
      }
      setChargement(false);
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      setSession(sess);
      if (sess?.user) {
        enregistrerNotifications();
        await chargerProfil(sess.user.id);
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

  useEffect(() => {
    if (onboardingVu || !session?.user) return;
    const interval = setInterval(async () => {
      const { data: profil } = await supabase
        .from('profiles')
        .select('onboarding_vu')
        .eq('id', session.user.id)
        .single();
      if (profil?.onboarding_vu) {
        setOnboardingVu(true);
        clearInterval(interval);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [onboardingVu, session]);

  if (chargement) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' }}>
        <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Ionicons name="location" size={26} color="#fff" />
        </View>
        <Text style={{ color: '#fff', fontSize: 26, fontWeight: '600', letterSpacing: -0.5, marginBottom: 8 }}>Luma</Text>
        <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, marginBottom: 32 }}>rejoins ton quartier</Text>
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
            <Stack.Screen
              name="CreerStory"
              component={CreerStoryScreen}
              options={{ presentation: 'modal' }}
            />
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