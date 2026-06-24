"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { NavegacaoApp } from "@/components/navegacao-app";
import { obterConfiguracaoSupabase } from "@/lib/env";
import {
  podeAbrirOrdemServico,
  podeGerenciarConfiguracoes,
  podeGerenciarUsuarios,
  podeVerClientes,
  podeVerEquipamentos,
  podeVerEstoque,
  podeVerFinanceiro,
  podeVerOrdensServico,
  podeVerRelatorios
} from "@/lib/auth/permissoes";
import { criarClienteSupabaseBrowser } from "@/lib/supabase/browser";
import type { UsuarioSistema } from "@/types";

type StatusTela = "carregando" | "pronto" | "configuracao" | "erro";

export default function PaginaPainel(): JSX.Element {
  const router = useRouter();
  const configuracao = useMemo(() => obterConfiguracaoSupabase(), []);
  const [usuario, setUsuario] = useState<UsuarioSistema | null>(null);
  const [status, setStatus] = useState<StatusTela>("carregando");
  const [mensagem, setMensagem] = useState<string | null>(null);

  useEffect(() => {
    async function carregarUsuario(): Promise<void> {
      if (!configuracao.configurado) {
        setStatus("configuracao");
        setMensagem("Configure as variaveis do Supabase para ativar o login.");
        return;
      }

      try {
        const supabase = criarClienteSupabaseBrowser();
        const { data } = await supabase.auth.getSession();

        if (!data.session) {
          router.replace("/login");
          return;
        }

        const resposta = await fetch("/api/me", {
          headers: {
            Authorization: `Bearer ${data.session.access_token}`
          }
        });

        const corpo = (await resposta.json()) as {
          usuario?: UsuarioSistema;
          mensagem?: string;
        };

        if (!resposta.ok || !corpo.usuario) {
          setStatus("erro");
          setMensagem(corpo.mensagem ?? "Nao foi possivel carregar o perfil.");
          return;
        }

        setUsuario(corpo.usuario);
        setStatus("pronto");
      } catch (falha) {
        setStatus("erro");
        setMensagem(
          falha instanceof Error
            ? falha.message
            : "Nao foi possivel abrir o painel."
        );
      }
    }

    void carregarUsuario();
  }, [configuracao.configurado, router]);

  async function sair(): Promise<void> {
    const supabase = criarClienteSupabaseBrowser();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const perfil = usuario?.role?.perfil;

  return (
    <main className="min-h-screen bg-fundo text-texto">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-suave-texto">
              Oficina agricola
            </p>
            <h1 className="mt-1 text-2xl font-semibold">Painel operacional</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {usuario ? (
              <span className="rounded-md border px-3 py-2 text-sm">
                {usuario.nome} - {usuario.role?.nome ?? "Sem perfil"}
              </span>
            ) : null}
            {usuario ? (
              <button
                className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-suave"
                onClick={sair}
                type="button"
              >
                Sair
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <NavegacaoApp perfil={perfil} />

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-6">
        {status === "carregando" ? (
          <MensagemPainel titulo="Carregando" texto="Validando sua sessao..." />
        ) : null}

        {status === "configuracao" || status === "erro" ? (
          <MensagemPainel
            titulo={status === "configuracao" ? "Configuracao pendente" : "Atencao"}
            texto={mensagem ?? "Nao foi possivel carregar o painel."}
          />
        ) : null}

        {status === "pronto" && usuario && perfil ? (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              {podeVerOrdensServico(perfil) ? (
                <CartaoIndicador
                  detalhe="Kanban ja disponivel"
                  href="/ordens-servico"
                  titulo="OS"
                  valor="+"
                />
              ) : null}
              {podeVerClientes(perfil) ? (
                <CartaoIndicador
                  detalhe="Cadastro ja disponivel"
                  href="/clientes"
                  titulo="Clientes"
                  valor="+"
                />
              ) : null}
              {podeVerEstoque(perfil) ? (
                <CartaoIndicador
                  detalhe="Pecas ja disponiveis"
                  href="/estoque"
                  titulo="Estoque"
                  valor="+"
                />
              ) : null}
              {podeVerFinanceiro(perfil) ? (
                <CartaoIndicador
                  detalhe="Contas e baixas"
                  href="/financeiro"
                  titulo="Financeiro"
                  valor="+"
                />
              ) : null}
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
              <section className="rounded-md border bg-white">
                <div className="border-b px-5 py-4">
                  <h2 className="text-base font-semibold">Fluxo de OS</h2>
                </div>
                <div className="grid gap-3 p-5 md:grid-cols-3">
                  {[
                    "Aberta",
                    "Em diagnostico",
                    "Aguardando peca",
                    "Em execucao",
                    "Aguardando aprovacao",
                    "Concluida"
                  ].map((statusOs) => (
                    <div className="min-h-24 rounded-md border bg-suave/40 p-3" key={statusOs}>
                      <p className="text-sm font-medium">{statusOs}</p>
                      <p className="mt-2 text-xs text-suave-texto">0 ordens</p>
                    </div>
                  ))}
                </div>
              </section>

              <aside className="rounded-md border bg-white">
                <div className="border-b px-5 py-4">
                  <h2 className="text-base font-semibold">Permissoes ativas</h2>
                </div>
                <div className="grid gap-3 p-5 text-sm">
                  <LinhaPermissao
                    ativo={podeVerClientes(perfil)}
                    texto="Consultar clientes"
                  />
                  <LinhaPermissao
                    ativo={podeVerEquipamentos(perfil)}
                    texto="Consultar equipamentos"
                  />
                  <LinhaPermissao
                    ativo={podeVerOrdensServico(perfil)}
                    texto="Consultar ordens de servico"
                  />
                  <LinhaPermissao
                    ativo={podeVerEstoque(perfil)}
                    texto="Consultar estoque"
                  />
                  <LinhaPermissao
                    ativo={podeAbrirOrdemServico(perfil)}
                    texto="Abrir ordem de servico"
                  />
                  <LinhaPermissao
                    ativo={podeGerenciarUsuarios(perfil)}
                    texto="Gerenciar usuarios"
                  />
                  <LinhaPermissao
                    ativo={podeVerFinanceiro(perfil)}
                    texto="Ver financeiro"
                  />
                  <LinhaPermissao
                    ativo={podeVerRelatorios(perfil)}
                    texto="Ver relatorios"
                  />
                  <LinhaPermissao
                    ativo={podeGerenciarConfiguracoes(perfil)}
                    texto="Gerenciar configuracoes"
                  />
                </div>
              </aside>
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}

function MensagemPainel({
  titulo,
  texto
}: {
  titulo: string;
  texto: string;
}): JSX.Element {
  return (
    <section className="rounded-md border bg-white p-5">
      <h2 className="text-base font-semibold">{titulo}</h2>
      <p className="mt-2 text-sm text-suave-texto">{texto}</p>
      <Link
        className="mt-4 inline-flex h-10 items-center rounded-md bg-primario px-4 text-sm font-semibold text-primario-texto"
        href="/login"
      >
        Ir para login
      </Link>
    </section>
  );
}

function CartaoIndicador({
  href,
  titulo,
  valor,
  detalhe
}: {
  href: string;
  titulo: string;
  valor: string;
  detalhe: string;
}): JSX.Element {
  return (
    <Link className="rounded-md border bg-white p-4 hover:border-primario" href={href}>
      <p className="text-sm text-suave-texto">{titulo}</p>
      <strong className="mt-2 block text-3xl font-semibold">{valor}</strong>
      <p className="mt-1 text-xs text-suave-texto">{detalhe}</p>
    </Link>
  );
}

function LinhaPermissao({
  ativo,
  texto
}: {
  ativo: boolean;
  texto: string;
}): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
      <span>{texto}</span>
      <span
        className={
          ativo
            ? "rounded-md bg-primario/15 px-2 py-1 text-xs font-medium text-primario"
            : "rounded-md bg-suave px-2 py-1 text-xs font-medium text-suave-texto"
        }
      >
        {ativo ? "Liberado" : "Restrito"}
      </span>
    </div>
  );
}
