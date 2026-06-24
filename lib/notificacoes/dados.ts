import type { SupabaseClient } from "@supabase/supabase-js";
import type { TipoNotificacao } from "@/types";

export const camposNotificacao = [
  "id",
  "user_id",
  "tipo",
  "titulo",
  "mensagem",
  "link",
  "lida_em",
  "criado_em",
  "atualizado_em"
].join(", ");

export async function criarNotificacaoSistema(
  supabase: SupabaseClient,
  dados: {
    userId: string;
    tipo?: TipoNotificacao;
    titulo: string;
    mensagem: string;
    link?: string | null;
  }
): Promise<void> {
  await supabase.from("notificacoes").insert({
    user_id: dados.userId,
    tipo: dados.tipo ?? "info",
    titulo: dados.titulo,
    mensagem: dados.mensagem,
    link: dados.link ?? null
  });
}
