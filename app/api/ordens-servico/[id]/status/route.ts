import { NextResponse } from "next/server";
import { obterUsuarioDaRequisicao } from "@/lib/auth/servidor";
import {
  camposOrdemServico,
  obterOrdemServicoPorId,
  usuarioPodeAlterarExecucaoOrdemServico
} from "@/lib/ordens-servico/dados";
import { criarNotificacaoSistema } from "@/lib/notificacoes/dados";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/server";
import {
  proximoStatusOrdemServico,
  schemaAtualizarStatusOrdemServico
} from "@/lib/validations/ordens-servico";
import type { OrdemServico, StatusOrdemServico } from "@/types";

type ParametrosRota = {
  params: {
    id: string;
  };
};

function transicaoPermitida(
  atual: StatusOrdemServico,
  novo: StatusOrdemServico
): boolean {
  return (
    proximoStatusOrdemServico[atual] === novo ||
    (novo === "cancelada" &&
      !["concluida", "entregue", "cancelada"].includes(atual))
  );
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
    const dados = schemaAtualizarStatusOrdemServico.safeParse(corpo);

    if (!dados.success) {
      return NextResponse.json(
        { mensagem: "Status informado e invalido." },
        { status: 422 }
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

    if (
      !usuarioPodeAlterarExecucaoOrdemServico(
        perfil,
        resultado.usuarioAplicacao.id,
        ordemAnterior
      )
    ) {
      return NextResponse.json(
        { mensagem: "Voce nao tem permissao para alterar o status desta OS." },
        { status: 403 }
      );
    }

    if (!transicaoPermitida(ordemAnterior.status, dados.data.status)) {
      return NextResponse.json(
        { mensagem: "Transicao de status nao permitida." },
        { status: 422 }
      );
    }

    const { data: ordem, error } = await supabase
      .from("ordens_servico")
      .update({
        status: dados.data.status,
        atualizado_por_user_id: resultado.usuarioAplicacao.id
      })
      .eq("id", params.id)
      .select(camposOrdemServico)
      .single();

    if (error || !ordem) {
      return NextResponse.json(
        { mensagem: error?.message ?? "Nao foi possivel alterar o status." },
        { status: 400 }
      );
    }

    const ordemAtualizada = ordem as unknown as OrdemServico;

    await supabase.from("auditoria").insert({
      user_id: resultado.usuarioAplicacao.id,
      acao: "alterou_status_ordem_servico",
      entidade: "ordens_servico",
      entidade_id: ordemAtualizada.id,
      dados_anteriores: {
        status: ordemAnterior.status
      },
      dados_novos: {
        status: ordemAtualizada.status,
        observacao: dados.data.observacao || null
      }
    });

    if (
      ordemAtualizada.tecnico_responsavel_user_id &&
      ordemAtualizada.tecnico_responsavel_user_id !== resultado.usuarioAplicacao.id
    ) {
      await criarNotificacaoSistema(supabase, {
        userId: ordemAtualizada.tecnico_responsavel_user_id,
        tipo: "info",
        titulo: `OS ${ordemAtualizada.numero} atualizada`,
        mensagem: `Status alterado para ${ordemAtualizada.status}.`,
        link: "/ordens-servico"
      });
    }

    return NextResponse.json({ ordem: ordemAtualizada });
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Nao foi possivel alterar o status.";

    return NextResponse.json({ mensagem }, { status: 503 });
  }
}
