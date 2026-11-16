import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY (copiá .env.example a .env).');
}

/** Cliente único. La sesión queda guardada en el dispositivo (persistSession). */
export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
});
