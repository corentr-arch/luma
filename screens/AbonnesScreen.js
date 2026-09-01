import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { useApp } from '../AppContext';
import { supabase } from '../supabase';

export default function AbonnesScreen({ route, navigation }) {
  const { userId, mode, prenom } = route.params;
  const { facteurTexte } = useApp();
  const t = (size) => size * facteurTexte;

  const [liste, setListe] = useState([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => { charger(); }, [userId, mode]);

  const charger = async () => {
    setChargement(true);
    try {
      if (mode === 'followers') {
        const { data } = await supabase.from('abonnements')
          .select('follower_id, profiles:follower_id(id, prenom, handle, avatar_url, arrondissement)')
          .eq('suivi_id', userId).order('created_at', { ascending: false });
        setListe((data || []).map(d => d.profiles).filter(Boolean));
      } else {
        const { data } = await supabase.from('abonnements')
          .select('suivi_id, profiles:suivi_id(id, prenom, handle, avatar_url, arrondissement)')
          .eq('follower_id', userId).order('created_at', { ascending: false });
        setListe((data || []).map(d => d.profiles).filter(Boolean));
      }
    } catch {}
    setChargement(false);
  };

  const titre = mode === 'followers' ? 'Abonnés' : 'Abonnements';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color="#2563EB" />
          <Text style={{ color: '#2563EB', fontSize: t(16) }}>Retour</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitre, { fontSize: t(16) }]} numberOfLines={1}>
          {titre}{prenom ? ` · ${prenom}` : ''}
        </Text>
        <View style={{ width: 70 }} />
      </View>

      {chargement ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#111" />
        </View>
      ) : (
        <FlatList
          data={liste}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, gap: 4 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.ligne}
              onPress={() => navigation.navigate('ProfilPublic', { userId: item.id })}
              activeOpacity={0.7}
            >
              {item.avatar_url ? (
                <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarDefaut]}>
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
                    {item.prenom ? item.prenom[0].toUpperCase() : '?'}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#111', fontSize: t(15), fontWeight: '500' }}>{item.prenom || 'Utilisateur'}</Text>
                {item.arrondissement && <Text style={{ color: '#aaa', fontSize: t(12) }}>{item.arrondissement}</Text>}
              </View>
              <Ionicons name="chevron-forward" size={14} color="#ddd" />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.vide}>
              <Ionicons name="people-outline" size={32} color="#ddd" />
              <Text style={{ color: '#aaa', fontSize: t(14), marginTop: 8 }}>
                {mode === 'followers' ? 'Aucun abonné' : 'Aucun abonnement'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingTop: 58, paddingBottom: 12,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', width: 70 },
  headerTitre: { fontWeight: '600', color: '#111', flex: 1, textAlign: 'center' },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarDefaut: { backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  vide: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
});
