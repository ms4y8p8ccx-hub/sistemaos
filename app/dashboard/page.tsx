"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { NavegacaoApp } from "@/components/navegacao-app";
import { obterConfiguracaoSupabase } from "@/lib/env";
import { criarClienteSupabaseBrowser } from "@/lib/supabase/browser";
import {
  rotulosStatusOrdemServico,
  statusOrdensServico
} from "@/lib/validations/ordens-servico";
import type {
  OrdemServico,
  Produto,
  StatusOrdemServico,
  UsuarioSistema
} from "@/types";

type EstadoTela = "carregando" | "pronto" | "erro" | "configuracao";

type ResumoDashboard = {
  clientes: number;
  equipamentos: number;
  produtosCriticos: number;
  ordensAbertas: number;
  ordensConcluidas: number;
  receitasPendentes: number;
  despesasPendentes: number;
  saldoRealizado: number;
  osPorStatus: Array<{ status: StatusOrdemServico; total: number }>;
  produtosCriticosLista: Produto[];
  ordensRecentes: OrdemServico[];
};

const resumoInicial: ResumoDashboard = {
  clientes: 0,
  equipamentos: 0,
  produtosCriticos: 0,
  ordensAbertas: 0,
  ordensConcluidas: 0,
  receitasPendentes: 0,
  despesasPendentes: 0,
  saldoRealizado: 0,
  osPorStatus: [],
  produtosCriticosLista: [],
  ordensRecentes: []
};

