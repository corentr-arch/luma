import * as Haptics from 'expo-haptics';

export const haptiqueLeger = async () => {
  try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
};

export const haptiqueMoyen = async () => {
  try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
};

export const haptiqueSucces = async () => {
  try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
};

export const haptiqueErreur = async () => {
  try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
};

export const haptiqueSelection = async () => {
  try { await Haptics.selectionAsync(); } catch {}
};