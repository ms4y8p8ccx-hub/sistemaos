import { NextResponse } from "next/server";
import { obterUsuarioDaRequisicao } from "@/lib/auth/servidor";
import {
  podeGerenciarFinanceiro,
  podeVerFinanceiro
} from "@/lib/auth/permissoes";
import {
  calcularResumoFinanceiro,
  camposLancamentoFinanceiro
} from "@/lib/financeiro/dados";
import { criarNotificacaoSistema } from "@/lib/notificacoes/dados";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/server";
import {
  normalizarLancamentoFinanceiro,
  schemaLancamentoFinanceiro
} from "@/lib/validations/financeiro";
import type { LancamentoFinanceiro } from "@/types";

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

    if (!perfil || !podeVerFinanceiro(perfil)) {
      return NextResponse.json(
        { mensagem: "Voce nao tem permissao para listar lancamentos." },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const status = url.searchParams.get("status")?.trim();
    const tipo = url.searchParams.get("tipo")?.trim();
    const inicio = url.searchParams.get("inicio")?.trim();
    const fim = url.searchParams.get("fim")?.trim();
    const busca = url.searchParams.get("busca")?.trim();
    const supabase = criarClienteSupabaseAdmin();

    let consulta = supabase
      .from("financeiro_lancamentos")
      .select(camposLancamentoFinanceiro)
      .order("data_vencimento", { ascending: true, nullsFirst: false })
      .order("criado_em", { ascending: false });

    if (status && status !== "todos") {
      consulta = consulta.eq("status", status);
    }

    if (tipo && tipo !== "todos") {
      consulta = consulta.eq("tipo", tipo);
    }

    if (inicio) {
      consulta = consulta.gte("data_vencimento", inicio);
    }

    if (fim) {
      consulta = consulta.lte("data_vencimento", fim);
    }

    if (busca) {
      consulta = consulta.or(
        `descricao.ilike.%${busca}%,categoria.ilike.%${busca}%,observacao.ilike.%${busca}%`
      );
    }

    const { data, error } = await consulta;

    if (error) {
      return NextResponse.json(
        { mensagem: "Nao foi possivel listar lancamentos." },
        { status: 500 }
      );
    }

    const lancamentos = (data ?? []) as unknown as LancamentoFinanceiro[];

    return NextResponse.json({
      lancamentos,
      resumo: calcularResumoFinanceiro(lancamentos)
    });
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Nao foi possivel carregar lancamentos.";

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

    if (!perfil || !podeGerenciarFinanceiro(perfil)) {
      return NextResponse.json(
        { mensagem: "Voce nao tem permissao para criar lancamentos." },
        { status: 403 }
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

    const supabase = criarClienteSupabaseAdmin();
    const { data, error } = await supabase
      .from("financeiro_lancamentos")
      .insert({
        ...normalizarLancamentoFinanceiro(dados.data),
        registrado_por_user_id: resultado.usuarioAplicacao.id
      })
      .select(camposLancamentoFinanceiro)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { mensagem: error?.message ?? "Nao foi possivel criar lancamento." },
        { status: 400 }
      );
    }

    const lancamento = data as unknown as LancamentoFinanceiro;

    await supabase.from("auditoria").insert({
      user_id: resultado.usuarioAplicacao.id,
      acao: "criou_lancamento_financeiro",
      entidade: "financeiro_lancamentos",
      entidade_id: lancamento.id,
      dados_novos: lancamento
    });

    await criarNotificacaoSistema(supabase, {
      userId: resultado.usuarioAplicacao.id,
      tipo: lancamento.tipo === "receita" ? "sucesso" : "alerta",
      titulo: "Lancamento financeiro criado",
      mensagem: `${lancamento.descricao} - ${lancamento.categoria}`,
      link: "/financeiro"
    });

    return NextResponse.json({ lancamento }, { status: 201 });
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Nao foi possivel criar lancamento.";

    return NextResponse.json({ mensagem }, { status: 503 });
  }
}
