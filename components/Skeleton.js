import { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { useApp } from '../AppContext';

export function SkeletonItem({ width = '100%', height = 16, borderRadius = 8, style }) {
  const { modeSombre } = useApp();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.9] });
  const bg = modeSombre ? '#2A2A2A' : '#E8E8E8';

  return (
    <Animated.View style={[{ width, height, borderRadius, backgroundColor: bg, opacity }, style]} />
  );
}

export function SkeletonConversation() {
  return (
    <View style={styles.convRow}>
      <SkeletonItem width={50} height={50} borderRadius={25} />
      <View style={{ flex: 1, gap: 8 }}>
        <SkeletonItem width="60%" height={14} />
        <SkeletonItem width="90%" height={12} />
      </View>
    </View>
  );
}

export function SkeletonEvenement() {
  return (
    <View style={styles.evCard}>
      <SkeletonItem width={52} height={52} borderRadius={10} />
      <View style={{ flex: 1, gap: 8 }}>
        <SkeletonItem width="80%" height={14} />
        <SkeletonItem width="50%" height={12} />
        <SkeletonItem width="40%" height={11} />
      </View>
    </View>
  );
}

export function SkeletonProfil() {
  return (
    <View style={styles.profilWrap}>
      <SkeletonItem width={90} height={90} borderRadius={45} style={{ alignSelf: 'center' }} />
      <View style={{ alignItems: 'center', gap: 8, marginTop: 12 }}>
        <SkeletonItem width={140} height={18} />
        <SkeletonItem width={100} height={13} />
      </View>
      <View style={styles.statsRow}>
        {[1, 2, 3].map(i => (
          <View key={i} style={styles.statItem}>
            <SkeletonItem width={40} height={20} />
            <SkeletonItem width={60} height={11} style={{ marginTop: 4 }} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  convRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, paddingHorizontal: 16 },
  evCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginHorizontal: 16, marginBottom: 8, borderRadius: 14, backgroundColor: '#F5F5F5' },
  profilWrap: { padding: 16 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 16 },
  statItem: { alignItems: 'center' },
});