import {
  View, Text, Image, TouchableOpacity, StyleSheet, Dimensions,
  Animated, TextInput, KeyboardAvoidingView, Platform,
  StatusBar, SafeAreaView, Alert,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabase';
import { useApp } from '../AppContext';
import { haptiqueLeger, haptiqueSucces, haptiqueErreur } from '../utils/haptics';
import BoutonSignaler from './BoutonSignaler';

const { width: W } = Dimensions.get('window');
const DUREE_IMAGE = 5000;

export default function StoryViewer({ stories: storiesInitiales, indexDepart = 0, onFermer, onVoirCarte, onStoryDeleted, navigation }) {
  const { profil } = useApp();
  const [stories, setStories] = useState(storiesInitiales);
  const [index, setIndex] = useState(indexDepart);
  const [pause, setPause] = useState(false);
  const [reponse, setReponse] = useState('');
  const [showReponse, setShowReponse] = useState(false);
  const [liked, setLiked] = useState(false);
  const [nbLikes, setNbLikes] = useState(0);
  const [auteurProfils, setAuteurProfils] = useState({});
  const [dureVideo, setDureVideo] = useState(DUREE_IMAGE);
  const progression = useRef(new Animated.Value(0)).current;
  const animRef = useRef(null);
  const tapDebut = useRef(0);

  const story = stories?.[index];
  const estVideo = story?.media_type === 'video';
  const estMonStory = profil?.id && story?.user_id === profil.id;
  const auteur = story ? (auteurProfils[story.user_id] || null) : null;

  // ✅ Video player
  const videoPlayer = useVideoPlayer(estVideo ? story.media_url : null, (player) => {
    if (player) {
      player.loop = false;
      player.muted = false;
      player.play();
    }
  });

  useEffect(() => {
    const userIds = [...new Set(storiesInitiales.map(s => s.user_id))];
    if (userIds.length === 0) return;
    supabase.from('profiles').select('id, prenom, avatar_url').in('id', userIds)
      .then(({ data }) => {
        if (data) {
          const map = {};
          data.forEach(p => { map[p.id] = p; });
          setAuteurProfils(map);
        }
      });
  }, []);

  useEffect(() => {
    if (!story) return;
    setLiked(false);
    setNbLikes(story.nb_likes || 0);
    marquerVue();

    if (estVideo) {
      // Pour la vidéo on démarre la progression après avoir la durée
      videoPlayer?.play();
    } else {
      demarrerProgression(DUREE_IMAGE);
    }

    return () => {
      stopProgression();
      if (estVideo) videoPlayer?.pause();
    };
  }, [index]);

  // ✅ Écoute la fin de la vidéo
  useEffect(() => {
    if (!estVideo || !videoPlayer) return;

    const sub = videoPlayer.addListener('playToEnd', () => {
      suivante();
    });

    const statusSub = videoPlayer.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay' && videoPlayer.duration) {
        const duree = videoPlayer.duration * 1000;
        setDureVideo(duree);
        demarrerProgression(duree);
      }
    });

    return () => {
      sub?.remove();
      statusSub?.remove();
    };
  }, [estVideo, videoPlayer, index]);

  useEffect(() => {
    if (pause) {
      stopProgression();
      if (estVideo) videoPlayer?.pause();
    } else if (story) {
      if (estVideo) videoPlayer?.play();
      // Ne redémarre pas la progression pour la vidéo — elle est gérée par le player
      else demarrerProgression(DUREE_IMAGE);
    }
  }, [pause]);

  const marquerVue = async () => {
    if (!profil || !story) return;
    try {
      await supabase.from('stories_vues').upsert(
        { story_id: story.id, user_id: profil.id },
        { onConflict: 'story_id,user_id' }
      );
      await supabase.from('stories').update({ nb_vues: (story.nb_vues || 0) + 1 }).eq('id', story.id);
    } catch {}
  };

  const demarrerProgression = (duree = DUREE_IMAGE) => {
    progression.setValue(0);
    animRef.current = Animated.timing(progression, {
      toValue: 1,
      duration: duree,
      useNativeDriver: false,
    });
    animRef.current.start(({ finished }) => { if (finished && !estVideo) suivante(); });
  };

  const stopProgression = () => animRef.current?.stop();

  const suivante = useCallback(() => {
    if (index < stories.length - 1) setIndex(i => i + 1);
    else onFermer();
  }, [index, stories]);

  const precedente = useCallback(() => {
    if (index > 0) setIndex(i => i - 1);
  }, [index]);

  const toggleLike = async () => {
    if (!profil || !story) return;
    await haptiqueLeger();
    if (liked) {
      await supabase.from('stories_likes').delete().eq('story_id', story.id).eq('user_id', profil.id);
      setNbLikes(n => Math.max(0, n - 1));
    } else {
      await haptiqueSucces();
      await supabase.from('stories_likes').insert({ story_id: story.id, user_id: profil.id });
      setNbLikes(n => n + 1);
    }
    setLiked(l => !l);
  };

  const supprimerStory = () => {
    haptiqueErreur();
    Alert.alert(
      'Supprimer cette story ?',
      'Elle sera supprimée définitivement.',
      [
        { text: 'Annuler', style: 'cancel', onPress: () => { setPause(false); } },
        {
          text: 'Supprimer', style: 'destructive',
          onPress: async () => {
            try {
              stopProgression();
              const urlParts = story.media_url.split('/storage/v1/object/public/stories/');
              const cheminFichier = urlParts[1];
              await supabase.from('stories').update({ actif: false }).eq('id', story.id);
              if (cheminFichier) await supabase.storage.from('stories').remove([cheminFichier]);
              if (onStoryDeleted) onStoryDeleted(story.id);
              const newStories = stories.filter(s => s.id !== story.id);
              if (newStories.length === 0) onFermer();
              else { setStories(newStories); setIndex(Math.min(index, newStories.length - 1)); }
            } catch {
              Alert.alert('Erreur', 'Impossible de supprimer la story');
              setPause(false);
            }
          },
        },
      ]
    );
  };

  const envoyerReponse = async () => {
    if (!reponse.trim() || !profil || !story) return;
    await supabase.from('stories_reponses').insert({ story_id: story.id, user_id: profil.id, texte: reponse.trim() });
    await haptiqueSucces();
    setReponse('');
    setShowReponse(false);
    setPause(false);
  };

  const formatTemps = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const min = Math.floor(diff / 60000);
    const h = Math.floor(min / 60);
    if (min < 1) return "à l'instant";
    if (min < 60) return `il y a ${min}m`;
    if (h < 24) return `il y a ${h}h`;
    return `il y a ${Math.floor(h / 24)}j`;
  };

  const onTouchStart = (e) => {
    tapDebut.current = e.nativeEvent.timestamp;
    setPause(true);
    stopProgression();
  };

  const onTouchEnd = (e) => {
    const dur = e.nativeEvent.timestamp - tapDebut.current;
    if (dur < 200) {
      const x = e.nativeEvent.locationX;
      if (x < W / 3) precedente(); else suivante();
    } else {
      setPause(false);
      if (!estVideo) demarrerProgression(DUREE_IMAGE);
    }
  };

  if (!story) return null;

  const couleurType = story.type === 'spot' ? '#EF4444' : story.type === 'evenement' ? '#2563EB' : '#8B5CF6';
  const labelType = story.type === 'spot' ? '⚡ Spot' : story.type === 'evenement' ? '🎉 Événement' : '📍 Lieu';

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* ✅ Media — image ou vidéo */}
      <View style={StyleSheet.absoluteFill} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {estVideo ? (
          <VideoView
            player={videoPlayer}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            nativeControls={false}
          />
        ) : (
          <Image
            source={{ uri: story.media_url }}
            style={StyleSheet.absoluteFill}
            resizeMode="contain"
          />
        )}
      </View>

      <View style={styles.gradientHaut} pointerEvents="none" />
      <View style={styles.gradientBas} pointerEvents="none" />

      {/* ✅ Badge vidéo */}
      {estVideo && (
        <View style={styles.videoBadge}>
          <Ionicons name="videocam" size={12} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>Vidéo</Text>
        </View>
      )}

      <SafeAreaView style={styles.barresWrap} pointerEvents="none">
        <View style={styles.barres}>
          {stories.map((_, i) => (
            <View key={i} style={styles.barreContainer}>
              {i < index ? (
                <View style={[styles.barre, { backgroundColor: '#fff', width: '100%' }]} />
              ) : i === index ? (
                <Animated.View style={[styles.barre, {
                  backgroundColor: '#fff',
                  width: progression.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                }]} />
              ) : (
                <View style={[styles.barre, { backgroundColor: 'rgba(255,255,255,0.35)', width: '100%' }]} />
              )}
            </View>
          ))}
        </View>

        <View style={styles.header} pointerEvents="box-none">
          <View style={styles.auteurRow}>
            {auteur?.avatar_url ? (
              <Image source={{ uri: auteur.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={18} color="#fff" />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.prenomTexte}>{auteur?.prenom || 'Luma'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={styles.tempsTexte}>{formatTemps(story.created_at)}</Text>
                {story.adresse && (
                  <>
                    <Text style={styles.tempsTexte}>·</Text>
                    <Ionicons name="location-outline" size={10} color="rgba(255,255,255,0.7)" />
                    <Text style={[styles.tempsTexte, { flex: 1 }]} numberOfLines={1}>{story.adresse}</Text>
                  </>
                )}
              </View>
            </View>
            <View style={[styles.typePill, { backgroundColor: couleurType }]}>
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>{labelType}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            {!estMonStory && (
              <BoutonSignaler type="story" id={story.id} couleur="rgba(255,255,255,0.7)" taille={18} />
            )}
            {estMonStory && (
              <TouchableOpacity
                onPress={() => { stopProgression(); setPause(true); supprimerStory(); }}
                style={styles.supprimerBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="trash-outline" size={20} color="#fff" />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onFermer} style={styles.fermerBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {story.texte && (
        <View style={styles.texteWrap} pointerEvents="none">
          <Text style={styles.texteStory}>{story.texte}</Text>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.actionsWrap}
      >
        {showReponse ? (
          <View style={styles.reponseRow}>
            <TextInput
              style={styles.reponseInput}
              placeholder="Répondre..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={reponse}
              onChangeText={setReponse}
              autoFocus
              onSubmitEditing={envoyerReponse}
            />
            <TouchableOpacity onPress={envoyerReponse} style={styles.envoyerBtn}>
              <Ionicons name="send" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setShowReponse(false); setPause(false); }}
              style={styles.annulerBtn}
            >
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.actionsRow}>
            {!estMonStory && (
              <TouchableOpacity
                style={styles.reponsePill}
                onPress={() => { setPause(true); stopProgression(); setShowReponse(true); }}
              >
                <Ionicons name="chatbubble-outline" size={14} color="rgba(255,255,255,0.7)" />
                <Text style={styles.reponsePillTexte}>Répondre...</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={toggleLike} style={styles.actionBtn}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={28} color={liked ? '#EF4444' : '#fff'} />
              {nbLikes > 0 && <Text style={styles.actionCount}>{nbLikes}</Text>}
            </TouchableOpacity>
            {story.latitude && story.longitude && onVoirCarte && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => { onFermer(); onVoirCarte(story.latitude, story.longitude); }}
              >
                <Ionicons name="map" size={24} color="#fff" />
              </TouchableOpacity>
            )}
            <View style={styles.actionBtn}>
              <Ionicons name="eye-outline" size={20} color="rgba(255,255,255,0.6)" />
              <Text style={styles.actionCount}>{story.nb_vues || 0}</Text>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  gradientHaut: { position: 'absolute', top: 0, left: 0, right: 0, height: 220, zIndex: 5, backgroundColor: 'transparent' },
  gradientBas: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 200, zIndex: 5, backgroundColor: 'transparent' },
  videoBadge: { position: 'absolute', top: 110, right: 16, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4, zIndex: 15 },
  barresWrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  barres: { flexDirection: 'row', gap: 3, paddingHorizontal: 8, paddingTop: 8 },
  barreContainer: { flex: 1, height: 2.5, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' },
  barre: { height: '100%', borderRadius: 2 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 6, paddingBottom: 4 },
  auteurRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  avatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: '#fff' },
  avatarPlaceholder: { backgroundColor: '#374151', alignItems: 'center', justifyContent: 'center' },
  prenomTexte: { color: '#fff', fontSize: 14, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  tempsTexte: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  typePill: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  supprimerBtn: { padding: 6, backgroundColor: 'rgba(239,68,68,0.3)', borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  fermerBtn: { padding: 4 },
  texteWrap: { position: 'absolute', bottom: 130, left: 20, right: 20, alignItems: 'center', zIndex: 8 },
  texteStory: { color: '#fff', fontSize: 22, fontWeight: '700', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, overflow: 'hidden' },
  actionsWrap: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: Platform.OS === 'ios' ? 44 : 20, paddingTop: 12 },
  reponsePill: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', borderRadius: 24, paddingHorizontal: 14, paddingVertical: 10 },
  reponsePillTexte: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
  actionBtn: { alignItems: 'center', gap: 2 },
  actionCount: { color: 'rgba(255,255,255,0.8)', fontSize: 11 },
  reponseRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: Platform.OS === 'ios' ? 44 : 20, paddingTop: 12 },
  reponseInput: { flex: 1, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, color: '#fff', fontSize: 14 },
  envoyerBtn: { padding: 8 },
  annulerBtn: { padding: 8 },
});