export default function PaginaDashboard(): JSX.Element {
  const router = useRouter();
  const configuracao = useMemo(() => obterConfiguracaoSupabase(), []);
  const [estado, setEstado] = useState<EstadoTela>("carregando");
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<UsuarioSistema | null>(null);
  const [resumo, setResumo] = useState<ResumoDashboard>(resumoInicial);
  const perfil = usuario?.role?.perfil;

  const obterToken = useCallback(async (): Promise<string | null> => {
    const supabase = criarClienteSupabaseBrowser();
    const { data } = await supabase.auth.getSession();

    return data.session?.access_token ?? null;
  }, []);

  const carregarDados = useCallback(async (): Promise<void> => {
    if (!configuracao.configurado) {
      setEstado("configuracao");
      setMensagem("Configure o Supabase para abrir o dashboard.");
      return;
    }

    const token = await obterToken();

    if (!token) {
      router.replace("/login");
      return;
    }

    const [respostaUsuario, respostaResumo] = await Promise.all([
      fetch("/api/me", {
        headers: { Authorization: `Bearer ${token}` }
      }),
      fetch("/api/dashboard/resumo", {
        headers: { Authorization: `Bearer ${token}` }
      })
    ]);

    const corpoUsuario = (await respostaUsuario.json()) as {
      usuario?: UsuarioSistema;
      mensagem?: string;
    };
    const corpoResumo = (await respostaResumo.json()) as {
      resumo?: ResumoDashboard;
      mensagem?: string;
    };

    if (!respostaUsuario.ok || !corpoUsuario.usuario) {
      setEstado("erro");
      setMensagem(corpoUsuario.mensagem ?? "Nao foi possivel carregar usuario.");
      return;
    }

    if (!respostaResumo.ok || !corpoResumo.resumo) {
      setEstado("erro");
      setMensagem(corpoResumo.mensagem ?? "Nao foi possivel carregar dashboard.");
      return;
    }

    setUsuario(corpoUsuario.usuario);
    setResumo(corpoResumo.resumo);
    setEstado("pronto");
  }, [configuracao.configurado, obterToken, router]);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);

  const maiorStatus = Math.max(
    1,
    ...resumo.osPorStatus.map((item) => item.total)
  );

  return (
    <main className="min-h-screen bg-fundo text-texto">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-suave-texto">
              Dashboard
            </p>
            <h1 className="mt-1 text-2xl font-semibold">
              Visao geral da oficina
            </h1>
            {usuario ? (
              <p className="mt-1 text-sm text-suave-texto">
                {usuario.nome} - {usuario.role?.nome ?? "Sem perfil"}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium hover:bg-suave"
              href="/relatorios"
            >
              Relatorios
            </Link>
            <Link
              className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium hover:bg-suave"
              href="/painel"
            >
              Voltar ao painel
            </Link>
          </div>
        </div>
      </header>

      <NavegacaoApp perfil={perfil} />

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-6">
        {estado === "carregando" ? (
          <PainelMensagem texto="Carregando dashboard..." />
        ) : null}

        {estado === "configuracao" || estado === "erro" ? (
          <PainelMensagem texto={mensagem ?? "Nao foi possivel carregar dashboard."} />
        ) : null}

        {estado === "pronto" ? (
          <>
            <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
              <Indicador titulo="Clientes" valor={resumo.clientes.toString()} />
              <Indicador
                titulo="Equipamentos"
                valor={resumo.equipamentos.toString()}
              />
              <Indicador
                titulo="OS abertas"
                valor={resumo.ordensAbertas.toString()}
              />
              <Indicador
                titulo="OS concluidas"
                valor={resumo.ordensConcluidas.toString()}
              />
              <Indicador
                titulo="Estoque critico"
                valor={resumo.produtosCriticos.toString()}
              />
              <Indicador
                titulo="Saldo real"
                valor={formatarMoeda(resumo.saldoRealizado)}
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <section className="rounded-md border bg-white">
                <div className="border-b px-5 py-4">
                  <h2 className="text-base font-semibold">OS por status</h2>
                </div>
                <div className="grid gap-3 p-5">
                  {statusOrdensServico.map((status) => {
                    const total =
                      resumo.osPorStatus.find((item) => item.status === status)
                        ?.total ?? 0;

                    return (
                      <div className="grid gap-2" key={status}>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span>{rotulosStatusOrdemServico[status]}</span>
                          <strong>{total}</strong>
                        </div>
                        <div className="h-3 overflow-hidden rounded-md bg-suave">
                          <div
                            className="h-full rounded-md bg-primario"
                            style={{
                              width: `${Math.max(4, (total / maiorStatus) * 100)}%`
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-md border bg-white">
                <div className="border-b px-5 py-4">
                  <h2 className="text-base font-semibold">Financeiro</h2>
                </div>
                <div className="grid gap-3 p-5 text-sm">
                  <LinhaValor
                    label="Receitas pendentes"
                    valor={resumo.receitasPendentes}
                  />
                  <LinhaValor
                    label="Despesas pendentes"
                    valor={resumo.despesasPendentes}
                  />
                  <LinhaValor
                    destaque
                    label="Saldo realizado"
                    valor={resumo.saldoRealizado}
                  />
                  <Link
                    className="mt-2 inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium hover:bg-suave"
                    href="/financeiro"
                  >
                    Abrir financeiro
                  </Link>
                </div>
              </section>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <section className="rounded-md border bg-white">
                <div className="border-b px-5 py-4">
                  <h2 className="text-base font-semibold">OS recentes</h2>
                </div>
                <div className="grid gap-3 p-5">
                  {resumo.ordensRecentes.map((ordem) => (
                    <Link
                      className="rounded-md border p-4 text-sm hover:border-primario"
                      href="/ordens-servico"
                      key={ordem.id}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <strong>OS {ordem.numero}</strong>
                          <p className="mt-1 text-suave-texto">
                            {ordem.cliente?.nome ?? "Cliente"}
                          </p>
                        </div>
                        <span className="rounded-md bg-suave px-2 py-1 text-xs font-medium">
                          {rotulosStatusOrdemServico[ordem.status]}
                        </span>
                      </div>
                    </Link>
                  ))}
                  {resumo.ordensRecentes.length === 0 ? (
                    <p className="text-sm text-suave-texto">
                      Nenhuma OS recente.
                    </p>
                  ) : null}
                </div>
              </section>

              <section className="rounded-md border bg-white">
                <div className="border-b px-5 py-4">
                  <h2 className="text-base font-semibold">Estoque critico</h2>
                </div>
                <div className="grid gap-3 p-5">
                  {resumo.produtosCriticosLista.map((produto) => (
                    <div className="rounded-md border p-4 text-sm" key={produto.id}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <strong>{produto.nome}</strong>
                          <p className="mt-1 text-xs text-suave-texto">
                            {produto.codigo_sku}
                          </p>
                        </div>
                        <span className="rounded-md bg-alerta/10 px-2 py-1 text-xs font-medium text-alerta">
                          {produto.estoque_atual}/{produto.estoque_minimo}
                        </span>
                      </div>
                    </div>
                  ))}
                  {resumo.produtosCriticosLista.length === 0 ? (
                    <p className="text-sm text-suave-texto">
                      Nenhum produto critico.
                    </p>
                  ) : null}
                </div>
              </section>
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}

function PainelMensagem({ texto }: { texto: string }): JSX.Element {
  return (
    <section className="rounded-md border bg-white p-5">
      <p className="text-sm text-suave-texto">{texto}</p>
    </section>
  );
}

function Indicador({
  titulo,
  valor
}: {
  titulo: string;
  valor: string;
}): JSX.Element {
  return (
    <article className="rounded-md border bg-white p-4">
      <p className="text-sm text-suave-texto">{titulo}</p>
      <strong className="mt-2 block text-2xl font-semibold">{valor}</strong>
    </article>
  );
}

function LinhaValor({
  destaque,
  label,
  valor
}: {
  destaque?: boolean;
  label: string;
  valor: number;
}): JSX.Element {
  return (
    <div
      className={
        destaque
          ? "flex justify-between border-t pt-3 font-semibold"
          : "flex justify-between"
      }
    >
      <span>{label}</span>
      <span>{formatarMoeda(valor)}</span>
    </div>
  );
}

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(Number(valor));
}
