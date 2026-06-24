import { NextResponse } from "next/server";
import { obterUsuarioDaRequisicao } from "@/lib/auth/servidor";
import {
  camposItemOrdemServico,
  listarItensOrdemServico,
  obterOrdemServicoPorId,
  recalcularTotaisOrdemServico,
  usuarioPodeAcessarOrdemServico,
  usuarioPodeAlterarExecucaoOrdemServico
} from "@/lib/ordens-servico/dados";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/server";
import {
  normalizarItemOrdemServico,
  schemaItemOrdemServico
} from "@/lib/validations/ordens-servico";
import type { ItemOrdemServico } from "@/types";

type ParametrosRota = {
  params: {
    id: string;
  };
};

export async function GET(
  request: Request,
  { params }: ParametrosRota
): Promise<Response> {
  try {
    const resultado = await obterUsuarioDaRequisicao(request);

    if (!resultado.ok) {
      return NextResponse.json(
        { mensagem: resultado.mensagem },
        { status: resultado.status }
      );
    }

    const supabase = criarClienteSupabaseAdmin();
    const ordem = await obterOrdemServicoPorId(supabase, params.id);

    if (!ordem) {
      return NextResponse.json(
        { mensagem: "Ordem de servico nao encontrada." },
        { status: 404 }
      );
    }

    const perfil = resultado.usuarioAplicacao.role?.perfil;

    if (
      !perfil ||
      !usuarioPodeAcessarOrdemServico(
        perfil,
        resultado.usuarioAplicacao.id,
        ordem
      )
    ) {
      return NextResponse.json(
        { mensagem: "Voce nao tem acesso aos itens desta OS." },
        { status: 403 }
      );
    }

    const itens = await listarItensOrdemServico(supabase, ordem.id);

    return NextResponse.json({ itens });
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Nao foi possivel carregar os itens.";

    return NextResponse.json({ mensagem }, { status: 503 });
  }
}

export async function POST(
  request: Request,
  { params }: ParametrosRota
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

    if (!perfil) {
      return NextResponse.json(
        { mensagem: "Usuario sem perfil para alterar OS." },
        { status: 403 }
      );
    }

    const corpo = await request.json();
    const dados = schemaItemOrdemServico.safeParse(corpo);

    if (!dados.success) {
      return NextResponse.json(
        {
          mensagem: "Revise os dados do item.",
          erros: dados.error.flatten().fieldErrors
        },
        { status: 422 }
      );
    }

    const supabase = criarClienteSupabaseAdmin();
    const ordem = await obterOrdemServicoPorId(supabase, params.id);

    if (!ordem) {
      return NextResponse.json(
        { mensagem: "Ordem de servico nao encontrada." },
        { status: 404 }
      );
    }

    if (
      !usuarioPodeAlterarExecucaoOrdemServico(
        perfil,
        resultado.usuarioAplicacao.id,
        ordem
      )
    ) {
      return NextResponse.json(
        { mensagem: "Voce nao tem permissao para adicionar itens nesta OS." },
        { status: 403 }
      );
    }

    const { data: item, error } = await supabase
      .from("itens_os")
      .insert({
        ...normalizarItemOrdemServico(dados.data),
        ordem_servico_id: ordem.id,
        criado_por_user_id: resultado.usuarioAplicacao.id
      })
      .select(camposItemOrdemServico)
      .single();

    if (error || !item) {
      return NextResponse.json(
        { mensagem: error?.message ?? "Nao foi possivel adicionar o item." },
        { status: 400 }
      );
    }

    await recalcularTotaisOrdemServico(
      supabase,
      ordem.id,
      resultado.usuarioAplicacao.id
    );

    const itemCriado = item as unknown as ItemOrdemServico;

    await supabase.from("auditoria").insert({
      user_id: resultado.usuarioAplicacao.id,
      acao: "adicionou_item_ordem_servico",
      entidade: "itens_os",
      entidade_id: itemCriado.id,
      dados_novos: itemCriado
    });

    return NextResponse.json({ item: itemCriado }, { status: 201 });
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Nao foi possivel adicionar o item.";

    return NextResponse.json({ mensagem }, { status: 503 });
  }
}
