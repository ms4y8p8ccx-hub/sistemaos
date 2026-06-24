import { NextResponse } from "next/server";
import { obterUsuarioDaRequisicao } from "@/lib/auth/servidor";
import { podeVerFinanceiro } from "@/lib/auth/permissoes";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/server";
import type { Cliente, Fornecedor, OrdemServico } from "@/types";

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

    if (!perfil || !podeVerFinanceiro(perfil)) {
      return NextResponse.json(
        { mensagem: "Voce nao tem permissao para consultar opcoes financeiras." },
        { status: 403 }
      );
    }

    const supabase = criarClienteSupabaseAdmin();
    const [clientes, fornecedores, ordens] = await Promise.all([
      supabase
        .from("clientes")
        .select("id, nome, documento, email, telefone, celular, ativo, tipo, endereco_logradouro, endereco_numero, endereco_complemento, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep, observacoes, criado_em, atualizado_em")
        .eq("ativo", true)
        .order("nome", { ascending: true }),
      supabase
        .from("fornecedores")
        .select("id, tipo, nome, documento, email, telefone, contato_responsavel, endereco_cidade, endereco_estado, observacoes, ativo, criado_em, atualizado_em")
        .eq("ativo", true)
        .order("nome", { ascending: true }),
      supabase
        .from("ordens_servico")
        .select("id, numero, cliente_id, equipamento_id, status, prioridade, tecnico_responsavel_user_id, relato_cliente, diagnostico, solucao, observacoes_internas, valor_mao_obra, valor_pecas, desconto, valor_total, aberta_em, prevista_para, concluida_em, entregue_em, criado_em, atualizado_em, cliente:clientes(id, nome, documento), equipamento:equipamentos(id, tipo, marca, modelo, numero_serie)")
        .in("status", ["concluida", "entregue"])
        .order("numero", { ascending: false })
        .limit(100)
    ]);

    if (clientes.error || fornecedores.error || ordens.error) {
      return NextResponse.json(
        { mensagem: "Nao foi possivel carregar opcoes financeiras." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      clientes: (clientes.data ?? []) as unknown as Cliente[],
      fornecedores: (fornecedores.data ?? []) as unknown as Fornecedor[],
      ordens: (ordens.data ?? []) as unknown as OrdemServico[]
    });
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Nao foi possivel carregar opcoes financeiras.";

    return NextResponse.json({ mensagem }, { status: 503 });
  }
}
