import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Linking, Image, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { useApp, CATEGORIES, formatDateParis } from '../AppContext';
import { supabase } from '../supabase';

export default function DetailLieu({ route, navigation }) {
  const { lieu } = route.params;
  const { theme, facteurTexte } = useApp();
  const [evenements, setEvenements] = useState([]);
  const [chargement, setChargement] = useState(true);
  const t = (size) => size * facteurTexte;

  useEffect(() => {
    chargerEvenements();
  }, [lieu.id]);

  const chargerEvenements = async () => {
    setChargement(true);
    try {
      const maintenant = new Date().toISOString();
      // Cherche par lieu_id OU par correspondance de nom
      const { data } = await supabase
        .from('evenements_officiels')
        .select('*')
        .eq('actif', true)
        .or(`lieu_id.eq.${lieu.id},lieu.ilike.%${lieu.nom}%`)
        .gte('date_debut', maintenant)
        .order('date_debut', { ascending: true })
        .limit(50);
      if (data) setEvenements(data);
    } catch {}
    setChargement(false);
  };

  const config = CATEGORIES[lieu.categorie] || CATEGORIES['Art'];

  const renderEvenement = ({ item }) => {
    const catEv = CATEGORIES[item.categorie] || CATEGORIES['Art'];
    return (
      <TouchableOpacity
        style={[styles.evCard, { backgroundColor: theme.card, borderColor: theme.border }]}
        onPress={() => navigation.navigate('DetailEvenementOfficiel', { evenement: item })}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: 'row', gap: 12, padding: 12 }}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.evImage} />
          ) : (
            <View style={[styles.evImagePlaceholder, { backgroundColor: catEv.claire }]}>
              <Ionicons name={catEv.icone} size={22} color={catEv.forte} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontSize: t(14), fontWeight: '500', marginBottom: 4 }} numberOfLines={2}>
              {item.titre}
            </Text>
            {item.date_debut && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                <Ionicons name="calendar-outline" size={12} color={catEv.forte} />
                <Text style={{ color: catEv.forte, fontSize: t(12), fontWeight: '500' }}>
                  {formatDateParis(item.date_debut)}
                </Text>
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <View style={[styles.tag, { backgroundColor: catEv.claire }]}>
                <Text style={{ color: catEv.texte, fontSize: t(10), fontWeight: '500' }}>{item.categorie}</Text>
              </View>
              {item.gratuit && (
                <View style={[styles.tag, { backgroundColor: '#DCFCE7' }]}>
                  <Text style={{ color: '#15803D', fontSize: t(10), fontWeight: '500' }}>Gratuit</Text>
                </View>
              )}
              {item.prix_min && (
                <View style={[styles.tag, { backgroundColor: '#FEF3C7' }]}>
                  <Text style={{ color: '#92400E', fontSize: t(10) }}>À partir de {item.prix_min}€</Text>
                </View>
              )}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={15} color={catEv.forte} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 36 }}>
          <Ionicons name="chevron-back" size={22} color={config.forte} />
        </TouchableOpacity>
        <Text style={[styles.headerTitre, { color: theme.text, fontSize: t(16) }]} numberOfLines={1}>
          {lieu.nom}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* Bandeau catégorie */}
        <View style={[styles.bandeau, { backgroundColor: config.forte }]}>
          <Ionicons name={config.icone} size={16} color="#fff" />
          <Text style={{ color: '#fff', fontSize: t(13), fontWeight: '600', letterSpacing: 0.5 }}>
            {lieu.sous_categorie || lieu.categorie}
          </Text>
        </View>

        {/* Infos lieu */}
        <View style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {lieu.adresse && (
            <View style={styles.infoLigne}>
              <View style={[styles.infoIcone, { backgroundColor: config.forte + '15' }]}>
                <Ionicons name="location-outline" size={16} color={config.forte} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text3, fontSize: t(11), marginBottom: 2 }}>Adresse</Text>
                <Text style={{ color: theme.text, fontSize: t(14) }}>{lieu.adresse}</Text>
              </View>
            </View>
          )}
          {lieu.horaires && (
            <>
              <View style={[styles.sep, { backgroundColor: theme.border }]} />
              <View style={styles.infoLigne}>
                <View style={[styles.infoIcone, { backgroundColor: '#F5F5F5' }]}>
                  <Ionicons name="time-outline" size={16} color={theme.text3} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text3, fontSize: t(11), marginBottom: 2 }}>Horaires</Text>
                  <Text style={{ color: theme.text, fontSize: t(13) }}>{lieu.horaires}</Text>
                </View>
              </View>
            </>
          )}
          {lieu.telephone && (
            <>
              <View style={[styles.sep, { backgroundColor: theme.border }]} />
              <TouchableOpacity style={styles.infoLigne} onPress={() => Linking.openURL(`tel:${lieu.telephone}`)}>
                <View style={[styles.infoIcone, { backgroundColor: '#F5F5F5' }]}>
                  <Ionicons name="call-outline" size={16} color={theme.text3} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text3, fontSize: t(11), marginBottom: 2 }}>Téléphone</Text>
                  <Text style={{ color: config.forte, fontSize: t(14) }}>{lieu.telephone}</Text>
                </View>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Programmation */}
        <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ color: theme.text, fontSize: t(17), fontWeight: '500' }}>
              Programmation
            </Text>
            <View style={[styles.tag, { backgroundColor: config.claire }]}>
              <Text style={{ color: config.forte, fontSize: t(11), fontWeight: '500' }}>
                {evenements.length} événement{evenements.length !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>

          {chargement ? (
            <View style={[styles.vide, { backgroundColor: theme.card }]}>
              <Text style={{ color: theme.text3, fontSize: t(13) }}>Chargement...</Text>
            </View>
          ) : evenements.length === 0 ? (
            <View style={[styles.vide, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Ionicons name="calendar-outline" size={28} color={theme.text3} />
              <Text style={{ color: theme.text, fontSize: t(15), fontWeight: '500', marginTop: 8 }}>
                Aucun événement prévu
              </Text>
              <Text style={{ color: theme.text3, fontSize: t(13), marginTop: 4, textAlign: 'center' }}>
                Reviens plus tard ou crée un événement ici
              </Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {evenements.map(ev => renderEvenement({ item: ev }))}
            </View>
          )}
        </View>

        {/* Créer événement */}
        <View style={{ paddingHorizontal: 16 }}>
          <TouchableOpacity
            style={[styles.btnCreer, { backgroundColor: config.forte }]}
            onPress={() => navigation.navigate('AjoutEvenement')}
          >
            <Ionicons name="add-circle-outline" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontSize: t(14), fontWeight: '500' }}>
              Créer un événement ici
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, paddingTop: 56, borderBottomWidth: 0.5 },
  headerTitre: { flex: 1, fontWeight: '500', textAlign: 'center' },
  bandeau: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, paddingHorizontal: 16 },
  infoCard: { margin: 16, borderRadius: 16, borderWidth: 0.5, padding: 4 },
  infoLigne: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 12 },
  infoIcone: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sep: { height: 0.5, marginHorizontal: 12 },
  evCard: { borderRadius: 14, borderWidth: 0.5, overflow: 'hidden' },
  evImage: { width: 64, height: 64, borderRadius: 10, flexShrink: 0 },
  evImagePlaceholder: { width: 64, height: 64, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  vide: { borderRadius: 16, borderWidth: 0.5, padding: 32, alignItems: 'center' },
  btnCreer: { borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});