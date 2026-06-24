import { NextResponse } from "next/server";
import { obterUsuarioDaRequisicao } from "@/lib/auth/servidor";
import { podeGerenciarConfiguracoes } from "@/lib/auth/permissoes";
import { obterConfiguracaoSupabase } from "@/lib/env";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/server";
import type { Auditoria } from "@/types";

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

    if (!perfil || !podeGerenciarConfiguracoes(perfil)) {
      return NextResponse.json(
        { mensagem: "Voce nao tem permissao para acessar configuracoes." },
        { status: 403 }
      );
    }

    const configuracao = obterConfiguracaoSupabase();
    const supabase = criarClienteSupabaseAdmin();
    const { data: auditoria } = await supabase
      .from("auditoria")
      .select("id, user_id, acao, entidade, entidade_id, criado_em, user:users(id, nome, email)")
      .order("criado_em", { ascending: false })
      .limit(20);

    return NextResponse.json({
      ambiente: {
        supabaseUrl: Boolean(configuracao.url),
        supabaseAnonKey: Boolean(configuracao.chaveAnonima),
        supabaseServiceRole: Boolean(configuracao.chaveServico),
        resend: configuracao.emailConfigurado
      },
      auditoria: (auditoria ?? []) as unknown as Auditoria[]
    });
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Nao foi possivel carregar configuracoes.";

    return NextResponse.json({ mensagem }, { status: 503 });
  }
}
