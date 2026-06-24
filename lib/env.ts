export type ConfiguracaoSupabase = {
  url: string;
  chaveAnonima: string;
  chaveServico?: string;
  resendApiKey?: string;
  resendFromEmail?: string;
  configurado: boolean;
  emailConfigurado: boolean;
};

export function obterConfiguracaoSupabase(): ConfiguracaoSupabase {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const chaveAnonima = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const chaveServico = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFromEmail = process.env.RESEND_FROM_EMAIL;

  return {
    url,
    chaveAnonima,
    chaveServico,
    resendApiKey,
    resendFromEmail,
    configurado: Boolean(url && chaveAnonima),
    emailConfigurado: Boolean(resendApiKey && resendFromEmail)
  };
}

export function exigirConfiguracaoSupabase(): ConfiguracaoSupabase {
  const configuracao = obterConfiguracaoSupabase();

  if (!configuracao.configurado) {
    throw new Error("Variaveis do Supabase nao foram configuradas.");
  }

  return configuracao;
}
