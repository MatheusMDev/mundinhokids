import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Cliente do Supabase. Fica nulo enquanto .env.local não tiver URL e chave:
 * nesse caso o app abre em modo demonstração, com os dados de exemplo.
 */
export const supabase: SupabaseClient | null = url && chave ? createClient(url, chave) : null;

export const modoDemo = !supabase;
