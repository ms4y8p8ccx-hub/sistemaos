import { NextResponse } from "next/server";
import { obterUsuarioDaRequisicao } from "@/lib/auth/servidor";
import { podeGerenciarUsuarios } from "@/lib/auth/permissoes";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/server";

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

    if (!perfil || !podeGerenciarUsuarios(perfil)) {
      return NextResponse.json(
        { mensagem: "Voce nao tem permissao para gerenciar perfis." },
        { status: 403 }
      );
    }

    const supabase = criarClienteSupabaseAdmin();
    const { data: perfis, error } = await supabase
      .from("roles")
      .select("id, nome, perfil, descricao, ativo")
      .eq("ativo", true)
      .order("nome", { ascending: true });

    if (error) {
      return NextResponse.json(
        { mensagem: "Nao foi possivel listar os perfis." },
        { status: 500 }
      );
    }

    return NextResponse.json({ perfis });
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Nao foi possivel carregar os perfis.";

    return NextResponse.json({ mensagem }, { status: 503 });
  }
}
