import { NextResponse } from "next/server";
import { obterUsuarioDaRequisicao } from "@/lib/auth/servidor";
import {
  podeVerClientes,
  podeVerEquipamentos,
  podeVerEstoque,
  podeVerFinanceiro,
  podeVerOrdensServico
} from "@/lib/auth/permissoes";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/server";
import type {
  LancamentoFinanceiro,
  OrdemServico,
  Produto,
  StatusOrdemServico
} from "@/types";

type ResumoDashboard = {
  clientes: number;
  equipamentos: number;
  produtosCriticos: number;
  ordensAbertas: number;
  ordensConcluidas: number;
  receitasPendentes: number;
  despesasPendentes: number;
  saldoRealizado: number;
  osPorStatus: Array<{ status: StatusOrdemServico; total: number }>;
  produtosCriticosLista: Produto[];
  ordensRecentes: OrdemServico[];
};

const resumoVazio: ResumoDashboard = {
  clientes: 0,
  equipamentos: 0,
  produtosCriticos: 0,
  ordensAbertas: 0,
  ordensConcluidas: 0,
  receitasPendentes: 0,
  despesasPendentes: 0,
  saldoRealizado: 0,
  osPorStatus: [],
  produtosCriticosLista: [],
  ordensRecentes: []
};

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

    if (!perfil) {
      return NextResponse.json(
        { mensagem: "Usuario sem perfil." },
        { status: 403 }
      );
    }

    const supabase = criarClienteSupabaseAdmin();
    const resumo = { ...resumoVazio };

    if (podeVerClientes(perfil)) {
      const { count } = await supabase
        .from("clientes")
        .select("id", { count: "exact", head: true })
        .eq("ativo", true);

      resumo.clientes = count ?? 0;
    }

    if (podeVerEquipamentos(perfil)) {
      const { count } = await supabase
        .from("equipamentos")
        .select("id", { count: "exact", head: true })
        .eq("ativo", true);

      resumo.equipamentos = count ?? 0;
    }

    if (podeVerOrdensServico(perfil)) {
      let consultaOrdens = supabase
        .from("ordens_servico")
        .select("id, numero, cliente_id, equipamento_id, status, prioridade, tecnico_responsavel_user_id, relato_cliente, diagnostico, solucao, observacoes_internas, valor_mao_obra, valor_pecas, desconto, valor_total, aberta_em, prevista_para, concluida_em, entregue_em, criado_em, atualizado_em, cliente:clientes(id, nome, documento), equipamento:equipamentos(id, tipo, marca, modelo, numero_serie)")
        .order("aberta_em", { ascending: false });

      if (perfil === "tecnico") {
        consultaOrdens = consultaOrdens.eq(
          "tecnico_responsavel_user_id",
          resultado.usuarioAplicacao.id
        );
      }

      const { data } = await consultaOrdens.limit(120);
      const ordens = (data ?? []) as unknown as OrdemServico[];

      resumo.ordensAbertas = ordens.filter(
        (ordem) => !["concluida", "entregue", "cancelada"].includes(ordem.status)
      ).length;
      resumo.ordensConcluidas = ordens.filter(
        (ordem) => ordem.status === "concluida" || ordem.status === "entregue"
      ).length;
      resumo.ordensRecentes = ordens.slice(0, 8);
      resumo.osPorStatus = Object.entries(
        ordens.reduce<Record<string, number>>((acumulado, ordem) => {
          acumulado[ordem.status] = (acumulado[ordem.status] ?? 0) + 1;
          return acumulado;
        }, {})
      ).map(([status, total]) => ({
        status: status as StatusOrdemServico,
        total
      }));
    }

    if (podeVerEstoque(perfil)) {
      const { data } = await supabase
        .from("produtos")
        .select("id, fornecedor_id, codigo_sku, nome, descricao, unidade_medida, estoque_atual, estoque_minimo, preco_custo, preco_venda, localizacao_estoque, ativo, criado_em, atualizado_em, fornecedor:fornecedores(id, nome)")
        .eq("ativo", true)
        .order("nome", { ascending: true });

      const produtos = (data ?? []) as unknown as Produto[];
      const criticos = produtos.filter(
        (produto) => produto.estoque_atual <= produto.estoque_minimo
      );

      resumo.produtosCriticos = criticos.length;
      resumo.produtosCriticosLista = criticos.slice(0, 8);
    }

    if (podeVerFinanceiro(perfil)) {
      const { data } = await supabase
        .from("financeiro_lancamentos")
        .select("id, ordem_servico_id, cliente_id, fornecedor_id, tipo, status, categoria, descricao, valor, data_vencimento, data_pagamento, metodo_pagamento, observacao, criado_em, atualizado_em")
        .neq("status", "cancelado")
        .limit(500);

      const lancamentos = (data ?? []) as unknown as LancamentoFinanceiro[];

      resumo.receitasPendentes = somarLancamentos(
        lancamentos,
        "receita",
        "pendente"
      );
      resumo.despesasPendentes = somarLancamentos(
        lancamentos,
        "despesa",
        "pendente"
      );
      resumo.saldoRealizado =
        somarLancamentos(lancamentos, "receita", "pago") -
        somarLancamentos(lancamentos, "despesa", "pago");
    }

    return NextResponse.json({ resumo });
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Nao foi possivel carregar dashboard.";

    return NextResponse.json({ mensagem }, { status: 503 });
  }
}

function somarLancamentos(
  lancamentos: LancamentoFinanceiro[],
  tipo: "receita" | "despesa",
  status: "pendente" | "pago"
): number {
  return lancamentos
    .filter((lancamento) => lancamento.tipo === tipo && lancamento.status === status)
    .reduce((total, lancamento) => total + Number(lancamento.valor), 0);
}
