import { NextResponse } from "next/server";
import { obterUsuarioDaRequisicao } from "@/lib/auth/servidor";
import {
  camposItemOrdemServico,
  obterOrdemServicoPorId,
  recalcularTotaisOrdemServico,
  usuarioPodeAlterarExecucaoOrdemServico
} from "@/lib/ordens-servico/dados";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/server";
import type { ItemOrdemServico } from "@/types";

type ParametrosRota = {
  params: {
    id: string;
    itemId: string;
  };
};

export async function DELETE(
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
        { mensagem: "Voce nao tem permissao para remover itens desta OS." },
        { status: 403 }
      );
    }

    const { data: itemAnterior } = await supabase
      .from("itens_os")
      .select(camposItemOrdemServico)
      .eq("id", params.itemId)
      .eq("ordem_servico_id", ordem.id)
      .single();

    const { error } = await supabase
      .from("itens_os")
      .delete()
      .eq("id", params.itemId)
      .eq("ordem_servico_id", ordem.id);

    if (error) {
      return NextResponse.json(
        { mensagem: error.message },
        { status: 400 }
      );
    }

    await recalcularTotaisOrdemServico(
      supabase,
      ordem.id,
      resultado.usuarioAplicacao.id
    );

    await supabase.from("auditoria").insert({
      user_id: resultado.usuarioAplicacao.id,
      acao: "removeu_item_ordem_servico",
      entidade: "itens_os",
      entidade_id: params.itemId,
      dados_anteriores: itemAnterior as unknown as ItemOrdemServico | null
    });

    return NextResponse.json({ sucesso: true });
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Nao foi possivel remover o item.";

    return NextResponse.json({ mensagem }, { status: 503 });
  }
}
