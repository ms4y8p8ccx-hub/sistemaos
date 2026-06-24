import type { User } from "@supabase/supabase-js";
import { criarClienteSupabaseAdmin, criarClienteSupabaseServidor } from "@/lib/supabase/server";
import type { PerfilUsuario } from "@/types";

export type UsuarioAplicacao = {
  id: string;
  auth_user_id: string | null;
  nome: string;
  email: string;
  telefone: string | null;
  ativo: boolean;
  role_id: string;
  role: {
    id: string;
    nome: string;
    perfil: PerfilUsuario;
  } | null;
};

type UsuarioAplicacaoBanco = Omit<UsuarioAplicacao, "role"> & {
  role:
    | UsuarioAplicacao["role"]
    | Array<NonNullable<UsuarioAplicacao["role"]>>;
};

type ResultadoAutenticacao =
  | {
      ok: true;
      usuarioAuth: User;
      usuarioAplicacao: UsuarioAplicacao;
    }
  | {
      ok: false;
      status: number;
      mensagem: string;
    };

function obterTokenRequisicao(request: Request): string | null {
  const cabecalho = request.headers.get("authorization");

  if (!cabecalho?.startsWith("Bearer ")) {
    return null;
  }

  return cabecalho.replace("Bearer ", "").trim();
}

function normalizarUsuarioAplicacao(
  usuario: UsuarioAplicacaoBanco
): UsuarioAplicacao {
  const role = Array.isArray(usuario.role)
    ? usuario.role[0] ?? null
    : usuario.role;

  return {
    ...usuario,
    role
  };
}

export async function obterUsuarioDaRequisicao(
  request: Request
): Promise<ResultadoAutenticacao> {
  const token = obterTokenRequisicao(request);

  if (!token) {
    return {
      ok: false,
      status: 401,
      mensagem: "Sessao nao informada."
    };
  }

  const supabaseAuth = criarClienteSupabaseServidor();
  const { data: dadosAuth, error: erroAuth } = await supabaseAuth.auth.getUser(token);

  if (erroAuth || !dadosAuth.user) {
    return {
      ok: false,
      status: 401,
      mensagem: "Sessao invalida ou expirada."
    };
  }

  const supabaseAdmin = criarClienteSupabaseAdmin();
  const { data: usuarioAplicacao, error: erroPerfil } = await supabaseAdmin
    .from("users")
    .select("id, auth_user_id, nome, email, telefone, ativo, role_id, role:roles(id, nome, perfil)")
    .eq("auth_user_id", dadosAuth.user.id)
    .single();

  if (erroPerfil || !usuarioAplicacao) {
    return {
      ok: false,
      status: 403,
      mensagem: "Usuario autenticado ainda nao possui perfil no sistema."
    };
  }

  if (!usuarioAplicacao.ativo) {
    return {
      ok: false,
      status: 403,
      mensagem: "Usuario inativo."
    };
  }

  return {
    ok: true,
    usuarioAuth: dadosAuth.user,
    usuarioAplicacao: normalizarUsuarioAplicacao(
      usuarioAplicacao as unknown as UsuarioAplicacaoBanco
    )
  };
}
