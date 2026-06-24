import { z } from "zod";

export const schemaCriarUsuario = z.object({
  nome: z.string().min(3, "Informe o nome completo."),
  email: z.string().email("Informe um e-mail valido."),
  senha: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
  telefone: z.string().max(30).optional().or(z.literal("")),
  role_id: z.string().uuid("Selecione um perfil valido.")
});

export type DadosCriarUsuario = z.infer<typeof schemaCriarUsuario>;

export const schemaCriarPrimeiroAdministrador = schemaCriarUsuario.omit({
  role_id: true,
  telefone: true
});

export type DadosCriarPrimeiroAdministrador = z.infer<
  typeof schemaCriarPrimeiroAdministrador
>;
