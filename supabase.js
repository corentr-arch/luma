import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://jsvnuvjntlxalbdufgbu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impzdm51dmludGx4YWxiZHVmZ2J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwMTI5MjcsImV4cCI6MjA2MTU4ODkyN30.sWpHBDvBq5DI_LNjRFaMkFBRjQwM6oU_KvXrSEa8JeY';

// ✅ Fetch avec retry exponentiel et timeout
const fetchAvecRetry = async (url, options = {}, essai = 0) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        ...options.headers,
        'x-app-version': '1.0.0',
        'x-platform': 'mobile',
      },
    });
    clearTimeout(timeout);
    return response;
  } catch (e) {
    clearTimeout(timeout);
    if (essai < 3 && (e.name === 'AbortError' || e.message?.includes('network'))) {
      const delai = Math.min(1000 * Math.pow(2, essai), 8000);
      await new Promise(r => setTimeout(r, delai));
      return fetchAvecRetry(url, options, essai + 1);
    }
    throw e;
  }
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: fetchAvecRetry,
  },
  db: { schema: 'public' },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});

// ✅ Helper pour vérifier la session avant chaque requête critique
export const getSessionUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
};

// ✅ Helper upload avec retry
export const uploadFichier = async (bucket, path, file, options = {}) => {
  for (let i = 0; i < 3; i++) {
    try {
      const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, ...options });
      if (!error) return data;
      if (i === 2) throw error;
    } catch (e) {
      if (i === 2) throw e;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
};