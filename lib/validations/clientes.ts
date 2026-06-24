import { z } from "zod";

const textoOpcional = z.string().trim().max(255).optional().or(z.literal(""));

export const schemaCliente = z.object({
  tipo: z.enum(["fisica", "juridica"]),
  nome: z.string().trim().min(3, "Informe o nome do cliente.").max(255),
  documento: textoOpcional,
  email: z
    .string()
    .trim()
    .email("Informe um e-mail valido.")
    .optional()
    .or(z.literal("")),
  telefone: textoOpcional,
  celular: textoOpcional,
  endereco_logradouro: textoOpcional,
  endereco_numero: textoOpcional,
  endereco_complemento: textoOpcional,
  endereco_bairro: textoOpcional,
  endereco_cidade: textoOpcional,
  endereco_estado: z
    .string()
    .trim()
    .length(2, "Use a sigla do estado.")
    .optional()
    .or(z.literal("")),
  endereco_cep: textoOpcional,
  observacoes: z.string().trim().max(2000).optional().or(z.literal("")),
  ativo: z.boolean().optional()
});

export type DadosCliente = z.infer<typeof schemaCliente>;

export function limparTextoOpcional(valor: string | undefined): string | null {
  const texto = valor?.trim();

  return texto ? texto : null;
}

export function normalizarDadosCliente(dados: DadosCliente): Record<string, unknown> {
  return {
    tipo: dados.tipo,
    nome: dados.nome.trim(),
    documento: limparTextoOpcional(dados.documento),
    email: limparTextoOpcional(dados.email),
    telefone: limparTextoOpcional(dados.telefone),
    celular: limparTextoOpcional(dados.celular),
    endereco_logradouro: limparTextoOpcional(dados.endereco_logradouro),
    endereco_numero: limparTextoOpcional(dados.endereco_numero),
    endereco_complemento: limparTextoOpcional(dados.endereco_complemento),
    endereco_bairro: limparTextoOpcional(dados.endereco_bairro),
    endereco_cidade: limparTextoOpcional(dados.endereco_cidade),
    endereco_estado: limparTextoOpcional(dados.endereco_estado)?.toUpperCase() ?? null,
    endereco_cep: limparTextoOpcional(dados.endereco_cep),
    observacoes: limparTextoOpcional(dados.observacoes),
    ativo: dados.ativo ?? true
  };
}
