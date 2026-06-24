import { NextResponse } from "next/server";
import { obterUsuarioDaRequisicao } from "@/lib/auth/servidor";
import { podeVerRelatorios } from "@/lib/auth/permissoes";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/server";
import type {
  Auditoria,
  LancamentoFinanceiro,
  OrdemServico,
  Produto
} from "@/types";

export async function GET(request: Request): Promise<Response> {
  try {
    const resultado = await obterUsuarioDaRequisicao(request);

    if (!resultado.ok) {
      return NextResponse.json(
        { mensagem: resultado.mensagem },
        { status: resultado.status }
      );
    }

    const perfil = resultado.usuarioAplicacao.role?.perfil;

    if (!perfil || !podeVerRelatorios(perfil)) {
      return NextResponse.json(
        { mensagem: "Voce nao tem permissao para consultar relatorios." },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const inicio = url.searchParams.get("inicio")?.trim();
    const fim = url.searchParams.get("fim")?.trim();
    const supabase = criarClienteSupabaseAdmin();

    let consultaOrdens = supabase
      .from("ordens_servico")
      .select("id, numero, cliente_id, equipamento_id, status, prioridade, tecnico_responsavel_user_id, relato_cliente, diagnostico, solucao, observacoes_internas, valor_mao_obra, valor_pecas, desconto, valor_total, aberta_em, prevista_para, concluida_em, entregue_em, criado_em, atualizado_em, cliente:clientes(id, nome, documento), equipamento:equipamentos(id, tipo, marca, modelo, numero_serie)")
      .order("aberta_em", { ascending: false });

    if (inicio) {
      consultaOrdens = consultaOrdens.gte("aberta_em", `${inicio}T00:00:00`);
    }

    if (fim) {
      consultaOrdens = consultaOrdens.lte("aberta_em", `${fim}T23:59:59`);
    }

    let consultaFinanceiro = supabase
      .from("financeiro_lancamentos")
      .select("id, ordem_servico_id, cliente_id, fornecedor_id, tipo, status, categoria, descricao, valor, data_vencimento, data_pagamento, metodo_pagamento, observacao, criado_em, atualizado_em, cliente:clientes(id, nome), fornecedor:fornecedores(id, nome), ordem_servico:ordens_servico(id, numero, valor_total)")
      .order("data_vencimento", { ascending: true });

    if (inicio) {
      consultaFinanceiro = consultaFinanceiro.gte("data_vencimento", inicio);
    }

    if (fim) {
      consultaFinanceiro = consultaFinanceiro.lte("data_vencimento", fim);
    }

    const [ordens, financeiro, produtos, auditoria] = await Promise.all([
      consultaOrdens.limit(500),
      consultaFinanceiro.limit(500),
      supabase
        .from("produtos")
        .select("id, fornecedor_id, codigo_sku, nome, descricao, unidade_medida, estoque_atual, estoque_minimo, preco_custo, preco_venda, localizacao_estoque, ativo, criado_em, atualizado_em, fornecedor:fornecedores(id, nome)")
        .eq("ativo", true)
        .order("nome", { ascending: true }),
      supabase
        .from("auditoria")
        .select("id, user_id, acao, entidade, entidade_id, criado_em, user:users(id, nome, email)")
        .order("criado_em", { ascending: false })
        .limit(50)
    ]);

    if (
      ordens.error ||
      financeiro.error ||
      produtos.error ||
      auditoria.error
    ) {
      return NextResponse.json(
        { mensagem: "Nao foi possivel carregar relatorio." },
        { status: 500 }
      );
    }

    const ordensServico = (ordens.data ?? []) as unknown as OrdemServico[];
    const lancamentos = (financeiro.data ?? []) as unknown as LancamentoFinanceiro[];
    const produtosEstoque = (produtos.data ?? []) as unknown as Produto[];

    return NextResponse.json({
      ordens: ordensServico,
      lancamentos,
      produtosCriticos: produtosEstoque.filter(
        (produto) => produto.estoque_atual <= produto.estoque_minimo
      ),
      auditoria: (auditoria.data ?? []) as unknown as Auditoria[],
      resumo: {
        osTotal: ordensServico.length,
        osAbertas: ordensServico.filter(
          (ordem) =>
            !["concluida", "entregue", "cancelada"].includes(ordem.status)
        ).length,
        osFechadas: ordensServico.filter(
          (ordem) => ordem.status === "concluida" || ordem.status === "entregue"
        ).length,
        receitas: somar(lancamentos, "receita"),
        despesas: somar(lancamentos, "despesa"),
        produtosCriticos: produtosEstoque.filter(
          (produto) => produto.estoque_atual <= produto.estoque_minimo
        ).length
      }
    });
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Nao foi possivel carregar relatorio.";

    return NextResponse.json({ mensagem }, { status: 503 });
  }
}

function somar(
  lancamentos: LancamentoFinanceiro[],
  tipo: "receita" | "despesa"
): number {
  return lancamentos
    .filter(
      (lancamento) =>
        lancamento.tipo === tipo && lancamento.status !== "cancelado"
    )
    .reduce((total, lancamento) => total + Number(lancamento.valor), 0);
}
