import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Cliente do Supabase. Nulo enquanto o .env.local não tiver URL e chave. */
export const supabase: SupabaseClient | null = url && chave ? createClient(url, chave) : null;
