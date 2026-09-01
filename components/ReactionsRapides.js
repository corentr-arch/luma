import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';

const EMOJIS = ['🔥', '👍', '❤️', '😍', '👏'];

export default function ReactionsRapides({ evenementId, evenementOfficielId, profilId, t = (s) => s }) {
  const [reactions, setReactions] = useState([]);
  const colonne = evenementId ? 'evenement_id' : 'evenement_officiel_id';
  const valeur = evenementId || evenementOfficielId;

  const charger = useCallback(async () => {
    if (!valeur) return;
    try {
      const { data } = await supabase.from('evenements_reactions').select('emoji, user_id').eq(colonne, valeur);
      setReactions(data || []);
    } catch {}
  }, [valeur, colonne]);

  useEffect(() => { charger(); }, [charger]);

  const maReaction = reactions.find(r => r.user_id === profilId)?.emoji || null;

  const toggler = async (emoji) => {
    if (!profilId || !valeur) return;
    const precedente = maReaction;
    // Optimiste
    setReactions(prev => {
      const sansMoi = prev.filter(r => r.user_id !== profilId);
      return emoji === precedente ? sansMoi : [...sansMoi, { emoji, user_id: profilId }];
    });
    try {
      if (emoji === precedente) {
        await supabase.from('evenements_reactions').delete().eq(colonne, valeur).eq('user_id', profilId);
      } else if (precedente) {
        await supabase.from('evenements_reactions').update({ emoji }).eq(colonne, valeur).eq('user_id', profilId);
      } else {
        await supabase.from('evenements_reactions').insert({ [colonne]: valeur, user_id: profilId, emoji });
      }
    } catch {
      charger();
    }
  };

  return (
    <View style={styles.row}>
      {EMOJIS.map(emoji => {
        const nb = reactions.filter(r => r.emoji === emoji).length;
        const actif = maReaction === emoji;
        return (
          <TouchableOpacity
            key={emoji}
            style={[styles.chip, actif && styles.chipActif]}
            onPress={() => toggler(emoji)}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: t(16) }}>{emoji}</Text>
            {nb > 0 && <Text style={[styles.compte, { fontSize: t(11) }, actif && { color: '#2563EB', fontWeight: '600' }]}>{nb}</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#f5f5f3', borderRadius: 18,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  chipActif: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  compte: { color: '#888' },
});
