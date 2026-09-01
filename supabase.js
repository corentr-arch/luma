import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://jsvnuvjntlxalbdufgbu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impzdm51dmludGx4YWxiZHVmZ2J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwMTI5MjcsImV4cCI6MjA2MTU4ODkyN30.sWpHBDvBq5DI_LNjRFaMkFBRjQwM6oU_KvXrSEa8JeY';

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
          const response = await fetch(url, {
            ...options,
            headers: {
              ...options.headers,
            },
          });
          return response;
        } catch (e) {
          dernierErreur = e;
          if (i < 2) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        }
      }
      throw dernierErreur;
    },
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});

export const getSessionUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
};