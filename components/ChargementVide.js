import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ChargementVide({
  chargement, icone, couleur, bg, titre, desc, children, style,
}) {
  if (chargement) {
    return (
      <View style={[styles.container, style]}>
        <ActivityIndicator color={couleur || '#2563EB'} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.iconeWrap, { backgroundColor: bg || '#DBEAFE' }]}>
        <Ionicons name={icone || 'search-outline'} size={28} color={couleur || '#2563EB'} />
      </View>
      <Text style={[styles.titre, { color: '#111' }]}>{titre}</Text>
      {desc && <Text style={styles.desc}>{desc}</Text>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 32, gap: 12,
  },
  iconeWrap: {
    width: 64, height: 64, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  titre: { fontSize: 16, fontWeight: '500' },
  desc: { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 20 },
});
