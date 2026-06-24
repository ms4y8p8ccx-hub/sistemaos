"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { NavegacaoApp } from "@/components/navegacao-app";
import { obterConfiguracaoSupabase } from "@/lib/env";
import {
  perfisUsuarios,
  podeAbrirOrdemServico,
  podeGerenciarClientes,
  podeGerenciarConfiguracoes,
  podeGerenciarEquipamentos,
  podeGerenciarEstoque,
  podeGerenciarFinanceiro,
  podeGerenciarUsuarios,
  podeVerRelatorios
} from "@/lib/auth/permissoes";
import { criarClienteSupabaseBrowser } from "@/lib/supabase/browser";
import type { Auditoria, UsuarioSistema } from "@/types";

type EstadoTela = "carregando" | "pronto" | "erro" | "configuracao";

type ConfiguracaoLocal = {
  nomeOficina: string;
  telefone: string;
  email: string;
  cidade: string;
  textoGarantia: string;
};

type StatusAmbiente = {
  supabaseUrl: boolean;
  supabaseAnonKey: boolean;
  supabaseServiceRole: boolean;
  resend: boolean;
};

const configuracaoInicial: ConfiguracaoLocal = {
  nomeOficina: "Oficina Agricola",
  telefone: "",
  email: "",
  cidade: "",
  textoGarantia:
    "Garantia condicionada ao uso correto do equipamento e revisao conforme orientacao tecnica."
};

