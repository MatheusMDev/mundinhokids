import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Cliente do Supabase. Nulo enquanto o .env.local não tiver URL e chave. */
export const supabase: SupabaseClient | null = url && chave ? createClient(url, chave) : null;

/**
 * Sai só neste aparelho (sair no computador não derruba o login do celular).
 * Se a sessão já tinha acabado no servidor, a biblioteca recusa sair e deixa o
 * login antigo guardado: aí limpamos o que ficou no navegador e recarregamos.
 */
export async function sairDesteAparelho(c: SupabaseClient) {
  const { error } = await c.auth.signOut({ scope: 'local' });
  if (!error) return;
  Object.keys(localStorage).filter((k) => k.startsWith('sb-') && k.endsWith('-auth-token')).forEach((k) => localStorage.removeItem(k));
  window.location.reload();
}
