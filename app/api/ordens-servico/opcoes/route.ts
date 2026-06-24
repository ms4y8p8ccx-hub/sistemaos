import { NextResponse } from "next/server";
import { obterUsuarioDaRequisicao } from "@/lib/auth/servidor";
import { podeVerOrdensServico } from "@/lib/auth/permissoes";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/server";
import type { Cliente, Equipamento, UsuarioSistema } from "@/types";

type UsuarioOpcaoBanco = Omit<UsuarioSistema, "role"> & {
  role: UsuarioSistema["role"] | Array<NonNullable<UsuarioSistema["role"]>>;
};

function normalizarUsuario(usuario: UsuarioOpcaoBanco): UsuarioSistema {
  const role = Array.isArray(usuario.role)
    ? usuario.role[0] ?? null
    : usuario.role;

  return {
    ...usuario,
    role
  };
}

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

    if (!perfil || !podeVerOrdensServico(perfil)) {
      return NextResponse.json(
        { mensagem: "Voce nao tem permissao para acessar ordens de servico." },
        { status: 403 }
      );
    }

    if (perfil === "tecnico") {
      return NextResponse.json({
        clientes: [],
        equipamentos: [],
        tecnicos: []
      });
    }

    const supabase = criarClienteSupabaseAdmin();
    const [clientesResposta, equipamentosResposta, usuariosResposta] =
      await Promise.all([
        supabase
          .from("clientes")
          .select("id, tipo, nome, documento, email, telefone, celular, endereco_logradouro, endereco_numero, endereco_complemento, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep, observacoes, ativo, criado_em, atualizado_em")
          .eq("ativo", true)
          .order("nome", { ascending: true }),
        supabase
          .from("equipamentos")
          .select("id, cliente_id, tipo, marca, modelo, ano_fabricacao, numero_serie, placa, horimetro, observacoes, ativo, criado_em, atualizado_em, cliente:clientes(id, nome, documento)")
          .eq("ativo", true)
          .order("tipo", { ascending: true }),
        supabase
          .from("users")
          .select("id, auth_user_id, nome, email, telefone, ativo, role_id, role:roles(id, nome, perfil)")
          .eq("ativo", true)
          .order("nome", { ascending: true })
      ]);

    if (
      clientesResposta.error ||
      equipamentosResposta.error ||
      usuariosResposta.error
    ) {
      return NextResponse.json(
        { mensagem: "Nao foi possivel carregar as opcoes da OS." },
        { status: 500 }
      );
    }

    const usuarios = ((usuariosResposta.data ?? []) as unknown as UsuarioOpcaoBanco[]).map(
      normalizarUsuario
    );
    const tecnicos = usuarios.filter(
      (usuario) => usuario.role?.perfil === "tecnico"
    );

    return NextResponse.json({
      clientes: (clientesResposta.data ?? []) as unknown as Cliente[],
      equipamentos:
        (equipamentosResposta.data ?? []) as unknown as Equipamento[],
      tecnicos
    });
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Nao foi possivel carregar as opcoes.";

    return NextResponse.json({ mensagem }, { status: 503 });
  }
}
