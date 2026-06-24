import { NextResponse } from "next/server";
import { obterUsuarioDaRequisicao } from "@/lib/auth/servidor";
import { camposNotificacao } from "@/lib/notificacoes/dados";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/server";
import type { Notificacao } from "@/types";

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

    const supabase = criarClienteSupabaseAdmin();
    const { data, error } = await supabase
      .from("notificacoes")
      .update({ lida_em: new Date().toISOString() })
      .eq("id", params.id)
      .eq("user_id", resultado.usuarioAplicacao.id)
      .select(camposNotificacao)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { mensagem: "Nao foi possivel marcar notificacao como lida." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      notificacao: data as unknown as Notificacao
    });
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Nao foi possivel atualizar notificacao.";

    return NextResponse.json({ mensagem }, { status: 503 });
  }
}
