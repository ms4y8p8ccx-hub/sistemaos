import { NextResponse } from "next/server";
import { obterUsuarioDaRequisicao } from "@/lib/auth/servidor";
import { podeGerenciarFinanceiro } from "@/lib/auth/permissoes";
import {
  camposLancamentoFinanceiro,
  obterLancamentoPorId
} from "@/lib/financeiro/dados";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/server";
import {
  normalizarLancamentoFinanceiro,
  schemaLancamentoFinanceiro
} from "@/lib/validations/financeiro";
import type { LancamentoFinanceiro } from "@/types";

type Parametros = {
  params: {
    id: string;
  };
};

export async function PATCH(
  request: Request,
  { params }: Parametros
): Promise<Response> {
  try {
    const resultado = await obterUsuarioDaRequisicao(request);

    if (!resultado.ok) {
      return NextResponse.json(
        { mensagem: resultado.mensagem },
        { status: resultado.status }
      );
    }

    const perfil = resultado.usuarioAplicacao.role?.perfil;

    if (!perfil || !podeGerenciarFinanceiro(perfil)) {
      return NextResponse.json(
        { mensagem: "Voce nao tem permissao para alterar lancamentos." },
        { status: 403 }
      );
    }

    const supabase = criarClienteSupabaseAdmin();
    const anterior = await obterLancamentoPorId(supabase, params.id);

    if (!anterior) {
      return NextResponse.json(
        { mensagem: "Lancamento nao encontrado." },
        { status: 404 }
      );
    }

    const corpo = await request.json();
    const dados = schemaLancamentoFinanceiro.safeParse(corpo);

    if (!dados.success) {
      return NextResponse.json(
        {
          mensagem: "Revise os dados do lancamento.",
          erros: dados.error.flatten().fieldErrors
        },
        { status: 422 }
      );
    }

    const { data, error } = await supabase
      .from("financeiro_lancamentos")
      .update(normalizarLancamentoFinanceiro(dados.data))
      .eq("id", params.id)
      .select(camposLancamentoFinanceiro)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { mensagem: error?.message ?? "Nao foi possivel alterar lancamento." },
        { status: 400 }
      );
    }

    const lancamento = data as unknown as LancamentoFinanceiro;

    await supabase.from("auditoria").insert({
      user_id: resultado.usuarioAplicacao.id,
      acao: "alterou_lancamento_financeiro",
      entidade: "financeiro_lancamentos",
      entidade_id: lancamento.id,
      dados_anteriores: anterior,
      dados_novos: lancamento
    });

    return NextResponse.json({ lancamento });
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Nao foi possivel alterar lancamento.";

    return NextResponse.json({ mensagem }, { status: 503 });
  }
}

export async function DELETE(
  request: Request,
  { params }: Parametros
): Promise<Response> {
  try {
    const resultado = await obterUsuarioDaRequisicao(request);

    if (!resultado.ok) {
      return NextResponse.json(
        { mensagem: resultado.mensagem },
        { status: resultado.status }
      );
    }

    const perfil = resultado.usuarioAplicacao.role?.perfil;

    if (!perfil || !podeGerenciarFinanceiro(perfil)) {
      return NextResponse.json(
        { mensagem: "Voce nao tem permissao para cancelar lancamentos." },
        { status: 403 }
      );
    }

    const supabase = criarClienteSupabaseAdmin();
    const anterior = await obterLancamentoPorId(supabase, params.id);

    if (!anterior) {
      return NextResponse.json(
        { mensagem: "Lancamento nao encontrado." },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from("financeiro_lancamentos")
      .update({ status: "cancelado" })
      .eq("id", params.id)
      .select(camposLancamentoFinanceiro)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { mensagem: error?.message ?? "Nao foi possivel cancelar lancamento." },
        { status: 400 }
      );
    }

    const lancamento = data as unknown as LancamentoFinanceiro;

    await supabase.from("auditoria").insert({
      user_id: resultado.usuarioAplicacao.id,
      acao: "cancelou_lancamento_financeiro",
      entidade: "financeiro_lancamentos",
      entidade_id: lancamento.id,
      dados_anteriores: anterior,
      dados_novos: lancamento
    });

    return NextResponse.json({ lancamento });
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Nao foi possivel cancelar lancamento.";

    return NextResponse.json({ mensagem }, { status: 503 });
  }
}
