import { NextResponse } from "next/server";
import { obterUsuarioDaRequisicao } from "@/lib/auth/servidor";
import { podeGerenciarEstoque, podeVerEstoque } from "@/lib/auth/permissoes";
import { camposFornecedor } from "@/lib/estoque/dados";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/server";
import {
  normalizarFornecedor,
  schemaFornecedor
} from "@/lib/validations/estoque";
import type { Fornecedor } from "@/types";

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

    if (!perfil || !podeVerEstoque(perfil)) {
      return NextResponse.json(
        { mensagem: "Voce nao tem permissao para listar fornecedores." },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const busca = url.searchParams.get("busca")?.trim();
    const somenteAtivos = url.searchParams.get("ativos") !== "false";
    const supabase = criarClienteSupabaseAdmin();

    let consulta = supabase
      .from("fornecedores")
      .select(camposFornecedor)
      .order("nome", { ascending: true });

    if (somenteAtivos) {
      consulta = consulta.eq("ativo", true);
    }

    if (busca) {
      consulta = consulta.or(
        `nome.ilike.%${busca}%,documento.ilike.%${busca}%,email.ilike.%${busca}%`
      );
    }

    const { data, error } = await consulta;

    if (error) {
      return NextResponse.json(
        { mensagem: "Nao foi possivel listar os fornecedores." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      fornecedores: (data ?? []) as unknown as Fornecedor[]
    });
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Nao foi possivel carregar fornecedores.";

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

    if (!perfil || !podeGerenciarEstoque(perfil)) {
      return NextResponse.json(
        { mensagem: "Voce nao tem permissao para criar fornecedores." },
        { status: 403 }
      );
    }

    const corpo = await request.json();
    const dados = schemaFornecedor.safeParse(corpo);

    if (!dados.success) {
      return NextResponse.json(
        {
          mensagem: "Revise os dados do fornecedor.",
          erros: dados.error.flatten().fieldErrors
        },
        { status: 422 }
      );
    }

    const supabase = criarClienteSupabaseAdmin();
    const { data, error } = await supabase
      .from("fornecedores")
      .insert({
        ...normalizarFornecedor(dados.data),
        criado_por_user_id: resultado.usuarioAplicacao.id
      })
      .select(camposFornecedor)
      .single();

    if (error || !data) {
      return NextResponse.json(
        {
          mensagem:
            error?.message ?? "Nao foi possivel criar o fornecedor."
        },
        { status: 400 }
      );
    }

    const fornecedor = data as unknown as Fornecedor;

    await supabase.from("auditoria").insert({
      user_id: resultado.usuarioAplicacao.id,
      acao: "criou_fornecedor",
      entidade: "fornecedores",
      entidade_id: fornecedor.id,
      dados_novos: fornecedor
    });

    return NextResponse.json({ fornecedor }, { status: 201 });
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Nao foi possivel criar o fornecedor.";

    return NextResponse.json({ mensagem }, { status: 503 });
  }
}
