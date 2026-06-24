import { NextResponse } from "next/server";
import { obterUsuarioDaRequisicao } from "@/lib/auth/servidor";
import { podeGerenciarEstoque, podeVerEstoque } from "@/lib/auth/permissoes";
import {
  calcularNovoSaldoEstoque,
  camposMovimentacaoEstoque,
  camposProduto,
  obterProdutoPorId
} from "@/lib/estoque/dados";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/server";
import {
  normalizarMovimentacaoEstoque,
  schemaMovimentacaoEstoque
} from "@/lib/validations/estoque";
import type { MovimentacaoEstoque, Produto } from "@/types";

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

    if (!perfil || !podeVerEstoque(perfil)) {
      return NextResponse.json(
        { mensagem: "Voce nao tem permissao para listar movimentacoes." },
        { status: 403 }
      );
    }

    const supabase = criarClienteSupabaseAdmin();
    const { data, error } = await supabase
      .from("movimentacoes_estoque")
      .select(camposMovimentacaoEstoque)
      .order("criado_em", { ascending: false })
      .limit(80);

    if (error) {
      return NextResponse.json(
        { mensagem: "Nao foi possivel listar movimentacoes." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      movimentacoes: (data ?? []) as unknown as MovimentacaoEstoque[]
    });
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Nao foi possivel carregar movimentacoes.";

    return NextResponse.json({ mensagem }, { status: 503 });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const resultado = await obterUsuarioDaRequisicao(request);

    if (!resultado.ok) {
      return NextResponse.json(
        { mensagem: resultado.mensagem },
        { status: resultado.status }
      );
    }

    const perfil = resultado.usuarioAplicacao.role?.perfil;

    if (!perfil || !podeGerenciarEstoque(perfil)) {
      return NextResponse.json(
        { mensagem: "Voce nao tem permissao para movimentar estoque." },
        { status: 403 }
      );
    }

    const corpo = await request.json();
    const dados = schemaMovimentacaoEstoque.safeParse(corpo);

    if (!dados.success) {
      return NextResponse.json(
        {
          mensagem: "Revise os dados da movimentacao.",
          erros: dados.error.flatten().fieldErrors
        },
        { status: 422 }
      );
    }

    const supabase = criarClienteSupabaseAdmin();
    const produtoAnterior = await obterProdutoPorId(
      supabase,
      dados.data.produto_id
    );

    if (!produtoAnterior || !produtoAnterior.ativo) {
      return NextResponse.json(
        { mensagem: "Produto selecionado nao existe ou esta inativo." },
        { status: 422 }
      );
    }

    const novoSaldo = calcularNovoSaldoEstoque(
      Number(produtoAnterior.estoque_atual),
      dados.data.tipo,
      dados.data.quantidade
    );

    if (novoSaldo < 0) {
      return NextResponse.json(
        { mensagem: "Saldo insuficiente para esta movimentacao." },
        { status: 422 }
      );
    }

    const { data: movimentacao, error } = await supabase
      .from("movimentacoes_estoque")
      .insert({
        ...normalizarMovimentacaoEstoque(dados.data),
        user_id: resultado.usuarioAplicacao.id
      })
      .select(camposMovimentacaoEstoque)
      .single();

    if (error || !movimentacao) {
      return NextResponse.json(
        {
          mensagem:
            error?.message ?? "Nao foi possivel registrar a movimentacao."
        },
        { status: 400 }
      );
    }

    const { data: produtoAtualizado } = await supabase
      .from("produtos")
      .update({ estoque_atual: novoSaldo })
      .eq("id", produtoAnterior.id)
      .select(camposProduto)
      .single();

    const movimentacaoCriada =
      movimentacao as unknown as MovimentacaoEstoque;

    await supabase.from("auditoria").insert({
      user_id: resultado.usuarioAplicacao.id,
      acao: "registrou_movimentacao_estoque",
      entidade: "movimentacoes_estoque",
      entidade_id: movimentacaoCriada.id,
      dados_anteriores: produtoAnterior,
      dados_novos: {
        movimentacao: movimentacaoCriada,
        produto: produtoAtualizado as unknown as Produto | null
      }
    });

    return NextResponse.json(
      {
        movimentacao: movimentacaoCriada,
        produto: produtoAtualizado as unknown as Produto | null
      },
      { status: 201 }
    );
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Nao foi possivel registrar a movimentacao.";

    return NextResponse.json({ mensagem }, { status: 503 });
  }
}
