import {
  View, Text, ScrollView, TouchableOpacity, Image, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { memo, useState, useEffect } from 'react';
import { supabase } from '../supabase';

const StoriesBar = memo(({ stories, onPress, onCreer, t }) => {
  const [profils, setProfils] = useState({});
  const taille = t || ((s) => s);

  useEffect(() => {
    if (!stories || stories.length === 0) return;
    const userIds = [...new Set(stories.map(s => s.user_id))];
    supabase
      .from('profiles')
      .select('id, prenom, avatar_url')
      .in('id', userIds)
      .then(({ data }) => {
        if (data) {
          const map = {};
          data.forEach(p => { map[p.id] = p; });
          setProfils(map);
        }
      });
  }, [stories]);

  // Groupe les stories par auteur dans l'ordre d'apparition
  const auteurs = {};
  const ordre = [];
  stories.forEach(s => {
    if (!auteurs[s.user_id]) {
      auteurs[s.user_id] = { user_id: s.user_id, stories: [], type: s.type };
      ordre.push(s.user_id);
    }
    auteurs[s.user_id].stories.push(s);
  });

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Bouton créer */}
        <TouchableOpacity style={styles.item} onPress={onCreer}>
          <View style={styles.cercleCreer}>
            <Ionicons name="camera" size={22} color="#fff" />
            <View style={styles.plusBadge}>
              <Ionicons name="add" size={12} color="#fff" />
            </View>
          </View>
          <Text style={[styles.label, { fontSize: taille(10) }]} numberOfLines={1}>
            Ma story
          </Text>
        </TouchableOpacity>

        {/* Stories groupées par auteur */}
        {ordre.map(userId => {
          const auteur = auteurs[userId];
          const profil = profils[userId];
          const couleur =
            auteur.type === 'spot' ? '#EF4444' :
            auteur.type === 'evenement' ? '#2563EB' : '#8B5CF6';
          const prenom = profil?.prenom || 'Story';

          return (
            <TouchableOpacity
              key={userId}
              style={styles.item}
              onPress={() => onPress(auteur.stories)}
            >
              <View style={[styles.cercleBorder, { borderColor: couleur }]}>
                {profil?.avatar_url ? (
                  <Image source={{ uri: profil.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: couleur + '20' }]}>
                    <Ionicons name="camera" size={20} color={couleur} />
                  </View>
                )}
                {/* Badge type en bas à droite */}
                <View style={[styles.typeDot, { backgroundColor: couleur }]} />
              </View>
              <Text style={[styles.label, { fontSize: taille(10) }]} numberOfLines={1}>
                {prenom}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
});

export default StoriesBar;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  scroll: { gap: 14, paddingHorizontal: 16, paddingVertical: 12 },
  item: { alignItems: 'center', gap: 5, width: 64 },
  cercleCreer: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: '#111',
    alignItems: 'center', justifyContent: 'center',
  },
  plusBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#2563EB',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#fff',
  },
  cercleBorder: {
    width: 58, height: 58, borderRadius: 29,
    borderWidth: 2.5,
    alignItems: 'center', justifyContent: 'center',
    padding: 2,
    position: 'relative',
  },
  avatar: {
    width: 50, height: 50, borderRadius: 25,
  },
  avatarPlaceholder: {
    alignItems: 'center', justifyContent: 'center',
  },
  typeDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 14, height: 14, borderRadius: 7,
    borderWidth: 2, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  label: {
    color: '#111', fontWeight: '400', textAlign: 'center',
  },
});