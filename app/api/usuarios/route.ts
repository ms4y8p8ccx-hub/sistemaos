import { NextResponse } from "next/server";
import { obterUsuarioDaRequisicao } from "@/lib/auth/servidor";
import { podeGerenciarUsuarios } from "@/lib/auth/permissoes";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/server";
import { schemaCriarUsuario } from "@/lib/validations/usuarios";

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
        { mensagem: "Voce nao tem permissao para listar usuarios." },
        { status: 403 }
      );
    }

    const supabase = criarClienteSupabaseAdmin();
    const { data: usuarios, error } = await supabase
      .from("users")
      .select("id, auth_user_id, nome, email, telefone, ativo, role_id, role:roles(id, nome, perfil)")
      .order("nome", { ascending: true });

    if (error) {
      return NextResponse.json(
        { mensagem: "Nao foi possivel listar os usuarios." },
        { status: 500 }
      );
    }

    return NextResponse.json({ usuarios });
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Nao foi possivel carregar os usuarios.";

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

    if (!perfil || !podeGerenciarUsuarios(perfil)) {
      return NextResponse.json(
        { mensagem: "Voce nao tem permissao para criar usuarios." },
        { status: 403 }
      );
    }

    const corpo = await request.json();
    const dados = schemaCriarUsuario.safeParse(corpo);

    if (!dados.success) {
      return NextResponse.json(
        {
          mensagem: "Revise os dados do usuario.",
          erros: dados.error.flatten().fieldErrors
        },
        { status: 422 }
      );
    }

    const supabase = criarClienteSupabaseAdmin();
    const { data: role, error: erroRole } = await supabase
      .from("roles")
      .select("id, ativo")
      .eq("id", dados.data.role_id)
      .single();

    if (erroRole || !role?.ativo) {
      return NextResponse.json(
        { mensagem: "Perfil selecionado nao existe ou esta inativo." },
        { status: 422 }
      );
    }

    const { data: usuarioAuth, error: erroAuth } =
      await supabase.auth.admin.createUser({
        email: dados.data.email,
        password: dados.data.senha,
        email_confirm: true,
        user_metadata: {
          nome: dados.data.nome
        }
      });

    if (erroAuth || !usuarioAuth.user) {
      return NextResponse.json(
        { mensagem: erroAuth?.message ?? "Nao foi possivel criar o login." },
        { status: 400 }
      );
    }

    const { data: usuario, error: erroUsuario } = await supabase
      .from("users")
      .insert({
        auth_user_id: usuarioAuth.user.id,
        role_id: dados.data.role_id,
        nome: dados.data.nome,
        email: dados.data.email,
        telefone: dados.data.telefone || null
      })
      .select("id, auth_user_id, nome, email, telefone, ativo, role_id, role:roles(id, nome, perfil)")
      .single();

    if (erroUsuario || !usuario) {
      await supabase.auth.admin.deleteUser(usuarioAuth.user.id);

      return NextResponse.json(
        {
          mensagem:
            erroUsuario?.message ?? "Nao foi possivel salvar o usuario."
        },
        { status: 400 }
      );
    }

    await supabase.from("auditoria").insert({
      user_id: resultado.usuarioAplicacao.id,
      acao: "criou_usuario",
      entidade: "users",
      entidade_id: usuario.id,
      dados_novos: {
        nome: usuario.nome,
        email: usuario.email,
        role_id: usuario.role_id
      }
    });

    return NextResponse.json({ usuario }, { status: 201 });
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Nao foi possivel criar o usuario.";

    return NextResponse.json({ mensagem }, { status: 503 });
  }
}
