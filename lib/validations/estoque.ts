import { z } from "zod";
import { limparTextoOpcional } from "@/lib/validations/clientes";

const textoOpcional = z.string().trim().max(255).optional().or(z.literal(""));

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

export const schemaFornecedor = z.object({
  tipo: z.enum(["fisica", "juridica"]),
  nome: z.string().trim().min(3, "Informe o nome do fornecedor.").max(255),
  documento: textoOpcional,
  email: z
    .string()
    .trim()
    .email("Informe um e-mail valido.")
    .optional()
    .or(z.literal("")),
  telefone: textoOpcional,
  contato_responsavel: textoOpcional,
  endereco_cidade: textoOpcional,
  endereco_estado: z
    .string()
    .trim()
    .length(2, "Use a sigla do estado.")
    .optional()
    .or(z.literal("")),
  observacoes: z.string().trim().max(2000).optional().or(z.literal("")),
  ativo: z.boolean().optional()
});

export const schemaProduto = z.object({
  fornecedor_id: z.string().uuid().optional().or(z.literal("")),
  codigo_sku: z.string().trim().min(2, "Informe o codigo SKU.").max(120),
  nome: z.string().trim().min(3, "Informe o nome do produto.").max(255),
  descricao: z.string().trim().max(2000).optional().or(z.literal("")),
  unidade_medida: z.string().trim().min(1).max(20),
  estoque_atual: z.preprocess(numeroOpcional, z.number().min(0).optional()),
  estoque_minimo: z.preprocess(numeroOpcional, z.number().min(0).optional()),
  preco_custo: z.preprocess(numeroOpcional, z.number().min(0).optional()),
  preco_venda: z.preprocess(numeroOpcional, z.number().min(0).optional()),
  localizacao_estoque: textoOpcional,
  ativo: z.boolean().optional()
});

export const schemaMovimentacaoEstoque = z.object({
  produto_id: z.string().uuid("Selecione um produto valido."),
  tipo: z.enum(["entrada", "saida", "ajuste", "reserva", "devolucao"]),
  quantidade: z.preprocess(numeroOpcional, z.number().min(0.001)),
  custo_unitario: z.preprocess(numeroOpcional, z.number().min(0).optional()),
  observacao: z.string().trim().max(1000).optional().or(z.literal(""))
});

export type DadosFornecedor = z.infer<typeof schemaFornecedor>;
export type DadosProduto = z.infer<typeof schemaProduto>;
export type DadosMovimentacaoEstoque = z.infer<
  typeof schemaMovimentacaoEstoque
>;

export function normalizarFornecedor(
  dados: DadosFornecedor
): Record<string, unknown> {
  return {
    tipo: dados.tipo,
    nome: dados.nome.trim(),
    documento: limparTextoOpcional(dados.documento),
    email: limparTextoOpcional(dados.email),
    telefone: limparTextoOpcional(dados.telefone),
    contato_responsavel: limparTextoOpcional(dados.contato_responsavel),
    endereco_cidade: limparTextoOpcional(dados.endereco_cidade),
    endereco_estado: limparTextoOpcional(dados.endereco_estado)?.toUpperCase() ?? null,
    observacoes: limparTextoOpcional(dados.observacoes),
    ativo: dados.ativo ?? true
  };
}

export function normalizarProduto(dados: DadosProduto): Record<string, unknown> {
  return {
    fornecedor_id: limparTextoOpcional(dados.fornecedor_id) ?? null,
    codigo_sku: dados.codigo_sku.trim(),
    nome: dados.nome.trim(),
    descricao: limparTextoOpcional(dados.descricao),
    unidade_medida: dados.unidade_medida.trim(),
    estoque_atual: dados.estoque_atual ?? 0,
    estoque_minimo: dados.estoque_minimo ?? 0,
    preco_custo: dados.preco_custo ?? 0,
    preco_venda: dados.preco_venda ?? 0,
    localizacao_estoque: limparTextoOpcional(dados.localizacao_estoque),
    ativo: dados.ativo ?? true
  };
}

export function normalizarMovimentacaoEstoque(
  dados: DadosMovimentacaoEstoque
): Record<string, unknown> {
  return {
    produto_id: dados.produto_id,
    tipo: dados.tipo,
    quantidade: dados.quantidade,
    custo_unitario: dados.custo_unitario ?? null,
    observacao: limparTextoOpcional(dados.observacao)
  };
}
