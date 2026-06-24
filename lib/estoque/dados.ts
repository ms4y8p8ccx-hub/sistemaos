import type { SupabaseClient } from "@supabase/supabase-js";
import type { Produto, TipoMovimentacaoEstoque } from "@/types";

export const camposFornecedor = [
  "id",
  "tipo",
  "nome",
  "documento",
  "email",
  "telefone",
  "contato_responsavel",
  "endereco_cidade",
  "endereco_estado",
  "observacoes",
  "ativo",
  "criado_em",
  "atualizado_em"
].join(", ");

export const camposProduto = [
  "id",
  "fornecedor_id",
  "codigo_sku",
  "nome",
  "descricao",
  "unidade_medida",
  "estoque_atual",
  "estoque_minimo",
  "preco_custo",
  "preco_venda",
  "localizacao_estoque",
  "ativo",
  "criado_em",
  "atualizado_em",
  "fornecedor:fornecedores(id, nome)"
].join(", ");

export const camposMovimentacaoEstoque = [
  "id",
  "produto_id",
  "ordem_servico_id",
  "tipo",
  "quantidade",
  "custo_unitario",
  "observacao",
  "criado_em",
  "atualizado_em",
  "produto:produtos(id, codigo_sku, nome)"
].join(", ");

export async function obterProdutoPorId(
  supabase: SupabaseClient,
  produtoId: string
): Promise<Produto | null> {
  const { data, error } = await supabase
    .from("produtos")
    .select(camposProduto)
    .eq("id", produtoId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as unknown as Produto;
}

export function calcularNovoSaldoEstoque(
  saldoAtual: number,
  tipo: TipoMovimentacaoEstoque,
  quantidade: number
): number {
  if (tipo === "ajuste") {
    return quantidade;
  }

  if (tipo === "entrada" || tipo === "devolucao") {
    return saldoAtual + quantidade;
  }

  return saldoAtual - quantidade;
}
