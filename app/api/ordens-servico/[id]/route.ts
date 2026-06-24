import { NextResponse } from "next/server";
import { obterUsuarioDaRequisicao } from "@/lib/auth/servidor";
import {
  podeGerenciarOrdensServico,
  podeVerOrdensServico
} from "@/lib/auth/permissoes";
import {
  camposOrdemServico,
  listarItensOrdemServico,
  obterOrdemServicoPorId,
  usuarioPodeAcessarOrdemServico,
  usuarioPodeAlterarExecucaoOrdemServico
} from "@/lib/ordens-servico/dados";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/server";
import {
  normalizarAtualizacaoOrdemServico,
  schemaAtualizarOrdemServico
} from "@/lib/validations/ordens-servico";
import type { OrdemServico } from "@/types";

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

    const perfil = resultado.usuarioAplicacao.role?.perfil;

    if (!perfil || !podeVerOrdensServico(perfil)) {
      return NextResponse.json(
        { mensagem: "Voce nao tem permissao para ver OS." },
        { status: 403 }
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
      !usuarioPodeAcessarOrdemServico(
        perfil,
        resultado.usuarioAplicacao.id,
        ordem
      )
    ) {
      return NextResponse.json(
        { mensagem: "Voce nao tem acesso a esta OS." },
        { status: 403 }
      );
    }

    const itens = await listarItensOrdemServico(supabase, ordem.id);

    return NextResponse.json({ ordem, itens });
  } catch (erro) {
    const mensagem =
      erro instanceof Error ? erro.message : "Nao foi possivel carregar a OS.";

    return NextResponse.json({ mensagem }, { status: 503 });
  }
}

export async function PATCH(
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
        { mensagem: "Usuario sem perfil para editar OS." },
        { status: 403 }
      );
    }

    const supabase = criarClienteSupabaseAdmin();
    const ordemAnterior = await obterOrdemServicoPorId(supabase, params.id);

    if (!ordemAnterior) {
      return NextResponse.json(
        { mensagem: "Ordem de servico nao encontrada." },
        { status: 404 }
      );
    }

    const podeGerenciar = podeGerenciarOrdensServico(perfil);
    const podeExecutar = usuarioPodeAlterarExecucaoOrdemServico(
      perfil,
      resultado.usuarioAplicacao.id,
      ordemAnterior
    );

    if (!podeGerenciar && !podeExecutar) {
      return NextResponse.json(
        { mensagem: "Voce nao tem permissao para editar OS." },
        { status: 403 }
      );
    }

    const corpo = await request.json();
    const dados = schemaAtualizarOrdemServico.safeParse(corpo);

    if (!dados.success) {
      return NextResponse.json(
        {
          mensagem: "Revise os dados da OS.",
          erros: dados.error.flatten().fieldErrors
        },
        { status: 422 }
      );
    }

    const dadosAtualizados = normalizarAtualizacaoOrdemServico(dados.data);
    const atualizacao = podeGerenciar
      ? dadosAtualizados
      : {
          diagnostico: dadosAtualizados.diagnostico,
          solucao: dadosAtualizados.solucao
        };

    const { data: ordem, error } = await supabase
      .from("ordens_servico")
      .update({
        ...atualizacao,
        atualizado_por_user_id: resultado.usuarioAplicacao.id
      })
      .eq("id", params.id)
      .select(camposOrdemServico)
      .single();

    if (error || !ordem) {
      return NextResponse.json(
        { mensagem: error?.message ?? "Nao foi possivel editar a OS." },
        { status: 400 }
      );
    }

    const ordemAtualizada = ordem as unknown as OrdemServico;

    await supabase.from("auditoria").insert({
      user_id: resultado.usuarioAplicacao.id,
      acao: "atualizou_ordem_servico",
      entidade: "ordens_servico",
      entidade_id: ordemAtualizada.id,
      dados_anteriores: ordemAnterior,
      dados_novos: ordemAtualizada
    });

    return NextResponse.json({ ordem: ordemAtualizada });
  } catch (erro) {
    const mensagem =
      erro instanceof Error ? erro.message : "Nao foi possivel editar a OS.";

    return NextResponse.json({ mensagem }, { status: 503 });
  }
}
