import { NextResponse } from "next/server";
import { obterUsuarioDaRequisicao } from "@/lib/auth/servidor";
import {
  podeGerenciarEquipamentos,
  podeVerEquipamentos
} from "@/lib/auth/permissoes";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/server";
import {
  normalizarDadosEquipamento,
  schemaEquipamento
} from "@/lib/validations/equipamentos";
import type { Equipamento } from "@/types";

const camposEquipamento = [
  "id",
  "cliente_id",
  "tipo",
  "marca",
  "modelo",
  "ano_fabricacao",
  "numero_serie",
  "placa",
  "horimetro",
  "observacoes",
  "ativo",
  "criado_em",
  "atualizado_em",
  "cliente:clientes(id, nome, documento)"
].join(", ");

type ParametrosRota = {
  params: {
    id: string;
  };
};

async function clienteExisteAtivo(clienteId: string): Promise<boolean> {
  const supabase = criarClienteSupabaseAdmin();
  const { data, error } = await supabase
    .from("clientes")
    .select("id")
    .eq("id", clienteId)
    .eq("ativo", true)
    .single();

  return Boolean(data && !error);
}

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

    if (!perfil || !podeVerEquipamentos(perfil)) {
      return NextResponse.json(
        { mensagem: "Voce nao tem permissao para ver equipamentos." },
        { status: 403 }
      );
    }

    const supabase = criarClienteSupabaseAdmin();
    const { data: equipamento, error } = await supabase
      .from("equipamentos")
      .select(camposEquipamento)
      .eq("id", params.id)
      .single();

    if (error || !equipamento) {
      return NextResponse.json(
        { mensagem: "Equipamento nao encontrado." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      equipamento: equipamento as unknown as Equipamento
    });
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Nao foi possivel carregar o equipamento.";

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

    if (!perfil || !podeGerenciarEquipamentos(perfil)) {
      return NextResponse.json(
        { mensagem: "Voce nao tem permissao para editar equipamentos." },
        { status: 403 }
      );
    }

    const corpo = await request.json();
    const dados = schemaEquipamento.safeParse(corpo);

    if (!dados.success) {
      return NextResponse.json(
        {
          mensagem: "Revise os dados do equipamento.",
          erros: dados.error.flatten().fieldErrors
        },
        { status: 422 }
      );
    }

    if (!(await clienteExisteAtivo(dados.data.cliente_id))) {
      return NextResponse.json(
        { mensagem: "Cliente selecionado nao existe ou esta inativo." },
        { status: 422 }
      );
    }

    const supabase = criarClienteSupabaseAdmin();
    const { data: equipamentoAnterior } = await supabase
      .from("equipamentos")
      .select(camposEquipamento)
      .eq("id", params.id)
      .single();

    const { data: equipamento, error } = await supabase
      .from("equipamentos")
      .update(normalizarDadosEquipamento(dados.data))
      .eq("id", params.id)
      .select(camposEquipamento)
      .single();

    if (error || !equipamento) {
      return NextResponse.json(
        {
          mensagem:
            error?.message ?? "Nao foi possivel editar o equipamento."
        },
        { status: 400 }
      );
    }

    const equipamentoAtualizado = equipamento as unknown as Equipamento;

    await supabase.from("auditoria").insert({
      user_id: resultado.usuarioAplicacao.id,
      acao: "atualizou_equipamento",
      entidade: "equipamentos",
      entidade_id: equipamentoAtualizado.id,
      dados_anteriores: equipamentoAnterior as unknown as Equipamento | null,
      dados_novos: equipamentoAtualizado
    });

    return NextResponse.json({ equipamento: equipamentoAtualizado });
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Nao foi possivel editar o equipamento.";

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

    if (!perfil || !podeGerenciarEquipamentos(perfil)) {
      return NextResponse.json(
        { mensagem: "Voce nao tem permissao para desativar equipamentos." },
        { status: 403 }
      );
    }

    const supabase = criarClienteSupabaseAdmin();
    const { data: equipamentoAnterior } = await supabase
      .from("equipamentos")
      .select(camposEquipamento)
      .eq("id", params.id)
      .single();

    const { data: equipamento, error } = await supabase
      .from("equipamentos")
      .update({ ativo: false })
      .eq("id", params.id)
      .select(camposEquipamento)
      .single();

    if (error || !equipamento) {
      return NextResponse.json(
        {
          mensagem:
            error?.message ?? "Nao foi possivel desativar o equipamento."
        },
        { status: 400 }
      );
    }

    const equipamentoDesativado = equipamento as unknown as Equipamento;

    await supabase.from("auditoria").insert({
      user_id: resultado.usuarioAplicacao.id,
      acao: "desativou_equipamento",
      entidade: "equipamentos",
      entidade_id: equipamentoDesativado.id,
      dados_anteriores: equipamentoAnterior as unknown as Equipamento | null,
      dados_novos: equipamentoDesativado
    });

    return NextResponse.json({ equipamento: equipamentoDesativado });
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Nao foi possivel desativar o equipamento.";

    return NextResponse.json({ mensagem }, { status: 503 });
  }
}
