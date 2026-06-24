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

    if (!perfil || !podeVerClientes(perfil)) {
      return NextResponse.json(
        { mensagem: "Voce nao tem permissao para listar clientes." },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const busca = url.searchParams.get("busca")?.trim();
    const somenteAtivos = url.searchParams.get("ativos") !== "false";
    const supabase = criarClienteSupabaseAdmin();

    let consulta = supabase
      .from("clientes")
      .select(camposCliente)
      .order("nome", { ascending: true });

    if (somenteAtivos) {
      consulta = consulta.eq("ativo", true);
    }

    if (busca) {
      consulta = consulta.or(
        `nome.ilike.%${busca}%,documento.ilike.%${busca}%,email.ilike.%${busca}%`
      );
    }

    const { data: clientes, error } = await consulta;

    if (error) {
      return NextResponse.json(
        { mensagem: "Nao foi possivel listar os clientes." },
        { status: 500 }
      );
    }

    return NextResponse.json({ clientes });
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Nao foi possivel carregar os clientes.";

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

    if (!perfil || !podeGerenciarClientes(perfil)) {
      return NextResponse.json(
        { mensagem: "Voce nao tem permissao para criar clientes." },
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
    const { data: cliente, error } = await supabase
      .from("clientes")
      .insert({
        ...normalizarDadosCliente(dados.data),
        criado_por_user_id: resultado.usuarioAplicacao.id
      })
      .select(camposCliente)
      .single();

    if (error || !cliente) {
      return NextResponse.json(
        { mensagem: error?.message ?? "Nao foi possivel criar o cliente." },
        { status: 400 }
      );
    }

    const clienteCriado = cliente as unknown as Cliente;

    await supabase.from("auditoria").insert({
      user_id: resultado.usuarioAplicacao.id,
      acao: "criou_cliente",
      entidade: "clientes",
      entidade_id: clienteCriado.id,
      dados_novos: clienteCriado
    });

    return NextResponse.json({ cliente: clienteCriado }, { status: 201 });
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Nao foi possivel criar o cliente.";

    return NextResponse.json({ mensagem }, { status: 503 });
  }
}
