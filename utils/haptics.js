import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Haptics ───────────────────────────────────────────────────────────────
const iOS = Platform.OS === 'ios';

export const haptiqueLeger = async () => {
  if (!iOS) return;
  try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
};

export const haptiqueMoyen = async () => {
  if (!iOS) return;
  try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
};

export const haptiqueSucces = async () => {
  if (!iOS) return;
  try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
};

export const haptiqueErreur = async () => {
  if (!iOS) return;
  try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
};

export const haptiqueSelection = async () => {
  if (!iOS) return;
  try { await Haptics.selectionAsync(); } catch {}
};

// ── Storage ───────────────────────────────────────────────────────────────
export const storageSauvegarder = async (cle, valeur) => {
  try { await AsyncStorage.setItem(cle, JSON.stringify(valeur)); return true; } catch { return false; }
};

export const storageLire = async (cle, defaut = null) => {
  try {
    const json = await AsyncStorage.getItem(cle);
    return json ? JSON.parse(json) : defaut;
  } catch { return defaut; }
};

export const storageSupprimer = async (cle) => {
  try { await AsyncStorage.removeItem(cle); return true; } catch { return false; }
};

// ── Format ────────────────────────────────────────────────────────────────
export const formatTemps = (dateStr) => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  const h = Math.floor(min / 60);
  const j = Math.floor(h / 24);
  if (min < 1) return "à l'instant";
  if (min < 60) return `${min}m`;
  if (h < 24) return `${h}h`;
  if (j < 7) return `${j}j`;
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

export const formatDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(km * 10) / 10;
};

export const truncate = (str, max = 100) => {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '...' : str;
};

export const sanitizeInput = (str) => {
  if (!str) return '';
  return str.replace(/[<>"\\/]/g, '').trim();
};

export const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};