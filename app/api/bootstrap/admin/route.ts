import { NextResponse } from "next/server";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/server";
import { schemaCriarPrimeiroAdministrador } from "@/lib/validations/usuarios";

export async function POST(request: Request): Promise<Response> {
  try {
    const supabase = criarClienteSupabaseAdmin();
    const corpo = await request.json();
    const dados = schemaCriarPrimeiroAdministrador.safeParse(corpo);

    if (!dados.success) {
      return NextResponse.json(
        {
          mensagem: "Revise os dados do administrador.",
          erros: dados.error.flatten().fieldErrors
        },
        { status: 422 }
      );
    }

    const { data: usuariosExistentes, error: erroUsuarios } = await supabase
      .from("users")
      .select("id")
      .not("auth_user_id", "is", null)
      .limit(1);

    if (erroUsuarios) {
      return NextResponse.json(
        { mensagem: "Nao foi possivel verificar usuarios existentes." },
        { status: 500 }
      );
    }

    if ((usuariosExistentes?.length ?? 0) > 0) {
      return NextResponse.json(
        { mensagem: "A configuracao inicial ja foi concluida." },
        { status: 409 }
      );
    }

    const { data: role, error: erroRole } = await supabase
      .from("roles")
      .upsert(
        {
          nome: "Administrador",
          perfil: "administrador",
          descricao: "Acesso total ao sistema.",
          ativo: true
        },
        { onConflict: "perfil" }
      )
      .select("id")
      .single();

    if (erroRole || !role) {
      return NextResponse.json(
        { mensagem: "Nao foi possivel preparar o perfil administrador." },
        { status: 500 }
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
        role_id: role.id,
        nome: dados.data.nome,
        email: dados.data.email,
        ativo: true
      })
      .select("id, auth_user_id, nome, email, telefone, ativo, role_id, role:roles(id, nome, perfil)")
      .single();

    if (erroUsuario || !usuario) {
      await supabase.auth.admin.deleteUser(usuarioAuth.user.id);

      return NextResponse.json(
        {
          mensagem:
            erroUsuario?.message ??
            "Nao foi possivel salvar o administrador inicial."
        },
        { status: 400 }
      );
    }

    await supabase.from("auditoria").insert({
      user_id: usuario.id,
      acao: "criou_primeiro_administrador",
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
        : "Nao foi possivel concluir a configuracao inicial.";

    return NextResponse.json({ mensagem }, { status: 503 });
  }
}
