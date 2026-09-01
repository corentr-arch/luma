import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://jsvnuvjntlxalbdufgbu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impzdm51dmpudGx4YWxiZHVmZ2J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NzA1OTUsImV4cCI6MjA5NjE0NjU5NX0.LAHyyvzwOH4GOjJdoiQDM4u7CGtcsc5zXbA5jOMVnTQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: async (url, options = {}) => {
      let dernierErreur;
      for (let i = 0; i < 3; i++) {
        try {
          const response = await fetch(url, options);
          return response;
        } catch (e) {
          dernierErreur = e;
          if (i < 2) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        }
      }
      throw dernierErreur;
    },
  },
});

export const getSessionUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
};