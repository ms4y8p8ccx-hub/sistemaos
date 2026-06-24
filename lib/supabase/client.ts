import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { exigirConfiguracaoSupabase } from "@/lib/env";

export function criarClienteSupabase(): SupabaseClient {
  const configuracao = exigirConfiguracaoSupabase();

  return createClient(configuracao.url, configuracao.chaveAnonima);
}
