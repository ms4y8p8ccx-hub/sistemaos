import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { exigirConfiguracaoSupabase } from "@/lib/env";

export function criarClienteSupabaseServidor(): SupabaseClient {
  const configuracao = exigirConfiguracaoSupabase();

  return createClient(configuracao.url, configuracao.chaveAnonima, {
    auth: {
      persistSession: false
    }
  });
}

export function criarClienteSupabaseAdmin(): SupabaseClient {
  const configuracao = exigirConfiguracaoSupabase();

  if (!configuracao.chaveServico) {
    throw new Error("Chave service role do Supabase nao foi configurada.");
  }

  return createClient(configuracao.url, configuracao.chaveServico, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
