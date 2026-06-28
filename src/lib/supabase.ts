import { createClient } from '@supabase/supabase-js';

// Retrieve Supabase environment variables.
// In SvelteKit/Vite, VITE_ prefixed environment variables are available via import.meta.env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) are not set. ' +
    'Please check your .env configuration.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
