"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { exigirConfiguracaoSupabase } from "@/lib/env";

let clienteSupabase: SupabaseClient | null = null;

export function criarClienteSupabaseBrowser(): SupabaseClient {
  if (clienteSupabase) {
    return clienteSupabase;
  }

  const configuracao = exigirConfiguracaoSupabase();

  clienteSupabase = createClient(
    configuracao.url,
    configuracao.chaveAnonima
  );

  return clienteSupabase;
}
