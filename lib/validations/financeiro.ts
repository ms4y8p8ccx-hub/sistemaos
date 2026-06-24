import { z } from "zod";
import type {
  StatusLancamentoFinanceiro,
  TipoLancamentoFinanceiro
} from "@/types";

const textoOpcional = z
  .string()
  .trim()
  .optional()
  .transform((valor) => (valor ? valor : undefined));

const uuidOpcional = z
  .string()
  .trim()
  .optional()
  .transform((valor) => (valor ? valor : undefined));

const dataOpcional = z
  .string()
  .trim()
  .optional()
  .transform((valor) => (valor ? valor : undefined));

export const schemaLancamentoFinanceiro = z
  .object({
    ordem_servico_id: uuidOpcional,
    cliente_id: uuidOpcional,
    fornecedor_id: uuidOpcional,
    tipo: z.enum(["receita", "despesa"]),
    status: z.enum(["pendente", "pago", "cancelado"]).default("pendente"),
    categoria: z.string().trim().min(2, "Informe a categoria."),
    descricao: z.string().trim().min(3, "Informe a descricao."),
    valor: z.coerce.number().positive("O valor precisa ser maior que zero."),
    data_vencimento: dataOpcional,
    data_pagamento: dataOpcional,
    metodo_pagamento: textoOpcional,
    observacao: textoOpcional
  })
  .superRefine((dados, contexto) => {
    if (dados.tipo === "receita" && !dados.cliente_id && !dados.ordem_servico_id) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Receitas precisam de cliente ou OS vinculada.",
        path: ["cliente_id"]
      });
    }

    if (dados.tipo === "despesa" && !dados.fornecedor_id && !dados.observacao) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Despesas precisam de fornecedor ou observacao.",
        path: ["fornecedor_id"]
      });
    }

    if (dados.status === "pago" && !dados.data_pagamento) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe a data de pagamento.",
        path: ["data_pagamento"]
      });
    }
  });

export const schemaBaixaLancamentoFinanceiro = z.object({
  data_pagamento: z.string().trim().min(10, "Informe a data de pagamento."),
  metodo_pagamento: z.string().trim().min(2, "Informe o metodo de pagamento.")
});

export const schemaStatusLancamentoFinanceiro = z.object({
  status: z.enum(["pendente", "pago", "cancelado"]),
  observacao: textoOpcional
});

export type DadosLancamentoFinanceiro = z.infer<
  typeof schemaLancamentoFinanceiro
>;

function valorOuNull(valor?: string): string | null {
  return valor ? valor : null;
}

export function normalizarLancamentoFinanceiro(
  dados: DadosLancamentoFinanceiro
): {
  ordem_servico_id: string | null;
  cliente_id: string | null;
  fornecedor_id: string | null;
  tipo: TipoLancamentoFinanceiro;
  status: StatusLancamentoFinanceiro;
  categoria: string;
  descricao: string;
  valor: number;
  data_vencimento: string | null;
  data_pagamento: string | null;
  metodo_pagamento: string | null;
  observacao: string | null;
} {
  return {
    ordem_servico_id: valorOuNull(dados.ordem_servico_id),
    cliente_id: valorOuNull(dados.cliente_id),
    fornecedor_id: valorOuNull(dados.fornecedor_id),
    tipo: dados.tipo,
    status: dados.status,
    categoria: dados.categoria,
    descricao: dados.descricao,
    valor: dados.valor,
    data_vencimento: valorOuNull(dados.data_vencimento),
    data_pagamento: valorOuNull(dados.data_pagamento),
    metodo_pagamento: valorOuNull(dados.metodo_pagamento),
    observacao: valorOuNull(dados.observacao)
  };
}
