import { z } from "zod";
import { limparTextoOpcional } from "@/lib/validations/clientes";

const textoOpcional = z.string().trim().max(255).optional().or(z.literal(""));

function numeroOpcional(valor: unknown): number | undefined {
  if (valor === "" || valor === null || valor === undefined) {
    return undefined;
  }

  if (typeof valor === "string") {
    const normalizado = valor.replace(",", ".");
    const numero = Number(normalizado);

    return Number.isFinite(numero) ? numero : undefined;
  }

  return typeof valor === "number" && Number.isFinite(valor)
    ? valor
    : undefined;
}

export const schemaEquipamento = z.object({
  cliente_id: z.string().uuid("Selecione um cliente valido."),
  tipo: z.string().trim().min(2, "Informe o tipo do equipamento.").max(120),
  marca: textoOpcional,
  modelo: textoOpcional,
  ano_fabricacao: z
    .preprocess(numeroOpcional, z.number().int().min(1900).max(2100).optional()),
  numero_serie: textoOpcional,
  placa: textoOpcional,
  horimetro: z.preprocess(numeroOpcional, z.number().min(0).optional()),
  observacoes: z.string().trim().max(2000).optional().or(z.literal("")),
  ativo: z.boolean().optional()
});

export type DadosEquipamento = z.infer<typeof schemaEquipamento>;

export function normalizarDadosEquipamento(
  dados: DadosEquipamento
): Record<string, unknown> {
  return {
    cliente_id: dados.cliente_id,
    tipo: dados.tipo.trim(),
    marca: limparTextoOpcional(dados.marca),
    modelo: limparTextoOpcional(dados.modelo),
    ano_fabricacao: dados.ano_fabricacao ?? null,
    numero_serie: limparTextoOpcional(dados.numero_serie),
    placa: limparTextoOpcional(dados.placa),
    horimetro: dados.horimetro ?? null,
    observacoes: limparTextoOpcional(dados.observacoes),
    ativo: dados.ativo ?? true
  };
}
