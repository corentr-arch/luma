import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jsvnuvjntlxalbdufgbu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impzdm51dmpudGx4YWxiZHVmZ2J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NzA1OTUsImV4cCI6MjA5NjE0NjU5NX0.LAHyyvzwOH4GOjJdoiQDM4u7CGtcsc5zXbA5jOMVnTQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);