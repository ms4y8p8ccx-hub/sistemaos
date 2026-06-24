import { z } from "zod";
import type { TipoNotificacao } from "@/types";

export const schemaNotificacao = z.object({
  user_id: z.string().uuid("Selecione o usuario."),
  tipo: z.enum(["info", "sucesso", "alerta", "erro"]).default("info"),
  titulo: z.string().trim().min(3, "Informe o titulo."),
  mensagem: z.string().trim().min(5, "Informe a mensagem."),
  link: z
    .string()
    .trim()
    .optional()
    .transform((valor) => (valor ? valor : undefined))
});

export type DadosNotificacao = z.infer<typeof schemaNotificacao>;

export function normalizarNotificacao(dados: DadosNotificacao): {
  user_id: string;
  tipo: TipoNotificacao;
  titulo: string;
  mensagem: string;
  link: string | null;
} {
  return {
    user_id: dados.user_id,
    tipo: dados.tipo,
    titulo: dados.titulo,
    mensagem: dados.mensagem,
    link: dados.link ?? null
  };
}
