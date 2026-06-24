import { NextResponse } from "next/server";
import { obterUsuarioDaRequisicao } from "@/lib/auth/servidor";
import { podeEnviarNotificacoes } from "@/lib/auth/permissoes";
import { camposNotificacao } from "@/lib/notificacoes/dados";
import { enviarEmailNotificacao } from "@/lib/notificacoes/email";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/server";
import {
  normalizarNotificacao,
  schemaNotificacao
} from "@/lib/validations/notificacoes";
import type { Notificacao } from "@/types";

export async function GET(request: Request): Promise<Response> {
  try {
    const resultado = await obterUsuarioDaRequisicao(request);

    if (!resultado.ok) {
      return NextResponse.json(
        { mensagem: resultado.mensagem },
        { status: resultado.status }
      );
    }

    const url = new URL(request.url);
    const somenteNaoLidas = url.searchParams.get("nao_lidas") === "true";
    const supabase = criarClienteSupabaseAdmin();
    let consulta = supabase
      .from("notificacoes")
      .select(camposNotificacao)
      .eq("user_id", resultado.usuarioAplicacao.id)
      .order("criado_em", { ascending: false })
      .limit(80);

    if (somenteNaoLidas) {
      consulta = consulta.is("lida_em", null);
    }

    const { data, error } = await consulta;

    if (error) {
      return NextResponse.json(
        { mensagem: "Nao foi possivel carregar notificacoes." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      notificacoes: (data ?? []) as unknown as Notificacao[]
    });
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Nao foi possivel carregar notificacoes.";

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

    if (!perfil || !podeEnviarNotificacoes(perfil)) {
      return NextResponse.json(
        { mensagem: "Voce nao tem permissao para enviar notificacoes." },
        { status: 403 }
      );
    }

    const corpo = await request.json();
    const dados = schemaNotificacao.safeParse(corpo);

    if (!dados.success) {
      return NextResponse.json(
        {
          mensagem: "Revise os dados da notificacao.",
          erros: dados.error.flatten().fieldErrors
        },
        { status: 422 }
      );
    }

    const supabase = criarClienteSupabaseAdmin();
    const { data: destinatario } = await supabase
      .from("users")
      .select("email")
      .eq("id", dados.data.user_id)
      .single();
    const { data, error } = await supabase
      .from("notificacoes")
      .insert(normalizarNotificacao(dados.data))
      .select(camposNotificacao)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { mensagem: error?.message ?? "Nao foi possivel enviar notificacao." },
        { status: 400 }
      );
    }

    const notificacao = data as unknown as Notificacao;

    await supabase.from("auditoria").insert({
      user_id: resultado.usuarioAplicacao.id,
      acao: "enviou_notificacao",
      entidade: "notificacoes",
      entidade_id: notificacao.id,
      dados_novos: notificacao
    });

    await enviarEmailNotificacao({
      para: destinatario?.email,
      titulo: notificacao.titulo,
      mensagem: notificacao.mensagem
    });

    return NextResponse.json({ notificacao }, { status: 201 });
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Nao foi possivel enviar notificacao.";

    return NextResponse.json({ mensagem }, { status: 503 });
  }
}
