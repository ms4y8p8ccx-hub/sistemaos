import { z } from "zod";
import { limparTextoOpcional } from "@/lib/validations/clientes";
import type { StatusOrdemServico } from "@/types";

function numeroOpcional(valor: unknown): number | undefined {
  if (valor === "" || valor === null || valor === undefined) {
    return undefined;
  }

  if (typeof valor === "string") {
    const numero = Number(valor.replace(",", "."));

    return Number.isFinite(numero) ? numero : undefined;
  }

  return typeof valor === "number" && Number.isFinite(valor)
    ? valor
    : undefined;
}

export const statusOrdensServico: StatusOrdemServico[] = [
  "aberta",
  "em_diagnostico",
  "aguardando_peca",
  "em_execucao",
  "aguardando_aprovacao_cliente",
  "concluida",
  "entregue",
  "cancelada"
];

export const rotulosStatusOrdemServico: Record<StatusOrdemServico, string> = {
  aberta: "Aberta",
  em_diagnostico: "Em diagnostico",
  aguardando_peca: "Aguardando peca",
  em_execucao: "Em execucao",
  aguardando_aprovacao_cliente: "Aguardando aprovacao",
  concluida: "Concluida",
  entregue: "Entregue",
  cancelada: "Cancelada"
};

export const proximoStatusOrdemServico: Partial<
  Record<StatusOrdemServico, StatusOrdemServico>
> = {
  aberta: "em_diagnostico",
  em_diagnostico: "aguardando_peca",
  aguardando_peca: "em_execucao",
  em_execucao: "aguardando_aprovacao_cliente",
  aguardando_aprovacao_cliente: "concluida",
  concluida: "entregue"
};

export const schemaCriarOrdemServico = z.object({
  cliente_id: z.string().uuid("Selecione um cliente valido."),
  equipamento_id: z.string().uuid("Selecione um equipamento valido."),
  prioridade: z.enum(["baixa", "normal", "alta", "urgente"]),
  tecnico_responsavel_user_id: z.string().uuid().optional().or(z.literal("")),
  relato_cliente: z
    .string()
    .trim()
    .min(5, "Descreva o relato do cliente.")
    .max(3000),
  prevista_para: z.string().optional().or(z.literal(""))
});

export const schemaAtualizarOrdemServico = z.object({
  prioridade: z.enum(["baixa", "normal", "alta", "urgente"]),
  tecnico_responsavel_user_id: z.string().uuid().optional().or(z.literal("")),
  relato_cliente: z
    .string()
    .trim()
    .min(5, "Descreva o relato do cliente.")
    .max(3000),
  diagnostico: z.string().trim().max(3000).optional().or(z.literal("")),
  solucao: z.string().trim().max(3000).optional().or(z.literal("")),
  observacoes_internas: z
    .string()
    .trim()
    .max(3000)
    .optional()
    .or(z.literal("")),
  desconto: z.preprocess(numeroOpcional, z.number().min(0).optional()),
  prevista_para: z.string().optional().or(z.literal(""))
});

export const schemaAtualizarStatusOrdemServico = z.object({
  status: z.enum([
    "aberta",
    "em_diagnostico",
    "aguardando_peca",
    "em_execucao",
    "aguardando_aprovacao_cliente",
    "concluida",
    "entregue",
    "cancelada"
  ]),
  observacao: z.string().trim().max(1000).optional().or(z.literal(""))
});

export const schemaItemOrdemServico = z.object({
  tipo: z.enum(["peca", "servico"]),
  descricao: z.string().trim().min(2, "Informe a descricao.").max(255),
  quantidade: z.preprocess(numeroOpcional, z.number().min(0.001)),
  valor_unitario: z.preprocess(numeroOpcional, z.number().min(0))
});

export type DadosCriarOrdemServico = z.infer<typeof schemaCriarOrdemServico>;
export type DadosAtualizarOrdemServico = z.infer<
  typeof schemaAtualizarOrdemServico
>;
export type DadosItemOrdemServico = z.infer<typeof schemaItemOrdemServico>;

export function normalizarCriacaoOrdemServico(
  dados: DadosCriarOrdemServico
): Record<string, unknown> {
  return {
    cliente_id: dados.cliente_id,
    equipamento_id: dados.equipamento_id,
    prioridade: dados.prioridade,
    tecnico_responsavel_user_id:
      limparTextoOpcional(dados.tecnico_responsavel_user_id) ?? null,
    relato_cliente: dados.relato_cliente.trim(),
    prevista_para: limparTextoOpcional(dados.prevista_para)
  };
}

export function normalizarAtualizacaoOrdemServico(
  dados: DadosAtualizarOrdemServico
): Record<string, unknown> {
  return {
    prioridade: dados.prioridade,
    tecnico_responsavel_user_id:
      limparTextoOpcional(dados.tecnico_responsavel_user_id) ?? null,
    relato_cliente: dados.relato_cliente.trim(),
    diagnostico: limparTextoOpcional(dados.diagnostico),
    solucao: limparTextoOpcional(dados.solucao),
    observacoes_internas: limparTextoOpcional(dados.observacoes_internas),
    desconto: dados.desconto ?? 0,
    prevista_para: limparTextoOpcional(dados.prevista_para)
  };
}

export function normalizarItemOrdemServico(
  dados: DadosItemOrdemServico
): Record<string, unknown> {
  return {
    tipo: dados.tipo,
    descricao: dados.descricao.trim(),
    quantidade: dados.quantidade,
    valor_unitario: dados.valor_unitario
  };
}
