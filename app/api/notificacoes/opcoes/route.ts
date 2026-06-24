import { NextResponse } from "next/server";
import { obterUsuarioDaRequisicao } from "@/lib/auth/servidor";
import { podeEnviarNotificacoes } from "@/lib/auth/permissoes";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/server";
import type { UsuarioSistema } from "@/types";

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

    if (!perfil || !podeEnviarNotificacoes(perfil)) {
      return NextResponse.json(
        { mensagem: "Voce nao tem permissao para listar destinatarios." },
        { status: 403 }
      );
    }

    const supabase = criarClienteSupabaseAdmin();
    const { data, error } = await supabase
      .from("users")
      .select("id, auth_user_id, nome, email, telefone, ativo, role_id, role:roles(id, nome, perfil)")
      .eq("ativo", true)
      .order("nome", { ascending: true });

    if (error) {
      return NextResponse.json(
        { mensagem: "Nao foi possivel carregar usuarios." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      usuarios: (data ?? []) as unknown as UsuarioSistema[]
    });
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Nao foi possivel carregar usuarios.";

    return NextResponse.json({ mensagem }, { status: 503 });
  }
}
