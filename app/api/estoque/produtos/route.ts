import { NextResponse } from "next/server";
import { obterUsuarioDaRequisicao } from "@/lib/auth/servidor";
import { podeGerenciarEstoque, podeVerEstoque } from "@/lib/auth/permissoes";
import { camposProduto } from "@/lib/estoque/dados";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/server";
import {
  normalizarProduto,
  schemaProduto
} from "@/lib/validations/estoque";
import type { Produto } from "@/types";

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
        { mensagem: "Voce nao tem permissao para listar produtos." },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const busca = url.searchParams.get("busca")?.trim();
    const somenteAtivos = url.searchParams.get("ativos") !== "false";
    const somenteCriticos = url.searchParams.get("criticos") === "true";
    const supabase = criarClienteSupabaseAdmin();

    let consulta = supabase
      .from("produtos")
      .select(camposProduto)
      .order("nome", { ascending: true });

    if (somenteAtivos) {
      consulta = consulta.eq("ativo", true);
    }

    if (busca) {
      consulta = consulta.or(
        `nome.ilike.%${busca}%,codigo_sku.ilike.%${busca}%,descricao.ilike.%${busca}%`
      );
    }

    const { data, error } = await consulta;

    if (error) {
      return NextResponse.json(
        { mensagem: "Nao foi possivel listar os produtos." },
        { status: 500 }
      );
    }

    let produtos = (data ?? []) as unknown as Produto[];

    if (somenteCriticos) {
      produtos = produtos.filter(
        (produto) => produto.estoque_atual <= produto.estoque_minimo
      );
    }

    return NextResponse.json({ produtos });
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Nao foi possivel carregar produtos.";

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
        { mensagem: "Voce nao tem permissao para criar produtos." },
        { status: 403 }
      );
    }

    const corpo = await request.json();
    const dados = schemaProduto.safeParse(corpo);

    if (!dados.success) {
      return NextResponse.json(
        {
          mensagem: "Revise os dados do produto.",
          erros: dados.error.flatten().fieldErrors
        },
        { status: 422 }
      );
    }

    const supabase = criarClienteSupabaseAdmin();
    const { data, error } = await supabase
      .from("produtos")
      .insert({
        ...normalizarProduto(dados.data),
        criado_por_user_id: resultado.usuarioAplicacao.id
      })
      .select(camposProduto)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { mensagem: error?.message ?? "Nao foi possivel criar o produto." },
        { status: 400 }
      );
    }

    const produto = data as unknown as Produto;

    await supabase.from("auditoria").insert({
      user_id: resultado.usuarioAplicacao.id,
      acao: "criou_produto",
      entidade: "produtos",
      entidade_id: produto.id,
      dados_novos: produto
    });

    return NextResponse.json({ produto }, { status: 201 });
  } catch (erro) {
    const mensagem =
      erro instanceof Error ? erro.message : "Nao foi possivel criar o produto.";

    return NextResponse.json({ mensagem }, { status: 503 });
  }
}