export default function PaginaConfiguracoes(): JSX.Element {
  const router = useRouter();
  const configuracao = useMemo(() => obterConfiguracaoSupabase(), []);
  const [estado, setEstado] = useState<EstadoTela>("carregando");
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<UsuarioSistema | null>(null);
  const [ambiente, setAmbiente] = useState<StatusAmbiente | null>(null);
  const [auditoria, setAuditoria] = useState<Auditoria[]>([]);
  const [formulario, setFormulario] =
    useState<ConfiguracaoLocal>(configuracaoInicial);

  const perfil = usuario?.role?.perfil;
  const podeGerenciar = Boolean(perfil && podeGerenciarConfiguracoes(perfil));

  const obterToken = useCallback(async (): Promise<string | null> => {
    const supabase = criarClienteSupabaseBrowser();
    const { data } = await supabase.auth.getSession();

    return data.session?.access_token ?? null;
  }, []);

  const carregarDados = useCallback(async (): Promise<void> => {
    if (!configuracao.configurado) {
      setEstado("configuracao");
      setMensagem("Configure o Supabase para acessar configuracoes.");
      return;
    }

    const token = await obterToken();

    if (!token) {
      router.replace("/login");
      return;
    }

    const respostaUsuario = await fetch("/api/me", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const corpoUsuario = (await respostaUsuario.json()) as {
      usuario?: UsuarioSistema;
      mensagem?: string;
    };

    if (!respostaUsuario.ok || !corpoUsuario.usuario) {
      setEstado("erro");
      setMensagem(corpoUsuario.mensagem ?? "Nao foi possivel carregar usuario.");
      return;
    }

    setUsuario(corpoUsuario.usuario);

    if (!podeGerenciarConfiguracoes(corpoUsuario.usuario.role?.perfil ?? "tecnico")) {
      setEstado("erro");
      setMensagem("Somente administradores acessam configuracoes.");
      return;
    }

    const respostaStatus = await fetch("/api/configuracoes/status", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const corpoStatus = (await respostaStatus.json()) as {
      ambiente?: StatusAmbiente;
      auditoria?: Auditoria[];
      mensagem?: string;
    };

    if (!respostaStatus.ok || !corpoStatus.ambiente) {
      setEstado("erro");
      setMensagem(corpoStatus.mensagem ?? "Nao foi possivel carregar ambiente.");
      return;
    }

    const armazenado = window.localStorage.getItem("configuracoes_oficina");
    if (armazenado) {
      setFormulario(JSON.parse(armazenado) as ConfiguracaoLocal);
    }

    setAmbiente(corpoStatus.ambiente);
    setAuditoria(corpoStatus.auditoria ?? []);
    setEstado("pronto");
  }, [configuracao.configurado, obterToken, router]);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);

  function atualizarCampo<K extends keyof ConfiguracaoLocal>(
    campo: K,
    valor: ConfiguracaoLocal[K]
  ): void {
    setFormulario((atual) => ({
      ...atual,
      [campo]: valor
    }));
  }

  function salvarConfiguracao(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault();
    window.localStorage.setItem(
      "configuracoes_oficina",
      JSON.stringify(formulario)
    );
    setMensagem("Configuracoes locais salvas neste navegador.");
  }

  return (
    <main className="min-h-screen bg-fundo text-texto">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-suave-texto">
              Configuracoes
            </p>
            <h1 className="mt-1 text-2xl font-semibold">Sistema e seguranca</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium hover:bg-suave"
              href="/usuarios"
            >
              Usuarios
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
        {mensagem ? (
          <p className="rounded-md border bg-suave px-4 py-3 text-sm text-suave-texto">
            {mensagem}
          </p>
        ) : null}

        {estado === "carregando" ? (
          <PainelMensagem texto="Carregando configuracoes..." />
        ) : null}

        {estado === "configuracao" || estado === "erro" ? (
          <PainelMensagem
            texto={mensagem ?? "Nao foi possivel carregar configuracoes."}
          />
        ) : null}

        {estado === "pronto" ? (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <Indicador
                titulo="Supabase URL"
                valor={ambiente?.supabaseUrl ? "ok" : "pendente"}
              />
              <Indicador
                titulo="Anon key"
                valor={ambiente?.supabaseAnonKey ? "ok" : "pendente"}
              />
              <Indicador
                titulo="Service role"
                valor={ambiente?.supabaseServiceRole ? "ok" : "pendente"}
              />
              <Indicador
                titulo="Resend"
                valor={ambiente?.resend ? "ok" : "opcional"}
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
              <form
                className="rounded-md border bg-white p-5"
                onSubmit={salvarConfiguracao}
              >
                <h2 className="text-base font-semibold">Dados da oficina</h2>
                <div className="mt-5 grid gap-4">
                  <CampoTexto
                    disabled={!podeGerenciar}
                    label="Nome"
                    onChange={(valor) => atualizarCampo("nomeOficina", valor)}
                    value={formulario.nomeOficina}
                  />
                  <CampoTexto
                    disabled={!podeGerenciar}
                    label="Telefone"
                    onChange={(valor) => atualizarCampo("telefone", valor)}
                    value={formulario.telefone}
                  />
                  <CampoTexto
                    disabled={!podeGerenciar}
                    label="E-mail"
                    onChange={(valor) => atualizarCampo("email", valor)}
                    value={formulario.email}
                  />
                  <CampoTexto
                    disabled={!podeGerenciar}
                    label="Cidade"
                    onChange={(valor) => atualizarCampo("cidade", valor)}
                    value={formulario.cidade}
                  />
                  <CampoArea
                    disabled={!podeGerenciar}
                    label="Texto de garantia"
                    onChange={(valor) => atualizarCampo("textoGarantia", valor)}
                    value={formulario.textoGarantia}
                  />
                  <button
                    className="h-10 rounded-md bg-primario px-4 text-sm font-semibold text-primario-texto disabled:opacity-60"
                    disabled={!podeGerenciar}
                    type="submit"
                  >
                    Salvar configuracoes locais
                  </button>
                </div>
              </form>

              <div className="grid content-start gap-6">
                <section className="rounded-md border bg-white">
                  <div className="border-b px-5 py-4">
                    <h2 className="text-base font-semibold">
                      Matriz de permissoes
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[820px] border-collapse text-left text-sm">
                      <thead className="bg-suave/60 text-suave-texto">
                        <tr>
                          <th className="px-5 py-3 font-medium">Perfil</th>
                          <th className="px-5 py-3 font-medium">Usuarios</th>
                          <th className="px-5 py-3 font-medium">Clientes</th>
                          <th className="px-5 py-3 font-medium">OS</th>
                          <th className="px-5 py-3 font-medium">Estoque</th>
                          <th className="px-5 py-3 font-medium">Financeiro</th>
                          <th className="px-5 py-3 font-medium">Relatorios</th>
                        </tr>
                      </thead>
                      <tbody>
                        {perfisUsuarios.map((perfilSistema) => (
                          <tr className="border-t" key={perfilSistema.perfil}>
                            <td className="px-5 py-3 font-medium">
                              {perfilSistema.nome}
                            </td>
                            <td className="px-5 py-3">
                              {rotuloBooleano(
                                podeGerenciarUsuarios(perfilSistema.perfil)
                              )}
                            </td>
                            <td className="px-5 py-3">
                              {rotuloBooleano(
                                podeGerenciarClientes(perfilSistema.perfil) ||
                                  podeGerenciarEquipamentos(perfilSistema.perfil)
                              )}
                            </td>
                            <td className="px-5 py-3">
                              {rotuloBooleano(
                                podeAbrirOrdemServico(perfilSistema.perfil)
                              )}
                            </td>
                            <td className="px-5 py-3">
                              {rotuloBooleano(
                                podeGerenciarEstoque(perfilSistema.perfil)
                              )}
                            </td>
                            <td className="px-5 py-3">
                              {rotuloBooleano(
                                podeGerenciarFinanceiro(perfilSistema.perfil)
                              )}
                            </td>
                            <td className="px-5 py-3">
                              {rotuloBooleano(
                                podeVerRelatorios(perfilSistema.perfil)
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="rounded-md border bg-white">
                  <div className="border-b px-5 py-4">
                    <h2 className="text-base font-semibold">Auditoria recente</h2>
                  </div>
                  <div className="grid gap-3 p-5">
                    {auditoria.map((registro) => (
                      <div className="rounded-md border p-4 text-sm" key={registro.id}>
                        <p className="font-medium">{registro.acao}</p>
                        <p className="mt-1 text-xs text-suave-texto">
                          {registro.entidade} - {registro.user?.nome ?? "Sistema"}
                        </p>
                        <p className="mt-1 text-xs text-suave-texto">
                          {formatarData(registro.criado_em)}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
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

function CampoTexto({
  disabled,
  label,
  onChange,
  value
}: {
  disabled?: boolean;
  label: string;
  onChange: (valor: string) => void;
  value: string;
}): JSX.Element {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <input
        className="h-10 rounded-md border bg-white px-3 text-sm outline-none ring-primario/20 transition focus:ring-4 disabled:bg-suave"
        disabled={disabled}
        onChange={(evento) => onChange(evento.target.value)}
        type="text"
        value={value}
      />
    </label>
  );
}

function CampoArea({
  disabled,
  label,
  onChange,
  value
}: {
  disabled?: boolean;
  label: string;
  onChange: (valor: string) => void;
  value: string;
}): JSX.Element {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <textarea
        className="min-h-32 rounded-md border bg-white px-3 py-2 text-sm outline-none ring-primario/20 transition focus:ring-4 disabled:bg-suave"
        disabled={disabled}
        onChange={(evento) => onChange(evento.target.value)}
        value={value}
      />
    </label>
  );
}

function rotuloBooleano(valor: boolean): JSX.Element {
  return (
    <span
      className={
        valor
          ? "rounded-md bg-primario/10 px-2 py-1 text-xs font-medium text-primario"
          : "rounded-md bg-suave px-2 py-1 text-xs font-medium text-suave-texto"
      }
    >
      {valor ? "Sim" : "Nao"}
    </span>
  );
}

function formatarData(valor: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(valor));
}
