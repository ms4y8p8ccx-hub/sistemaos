import { obterConfiguracaoSupabase } from "@/lib/env";

export async function enviarEmailNotificacao(dados: {
  para: string | null | undefined;
  titulo: string;
  mensagem: string;
}): Promise<void> {
  const configuracao = obterConfiguracaoSupabase();

  if (!configuracao.emailConfigurado || !dados.para) {
    return;
  }

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${configuracao.resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: configuracao.resendFromEmail,
        to: dados.para,
        subject: dados.titulo,
        text: dados.mensagem
      })
    });
  } catch {
    // O e-mail transacional nao deve impedir a notificacao in-app.
  }
}
