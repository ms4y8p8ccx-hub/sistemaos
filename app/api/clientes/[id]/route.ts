import { NextResponse } from "next/server";
import { obterUsuarioDaRequisicao } from "@/lib/auth/servidor";
import {
  podeGerenciarClientes,
  podeVerClientes
} from "@/lib/auth/permissoes";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/server";
import {
  normalizarDadosCliente,
  schemaCliente
} from "@/lib/validations/clientes";
import type { Cliente } from "@/types";

const camposCliente = [
  "id",
  "tipo",
  "nome",
  "documento",
  "email",
  "telefone",
  "celular",
  "endereco_logradouro",
  "endereco_numero",
  "endereco_complemento",
  "endereco_bairro",
  "endereco_cidade",
  "endereco_estado",
  "endereco_cep",
  "observacoes",
  "ativo",
  "criado_em",
  "atualizado_em"
].join(", ");

type ParametrosRota = {
  params: {
    id: string;
  };
};

export async function GET(
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

    if (!perfil || !podeVerClientes(perfil)) {
      return NextResponse.json(
        { mensagem: "Voce nao tem permissao para ver clientes." },
        { status: 403 }
      );
    }

    const supabase = criarClienteSupabaseAdmin();
    const { data: cliente, error } = await supabase
      .from("clientes")
      .select(camposCliente)
      .eq("id", params.id)
      .single();

    if (error || !cliente) {
      return NextResponse.json(
        { mensagem: "Cliente nao encontrado." },
        { status: 404 }
      );
    }

    return NextResponse.json({ cliente: cliente as unknown as Cliente });
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Nao foi possivel carregar o cliente.";

    return NextResponse.json({ mensagem }, { status: 503 });
  }
}

export async function PATCH(
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

    if (!perfil || !podeGerenciarClientes(perfil)) {
      return NextResponse.json(
        { mensagem: "Voce nao tem permissao para editar clientes." },
        { status: 403 }
      );
    }

    const corpo = await request.json();
    const dados = schemaCliente.safeParse(corpo);

    if (!dados.success) {
      return NextResponse.json(
        {
          mensagem: "Revise os dados do cliente.",
          erros: dados.error.flatten().fieldErrors
        },
        { status: 422 }
      );
    }

    const supabase = criarClienteSupabaseAdmin();
    const { data: clienteAnterior } = await supabase
      .from("clientes")
      .select(camposCliente)
      .eq("id", params.id)
      .single();

    const { data: cliente, error } = await supabase
      .from("clientes")
      .update(normalizarDadosCliente(dados.data))
      .eq("id", params.id)
      .select(camposCliente)
      .single();

    if (error || !cliente) {
      return NextResponse.json(
        { mensagem: error?.message ?? "Nao foi possivel editar o cliente." },
        { status: 400 }
      );
    }

    const clienteAtualizado = cliente as unknown as Cliente;

    await supabase.from("auditoria").insert({
      user_id: resultado.usuarioAplicacao.id,
      acao: "atualizou_cliente",
      entidade: "clientes",
      entidade_id: clienteAtualizado.id,
      dados_anteriores: clienteAnterior as unknown as Cliente | null,
      dados_novos: clienteAtualizado
    });

    return NextResponse.json({ cliente: clienteAtualizado });
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Nao foi possivel editar o cliente.";

    return NextResponse.json({ mensagem }, { status: 503 });
  }
}

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

    if (!perfil || !podeGerenciarClientes(perfil)) {
      return NextResponse.json(
        { mensagem: "Voce nao tem permissao para desativar clientes." },
        { status: 403 }
      );
    }

    const supabase = criarClienteSupabaseAdmin();
    const { data: clienteAnterior } = await supabase
      .from("clientes")
      .select(camposCliente)
      .eq("id", params.id)
      .single();

    const { data: cliente, error } = await supabase
      .from("clientes")
      .update({ ativo: false })
      .eq("id", params.id)
      .select(camposCliente)
      .single();

    if (error || !cliente) {
      return NextResponse.json(
        {
          mensagem:
            error?.message ?? "Nao foi possivel desativar o cliente."
        },
        { status: 400 }
      );
    }

    const clienteDesativado = cliente as unknown as Cliente;

    await supabase.from("auditoria").insert({
      user_id: resultado.usuarioAplicacao.id,
      acao: "desativou_cliente",
      entidade: "clientes",
      entidade_id: clienteDesativado.id,
      dados_anteriores: clienteAnterior as unknown as Cliente | null,
      dados_novos: clienteDesativado
    });

    return NextResponse.json({ cliente: clienteDesativado });
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Nao foi possivel desativar o cliente.";

    return NextResponse.json({ mensagem }, { status: 503 });
  }
}
