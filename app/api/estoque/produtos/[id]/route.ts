import { NextResponse } from "next/server";
import { obterUsuarioDaRequisicao } from "@/lib/auth/servidor";
import { podeGerenciarEstoque } from "@/lib/auth/permissoes";
import { camposProduto } from "@/lib/estoque/dados";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/server";
import {
  normalizarProduto,
  schemaProduto
} from "@/lib/validations/estoque";
import type { Produto } from "@/types";

type ParametrosRota = {
  params: {
    id: string;
  };
};

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

    if (!perfil || !podeGerenciarEstoque(perfil)) {
      return NextResponse.json(
        { mensagem: "Voce nao tem permissao para editar produtos." },
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
    const { data: anterior } = await supabase
      .from("produtos")
      .select(camposProduto)
      .eq("id", params.id)
      .single();
    const { data, error } = await supabase
      .from("produtos")
      .update(normalizarProduto(dados.data))
      .eq("id", params.id)
      .select(camposProduto)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { mensagem: error?.message ?? "Nao foi possivel editar o produto." },
        { status: 400 }
      );
    }

    const produto = data as unknown as Produto;

    await supabase.from("auditoria").insert({
      user_id: resultado.usuarioAplicacao.id,
      acao: "atualizou_produto",
      entidade: "produtos",
      entidade_id: produto.id,
      dados_anteriores: anterior as unknown as Produto | null,
      dados_novos: produto
    });

    return NextResponse.json({ produto });
  } catch (erro) {
    const mensagem =
      erro instanceof Error ? erro.message : "Nao foi possivel editar o produto.";

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

    if (!perfil || !podeGerenciarEstoque(perfil)) {
      return NextResponse.json(
        { mensagem: "Voce nao tem permissao para desativar produtos." },
        { status: 403 }
      );
    }

    const supabase = criarClienteSupabaseAdmin();
    const { data: anterior } = await supabase
      .from("produtos")
      .select(camposProduto)
      .eq("id", params.id)
      .single();
    const { data, error } = await supabase
      .from("produtos")
      .update({ ativo: false })
      .eq("id", params.id)
      .select(camposProduto)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { mensagem: error?.message ?? "Nao foi possivel desativar o produto." },
        { status: 400 }
      );
    }

    const produto = data as unknown as Produto;

    await supabase.from("auditoria").insert({
      user_id: resultado.usuarioAplicacao.id,
      acao: "desativou_produto",
      entidade: "produtos",
      entidade_id: produto.id,
      dados_anteriores: anterior as unknown as Produto | null,
      dados_novos: produto
    });

    return NextResponse.json({ produto });
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Nao foi possivel desativar o produto.";

    return NextResponse.json({ mensagem }, { status: 503 });
  }
}
