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
  'The <CameraView> component does not support children',
  'MapView',
]);

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const ONGLETS = [
  { name: 'Carte',    label: 'Carte',    icone: 'map',           iconeOff: 'map-outline' },
  { name: 'Explorer', label: 'Explorer', icone: 'compass',       iconeOff: 'compass-outline' },
  { name: 'Messages', label: 'Messages', icone: 'chatbubble',    iconeOff: 'chatbubble-outline' },
  { name: 'Reglages', label: 'Profil',   icone: 'person-circle', iconeOff: 'person-circle-outline' },
];

function IconeOnglet({ name, focused, totalNonLus }) {
  const onglet = ONGLETS.find(o => o.name === name);
  if (!onglet) return null;
  const couleur = focused ? '#111' : '#C0C0C0';
  const icone = focused ? onglet.icone : onglet.iconeOff;

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: 48, height: 30, borderRadius: 15,
        backgroundColor: focused ? 'rgba(17,17,17,0.08)' : 'transparent',
        alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        <Ionicons name={icone} size={22} color={couleur} />
        {name === 'Messages' && totalNonLus > 0 && (
          <View style={{
            position: 'absolute', top: 0, right: 2,
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
  const { facteurTexte } = useApp();
  const { totalNonLus } = useMessagerie();
  const t = (s) => s * facteurTexte;

  return (
    <Tab.Navigator
      initialRouteName="Carte"
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => (
          <IconeOnglet name={route.name} focused={focused} totalNonLus={totalNonLus} />
        ),
        tabBarLabel: ({ focused }) => {
          const onglet = ONGLETS.find(o => o.name === route.name);
          return (
            <Text style={{
              fontSize: t(10),
              fontWeight: focused ? '600' : '400',
              color: focused ? '#111' : '#C0C0C0',
              marginTop: -2,
              letterSpacing: 0.1,
            }}>
              {onglet?.label || route.name}
            </Text>
          );
        },
        tabBarStyle: {
          backgroundColor: 'rgba(255,255,255,0.97)',
          borderTopWidth: 0.5,
          borderTopColor: 'rgba(0,0,0,0.07)',
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 26 : 10,
        },
        tabBarItemStyle: { paddingTop: 2 },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Carte" component={CarteScreen} />
      <Tab.Screen name="Explorer" component={ExplorerScreen} />
      <Tab.Screen name="Messages" component={MessagerieScreen} />
      <Tab.Screen name="Reglages" component={ReglagresScreen} />
    </Tab.Navigator>
  );
}

function Navigation() {
  const [session, setSession] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [onboardingVu, setOnboardingVu] = useState(true);
  const navigationRef = useRef(null);

  const chargerProfil = async (userId) => {
    if (!userId) return;
    try {
      const { data: profil } = await supabase
        .from('profiles')
        .select('onboarding_vu')
        .eq('id', userId)
        .single();
      setOnboardingVu(profil?.onboarding_vu ?? true);
    } catch {
      setOnboardingVu(true);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session: sess } } = await supabase.auth.getSession();
        setSession(sess);
        if (sess?.user) {
          await chargerProfil(sess.user.id);
          enregistrerNotifications();
        }
      } catch {}
      setChargement(false);
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      setSession(sess);
      if (sess?.user) {
        await chargerProfil(sess.user.id);
        enregistrerNotifications();
      } else {
        setOnboardingVu(true);
      }
    });

    const reponseListener = ajouterListenerReponse((response) => {
      const data = response.notification.request.content.data;
      if (data?.convId && navigationRef.current) {
        navigationRef.current.navigate('Conversation', { convId: data.convId });
      }
      if (data?.evenementId && navigationRef.current) {
        navigationRef.current.navigate('DetailEvenement', { evenement: { id: data.evenementId } });
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
      try {
        const { data: profil } = await supabase
          .from('profiles')
          .select('onboarding_vu')
          .eq('id', session.user.id)
          .single();
        if (profil?.onboarding_vu) {
          setOnboardingVu(true);
          clearInterval(interval);
        }
      } catch {}
    }, 1500);
    return () => clearInterval(interval);
  }, [onboardingVu, session]);

  if (chargement) {
    return (
      <View style={{
        flex: 1, alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#111',
      }}>
        <View style={{
          width: 64, height: 64, borderRadius: 20,
          backgroundColor: '#fff',
          alignItems: 'center', justifyContent: 'center',
          marginBottom: 20,
        }}>
          <Ionicons name="location" size={28} color="#111" />
        </View>
        <Text style={{
          color: '#fff', fontSize: 28, fontWeight: '700',
          letterSpacing: -0.8, marginBottom: 8,
        }}>
          Luma
        </Text>
        <Text style={{
          color: 'rgba(255,255,255,0.3)', fontSize: 13,
          marginBottom: 40,
        }}>
          rejoins ton quartier
        </Text>
        <ActivityIndicator color="rgba(255,255,255,0.4)" size="small" />
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
            <Stack.Screen
              name="DetailEvenementOfficiel"
              component={DetailEvenementOfficielScreen}
            />
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