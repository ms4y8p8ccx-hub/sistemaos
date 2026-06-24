import type { SupabaseClient } from "@supabase/supabase-js";
import type { LancamentoFinanceiro } from "@/types";

export const camposLancamentoFinanceiro = [
  "id",
  "ordem_servico_id",
  "cliente_id",
  "fornecedor_id",
  "tipo",
  "status",
  "categoria",
  "descricao",
  "valor",
  "data_vencimento",
  "data_pagamento",
  "metodo_pagamento",
  "observacao",
  "criado_em",
  "atualizado_em",
  "ordem_servico:ordens_servico(id, numero, valor_total)",
  "cliente:clientes(id, nome)",
  "fornecedor:fornecedores(id, nome)"
].join(", ");

export async function obterLancamentoPorId(
  supabase: SupabaseClient,
  id: string
): Promise<LancamentoFinanceiro | null> {
  const { data, error } = await supabase
    .from("financeiro_lancamentos")
    .select(camposLancamentoFinanceiro)
    .eq("id", id)
    .single();

  if (error || !data) {
    return null;
  }

  return data as unknown as LancamentoFinanceiro;
}

export function calcularResumoFinanceiro(lancamentos: LancamentoFinanceiro[]): {
  receitasPendentes: number;
  receitasPagas: number;
  despesasPendentes: number;
  despesasPagas: number;
  saldoRealizado: number;
  saldoPrevisto: number;
} {
  return lancamentos.reduce(
    (resumo, lancamento) => {
      if (lancamento.status === "cancelado") {
        return resumo;
      }

      const valor = Number(lancamento.valor);
      const ehReceita = lancamento.tipo === "receita";
      const ehPago = lancamento.status === "pago";

      if (ehReceita && ehPago) resumo.receitasPagas += valor;
      if (ehReceita && !ehPago) resumo.receitasPendentes += valor;
      if (!ehReceita && ehPago) resumo.despesasPagas += valor;
      if (!ehReceita && !ehPago) resumo.despesasPendentes += valor;

      resumo.saldoRealizado = resumo.receitasPagas - resumo.despesasPagas;
      resumo.saldoPrevisto =
        resumo.receitasPagas +
        resumo.receitasPendentes -
        resumo.despesasPagas -
        resumo.despesasPendentes;

      return resumo;
    },
    {
      receitasPendentes: 0,
      receitasPagas: 0,
      despesasPendentes: 0,
      despesasPagas: 0,
      saldoRealizado: 0,
      saldoPrevisto: 0
    }
  );
}
