import { NextResponse } from "next/server";
import { obterUsuarioDaRequisicao } from "@/lib/auth/servidor";
import {
  podeAbrirOrdemServico,
  podeVerOrdensServico
} from "@/lib/auth/permissoes";
import {
  camposOrdemServico,
  usuarioPodeAcessarOrdemServico
} from "@/lib/ordens-servico/dados";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/server";
import {
  normalizarCriacaoOrdemServico,
  schemaCriarOrdemServico
} from "@/lib/validations/ordens-servico";
import type { OrdemServico } from "@/types";

async function equipamentoPertenceAoCliente(
  clienteId: string,
  equipamentoId: string
): Promise<boolean> {
  const supabase = criarClienteSupabaseAdmin();
  const { data, error } = await supabase
    .from("equipamentos")
    .select("id")
    .eq("id", equipamentoId)
    .eq("cliente_id", clienteId)
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

    if (!perfil || !podeVerOrdensServico(perfil)) {
      return NextResponse.json(
        { mensagem: "Voce nao tem permissao para listar ordens de servico." },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const status = url.searchParams.get("status")?.trim();
    const clienteId = url.searchParams.get("cliente_id")?.trim();
    const equipamentoId = url.searchParams.get("equipamento_id")?.trim();
    const supabase = criarClienteSupabaseAdmin();

    let consulta = supabase
      .from("ordens_servico")
      .select(camposOrdemServico)
      .order("aberta_em", { ascending: false });

    if (status) {
      consulta = consulta.eq("status", status);
    }

    if (clienteId) {
      consulta = consulta.eq("cliente_id", clienteId);
    }

    if (equipamentoId) {
      consulta = consulta.eq("equipamento_id", equipamentoId);
    }

    if (perfil === "tecnico") {
      consulta = consulta.eq(
        "tecnico_responsavel_user_id",
        resultado.usuarioAplicacao.id
      );
    }

    const { data: ordens, error } = await consulta;

    if (error) {
      return NextResponse.json(
        { mensagem: "Nao foi possivel listar as ordens de servico." },
        { status: 500 }
      );
    }

    const ordensServico = (ordens ?? []) as unknown as OrdemServico[];
    const ordensPermitidas = ordensServico.filter((ordem) =>
      usuarioPodeAcessarOrdemServico(
        perfil,
        resultado.usuarioAplicacao.id,
        ordem
      )
    );

    return NextResponse.json({ ordens: ordensPermitidas });
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Nao foi possivel carregar as ordens de servico.";

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

    if (!perfil || !podeAbrirOrdemServico(perfil)) {
      return NextResponse.json(
        { mensagem: "Voce nao tem permissao para abrir OS." },
        { status: 403 }
      );
    }

    const corpo = await request.json();
    const dados = schemaCriarOrdemServico.safeParse(corpo);

    if (!dados.success) {
      return NextResponse.json(
        {
          mensagem: "Revise os dados da OS.",
          erros: dados.error.flatten().fieldErrors
        },
        { status: 422 }
      );
    }

    if (
      !(await equipamentoPertenceAoCliente(
        dados.data.cliente_id,
        dados.data.equipamento_id
      ))
    ) {
      return NextResponse.json(
        { mensagem: "Equipamento nao pertence ao cliente selecionado." },
        { status: 422 }
      );
    }

    const supabase = criarClienteSupabaseAdmin();
    const { data: ordem, error } = await supabase
      .from("ordens_servico")
      .insert({
        ...normalizarCriacaoOrdemServico(dados.data),
        criado_por_user_id: resultado.usuarioAplicacao.id,
        atualizado_por_user_id: resultado.usuarioAplicacao.id
      })
      .select(camposOrdemServico)
      .single();

    if (error || !ordem) {
      return NextResponse.json(
        { mensagem: error?.message ?? "Nao foi possivel abrir a OS." },
        { status: 400 }
      );
    }

    const ordemCriada = ordem as unknown as OrdemServico;

    await supabase.from("auditoria").insert({
      user_id: resultado.usuarioAplicacao.id,
      acao: "criou_ordem_servico",
      entidade: "ordens_servico",
      entidade_id: ordemCriada.id,
      dados_novos: ordemCriada
    });

    return NextResponse.json({ ordem: ordemCriada }, { status: 201 });
  } catch (erro) {
    const mensagem =
      erro instanceof Error ? erro.message : "Nao foi possivel abrir a OS.";

    return NextResponse.json({ mensagem }, { status: 503 });
  }
}
