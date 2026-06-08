import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ErreurReseau({ onReessayer, message, style }) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconeWrap}>
        <Ionicons name="cloud-offline-outline" size={36} color="#888" />
      </View>
      <Text style={styles.titre}>Pas de connexion</Text>
      <Text style={styles.desc}>
        {message || 'Vérifie ta connexion internet et réessaie.'}
      </Text>
      {onReessayer && (
        <TouchableOpacity style={styles.btn} onPress={onReessayer}>
          <Ionicons name="refresh-outline" size={16} color="#fff" />
          <Text style={styles.btnTexte}>Réessayer</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 32, gap: 12,
  },
  iconeWrap: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: '#F5F5F5',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  titre: { fontSize: 17, fontWeight: '500', color: '#111' },
  desc: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#111', borderRadius: 14,
    paddingHorizontal: 20, paddingVertical: 12, marginTop: 8,
  },
  btnTexte: { color: '#fff', fontSize: 14, fontWeight: '500' },
});