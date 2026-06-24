import { NextResponse } from "next/server";
import { obterUsuarioDaRequisicao } from "@/lib/auth/servidor";
import { podeGerenciarEstoque } from "@/lib/auth/permissoes";
import { camposFornecedor } from "@/lib/estoque/dados";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/server";
import {
  normalizarFornecedor,
  schemaFornecedor
} from "@/lib/validations/estoque";
import type { Fornecedor } from "@/types";

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
        { mensagem: "Voce nao tem permissao para editar fornecedores." },
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
    const { data: anterior } = await supabase
      .from("fornecedores")
      .select(camposFornecedor)
      .eq("id", params.id)
      .single();
    const { data, error } = await supabase
      .from("fornecedores")
      .update(normalizarFornecedor(dados.data))
      .eq("id", params.id)
      .select(camposFornecedor)
      .single();

    if (error || !data) {
      return NextResponse.json(
        {
          mensagem:
            error?.message ?? "Nao foi possivel editar o fornecedor."
        },
        { status: 400 }
      );
    }

    const fornecedor = data as unknown as Fornecedor;

    await supabase.from("auditoria").insert({
      user_id: resultado.usuarioAplicacao.id,
      acao: "atualizou_fornecedor",
      entidade: "fornecedores",
      entidade_id: fornecedor.id,
      dados_anteriores: anterior as unknown as Fornecedor | null,
      dados_novos: fornecedor
    });

    return NextResponse.json({ fornecedor });
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Nao foi possivel editar o fornecedor.";

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
        { mensagem: "Voce nao tem permissao para desativar fornecedores." },
        { status: 403 }
      );
    }

    const supabase = criarClienteSupabaseAdmin();
    const { data: anterior } = await supabase
      .from("fornecedores")
      .select(camposFornecedor)
      .eq("id", params.id)
      .single();
    const { data, error } = await supabase
      .from("fornecedores")
      .update({ ativo: false })
      .eq("id", params.id)
      .select(camposFornecedor)
      .single();

    if (error || !data) {
      return NextResponse.json(
        {
          mensagem:
            error?.message ?? "Nao foi possivel desativar o fornecedor."
        },
        { status: 400 }
      );
    }

    const fornecedor = data as unknown as Fornecedor;

    await supabase.from("auditoria").insert({
      user_id: resultado.usuarioAplicacao.id,
      acao: "desativou_fornecedor",
      entidade: "fornecedores",
      entidade_id: fornecedor.id,
      dados_anteriores: anterior as unknown as Fornecedor | null,
      dados_novos: fornecedor
    });

    return NextResponse.json({ fornecedor });
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Nao foi possivel desativar o fornecedor.";

    return NextResponse.json({ mensagem }, { status: 503 });
  }
}
