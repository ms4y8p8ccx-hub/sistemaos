import { NextResponse } from "next/server";
import { obterUsuarioDaRequisicao } from "@/lib/auth/servidor";
import { podeGerenciarFinanceiro } from "@/lib/auth/permissoes";
import {
  camposLancamentoFinanceiro,
  obterLancamentoPorId
} from "@/lib/financeiro/dados";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/server";
import { schemaBaixaLancamentoFinanceiro } from "@/lib/validations/financeiro";
import type { LancamentoFinanceiro } from "@/types";

type Parametros = {
  params: {
    id: string;
  };
};

export async function POST(
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
        { mensagem: "Voce nao tem permissao para baixar lancamentos." },
        { status: 403 }
      );
    }

    const corpo = await request.json();
    const dados = schemaBaixaLancamentoFinanceiro.safeParse(corpo);

    if (!dados.success) {
      return NextResponse.json(
        {
          mensagem: "Revise os dados da baixa.",
          erros: dados.error.flatten().fieldErrors
        },
        { status: 422 }
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

    if (anterior.status === "cancelado") {
      return NextResponse.json(
        { mensagem: "Lancamento cancelado nao pode ser baixado." },
        { status: 422 }
      );
    }

    const { data, error } = await supabase
      .from("financeiro_lancamentos")
      .update({
        status: "pago",
        data_pagamento: dados.data.data_pagamento,
        metodo_pagamento: dados.data.metodo_pagamento
      })
      .eq("id", params.id)
      .select(camposLancamentoFinanceiro)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { mensagem: error?.message ?? "Nao foi possivel baixar lancamento." },
        { status: 400 }
      );
    }

    const lancamento = data as unknown as LancamentoFinanceiro;

    await supabase.from("auditoria").insert({
      user_id: resultado.usuarioAplicacao.id,
      acao: "baixou_lancamento_financeiro",
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
        : "Nao foi possivel baixar lancamento.";

    return NextResponse.json({ mensagem }, { status: 503 });
  }
}
