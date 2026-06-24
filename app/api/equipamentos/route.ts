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

    if (!perfil || !podeVerEquipamentos(perfil)) {
      return NextResponse.json(
        { mensagem: "Voce nao tem permissao para listar equipamentos." },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const busca = url.searchParams.get("busca")?.trim();
    const clienteId = url.searchParams.get("cliente_id")?.trim();
    const somenteAtivos = url.searchParams.get("ativos") !== "false";
    const supabase = criarClienteSupabaseAdmin();

    let consulta = supabase
      .from("equipamentos")
      .select(camposEquipamento)
      .order("atualizado_em", { ascending: false });

    if (somenteAtivos) {
      consulta = consulta.eq("ativo", true);
    }

    if (clienteId) {
      consulta = consulta.eq("cliente_id", clienteId);
    }

    if (busca) {
      consulta = consulta.or(
        `tipo.ilike.%${busca}%,marca.ilike.%${busca}%,modelo.ilike.%${busca}%,numero_serie.ilike.%${busca}%,placa.ilike.%${busca}%`
      );
    }

    const { data: equipamentos, error } = await consulta;

    if (error) {
      return NextResponse.json(
        { mensagem: "Nao foi possivel listar os equipamentos." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      equipamentos: equipamentos as unknown as Equipamento[]
    });
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Nao foi possivel carregar os equipamentos.";

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

    if (!perfil || !podeGerenciarEquipamentos(perfil)) {
      return NextResponse.json(
        { mensagem: "Voce nao tem permissao para criar equipamentos." },
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
    const { data: equipamento, error } = await supabase
      .from("equipamentos")
      .insert({
        ...normalizarDadosEquipamento(dados.data),
        criado_por_user_id: resultado.usuarioAplicacao.id
      })
      .select(camposEquipamento)
      .single();

    if (error || !equipamento) {
      return NextResponse.json(
        {
          mensagem:
            error?.message ?? "Nao foi possivel criar o equipamento."
        },
        { status: 400 }
      );
    }

    const equipamentoCriado = equipamento as unknown as Equipamento;

    await supabase.from("auditoria").insert({
      user_id: resultado.usuarioAplicacao.id,
      acao: "criou_equipamento",
      entidade: "equipamentos",
      entidade_id: equipamentoCriado.id,
      dados_novos: equipamentoCriado
    });

    return NextResponse.json(
      { equipamento: equipamentoCriado },
      { status: 201 }
    );
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Nao foi possivel criar o equipamento.";

    return NextResponse.json({ mensagem }, { status: 503 });
  }
}
