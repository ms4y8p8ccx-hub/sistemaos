import type { SupabaseClient } from "@supabase/supabase-js";
import {
  podeExecutarOrdemServico,
  podeGerenciarOrdensServico
} from "@/lib/auth/permissoes";
import type {
  ItemOrdemServico,
  OrdemServico,
  PerfilUsuario,
  TipoItemOs
} from "@/types";

export const camposOrdemServico = [
  "id",
  "numero",
  "cliente_id",
  "equipamento_id",
  "status",
  "prioridade",
  "tecnico_responsavel_user_id",
  "relato_cliente",
  "diagnostico",
  "solucao",
  "observacoes_internas",
  "valor_mao_obra",
  "valor_pecas",
  "desconto",
  "valor_total",
  "aberta_em",
  "prevista_para",
  "concluida_em",
  "entregue_em",
  "criado_em",
  "atualizado_em",
  "cliente:clientes(id, nome, documento)",
  "equipamento:equipamentos(id, tipo, marca, modelo, numero_serie)"
].join(", ");

export const camposItemOrdemServico = [
  "id",
  "ordem_servico_id",
  "produto_id",
  "tipo",
  "descricao",
  "quantidade",
  "valor_unitario",
  "valor_total",
  "criado_em",
  "atualizado_em"
].join(", ");

export async function obterOrdemServicoPorId(
  supabase: SupabaseClient,
  id: string
): Promise<OrdemServico | null> {
  const { data, error } = await supabase
    .from("ordens_servico")
    .select(camposOrdemServico)
    .eq("id", id)
    .single();

  if (error || !data) {
    return null;
  }

  return data as unknown as OrdemServico;
}

export function usuarioPodeAcessarOrdemServico(
  perfil: PerfilUsuario,
  usuarioId: string,
  ordem: OrdemServico
): boolean {
  if (perfil === "tecnico") {
    return ordem.tecnico_responsavel_user_id === usuarioId;
  }

  return perfil === "administrador" || perfil === "gerente" || perfil === "atendente";
}

export function usuarioPodeAlterarExecucaoOrdemServico(
  perfil: PerfilUsuario,
  usuarioId: string,
  ordem: OrdemServico
): boolean {
  if (podeGerenciarOrdensServico(perfil)) {
    return true;
  }

  return (
    podeExecutarOrdemServico(perfil) &&
    ordem.tecnico_responsavel_user_id === usuarioId
  );
}

export async function listarItensOrdemServico(
  supabase: SupabaseClient,
  ordemServicoId: string
): Promise<ItemOrdemServico[]> {
  const { data, error } = await supabase
    .from("itens_os")
    .select(camposItemOrdemServico)
    .eq("ordem_servico_id", ordemServicoId)
    .order("criado_em", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data as unknown as ItemOrdemServico[];
}

export async function recalcularTotaisOrdemServico(
  supabase: SupabaseClient,
  ordemServicoId: string,
  usuarioId: string
): Promise<void> {
  const itens = await listarItensOrdemServico(supabase, ordemServicoId);

  const totais = itens.reduce(
    (acumulado, item) => {
      const tipo = item.tipo as TipoItemOs;
      const valor = Number(item.valor_total);

      if (tipo === "servico") {
        acumulado.valor_mao_obra += valor;
      } else {
        acumulado.valor_pecas += valor;
      }

      return acumulado;
    },
    {
      valor_mao_obra: 0,
      valor_pecas: 0
    }
  );

  await supabase
    .from("ordens_servico")
    .update({
      valor_mao_obra: totais.valor_mao_obra,
      valor_pecas: totais.valor_pecas,
      atualizado_por_user_id: usuarioId
    })
    .eq("id", ordemServicoId);
}
