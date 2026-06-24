"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { NavegacaoApp } from "@/components/navegacao-app";
import { obterConfiguracaoSupabase } from "@/lib/env";
import { podeEnviarNotificacoes } from "@/lib/auth/permissoes";
import { criarClienteSupabaseBrowser } from "@/lib/supabase/browser";
import type {
  Notificacao,
  TipoNotificacao,
  UsuarioSistema
} from "@/types";

type EstadoTela = "carregando" | "pronto" | "erro" | "configuracao";

type FormularioNotificacao = {
  user_id: string;
  tipo: TipoNotificacao;
  titulo: string;
  mensagem: string;
  link: string;
};

const formularioInicial: FormularioNotificacao = {
  user_id: "",
  tipo: "info",
  titulo: "",
  mensagem: "",
  link: ""
};

export default function PaginaNotificacoes(): JSX.Element {
  const router = useRouter();
  const configuracao = useMemo(() => obterConfiguracaoSupabase(), []);
  const [estado, setEstado] = useState<EstadoTela>("carregando");
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<UsuarioSistema | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([]);
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [somenteNaoLidas, setSomenteNaoLidas] = useState(false);
  const [formulario, setFormulario] =
    useState<FormularioNotificacao>(formularioInicial);
  const [salvando, setSalvando] = useState(false);

  const perfil = usuario?.role?.perfil;
  const podeEnviar = Boolean(perfil && podeEnviarNotificacoes(perfil));
  const naoLidas = notificacoes.filter((notificacao) => !notificacao.lida_em);

  const obterToken = useCallback(async (): Promise<string | null> => {
    const supabase = criarClienteSupabaseBrowser();
    const { data } = await supabase.auth.getSession();

    return data.session?.access_token ?? null;
  }, []);

  const carregarDados = useCallback(async (): Promise<void> => {
    if (!configuracao.configurado) {
      setEstado("configuracao");
      setMensagem("Configure o Supabase para usar notificacoes.");
      return;
    }

    const token = await obterToken();

    if (!token) {
      router.replace("/login");
      return;
    }

    const parametros = new URLSearchParams({
      nao_lidas: somenteNaoLidas ? "true" : "false"
    });

    const [respostaUsuario, respostaNotificacoes] = await Promise.all([
      fetch("/api/me", {
        headers: { Authorization: `Bearer ${token}` }
      }),
      fetch(`/api/notificacoes?${parametros.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
    ]);

    const corpoUsuario = (await respostaUsuario.json()) as {
      usuario?: UsuarioSistema;
      mensagem?: string;
    };
    const corpoNotificacoes = (await respostaNotificacoes.json()) as {
      notificacoes?: Notificacao[];
      mensagem?: string;
    };

    if (!respostaUsuario.ok || !corpoUsuario.usuario) {
      setEstado("erro");
      setMensagem(corpoUsuario.mensagem ?? "Nao foi possivel carregar usuario.");
      return;
    }

    if (!respostaNotificacoes.ok) {
      setEstado("erro");
      setMensagem(
        corpoNotificacoes.mensagem ?? "Nao foi possivel carregar notificacoes."
      );
      return;
    }

    setUsuario(corpoUsuario.usuario);
    setNotificacoes(corpoNotificacoes.notificacoes ?? []);
    setEstado("pronto");

    if (podeEnviarNotificacoes(corpoUsuario.usuario.role?.perfil ?? "tecnico")) {
      const respostaOpcoes = await fetch("/api/notificacoes/opcoes", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const corpoOpcoes = (await respostaOpcoes.json()) as {
        usuarios?: UsuarioSistema[];
      };

      if (respostaOpcoes.ok) {
        const destinatarios = corpoOpcoes.usuarios ?? [];
        setUsuarios(destinatarios);
        setFormulario((atual) => ({
          ...atual,
          user_id: atual.user_id || destinatarios[0]?.id || ""
        }));
      }
    }
  }, [configuracao.configurado, obterToken, router, somenteNaoLidas]);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);

  useEffect(() => {
    if (!usuario || !configuracao.configurado) {
      return undefined;
    }

    const supabase = criarClienteSupabaseBrowser();
    const canal = supabase
      .channel(`notificacoes-${usuario.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notificacoes",
          filter: `user_id=eq.${usuario.id}`
        },
        () => {
          void carregarDados();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(canal);
    };
  }, [carregarDados, configuracao.configurado, usuario]);

  function atualizarCampo<K extends keyof FormularioNotificacao>(
    campo: K,
    valor: FormularioNotificacao[K]
  ): void {
    setFormulario((atual) => ({
      ...atual,
      [campo]: valor
    }));
  }

  async function enviarNotificacao(
    evento: FormEvent<HTMLFormElement>
  ): Promise<void> {
    evento.preventDefault();
    setMensagem(null);
    setSalvando(true);

    try {
      const token = await obterToken();

      if (!token) {
        router.replace("/login");
        return;
      }

      const resposta = await fetch("/api/notificacoes", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(formulario)
      });

      const corpo = (await resposta.json()) as {
        notificacao?: Notificacao;
        mensagem?: string;
      };

      if (!resposta.ok || !corpo.notificacao) {
        setMensagem(corpo.mensagem ?? "Nao foi possivel enviar notificacao.");
        return;
      }

      setMensagem("Notificacao enviada.");
      setFormulario((atual) => ({
        ...formularioInicial,
        user_id: atual.user_id
      }));
      await carregarDados();
    } catch (falha) {
      setMensagem(
        falha instanceof Error
          ? falha.message
          : "Nao foi possivel enviar notificacao."
      );
    } finally {
      setSalvando(false);
    }
  }

  async function marcarComoLida(notificacao: Notificacao): Promise<void> {
    setMensagem(null);

    try {
      const token = await obterToken();

      if (!token) {
        router.replace("/login");
        return;
      }

      const resposta = await fetch(`/api/notificacoes/${notificacao.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` }
      });

      const corpo = (await resposta.json()) as { mensagem?: string };

      if (!resposta.ok) {
        setMensagem(corpo.mensagem ?? "Nao foi possivel marcar como lida.");
        return;
      }

      await carregarDados();
    } catch (falha) {
      setMensagem(
        falha instanceof Error
          ? falha.message
          : "Nao foi possivel marcar como lida."
      );
    }
  }

  return (
    <main className="min-h-screen bg-fundo text-texto">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-suave-texto">
              Notificacoes
            </p>
            <h1 className="mt-1 text-2xl font-semibold">Avisos da equipe</h1>
          </div>
          <Link
            className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium hover:bg-suave"
            href="/painel"
          >
            Voltar ao painel
          </Link>
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
          <PainelMensagem texto="Carregando notificacoes..." />
        ) : null}

        {estado === "configuracao" || estado === "erro" ? (
          <PainelMensagem
            texto={mensagem ?? "Nao foi possivel carregar notificacoes."}
          />
        ) : null}

        {estado === "pronto" ? (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <Indicador titulo="Nao lidas" valor={naoLidas.length.toString()} />
              <Indicador titulo="Total" valor={notificacoes.length.toString()} />
              <Indicador
                titulo="Realtime"
                valor={configuracao.configurado ? "ativo" : "off"}
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
              <form
                className="rounded-md border bg-white p-5"
                onSubmit={enviarNotificacao}
              >
                <h2 className="text-base font-semibold">Enviar aviso</h2>
                <div className="mt-5 grid gap-4">
                  <label className="grid gap-2 text-sm font-medium">
                    Destinatario
                    <select
                      className="h-10 rounded-md border bg-white px-3 text-sm outline-none ring-primario/20 transition focus:ring-4 disabled:bg-suave"
                      disabled={!podeEnviar || usuarios.length === 0}
                      onChange={(evento) =>
                        atualizarCampo("user_id", evento.target.value)
                      }
                      required
                      value={formulario.user_id}
                    >
                      {usuarios.map((destinatario) => (
                        <option key={destinatario.id} value={destinatario.id}>
                          {destinatario.nome} - {destinatario.role?.nome}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-2 text-sm font-medium">
                    Tipo
                    <select
                      className="h-10 rounded-md border bg-white px-3 text-sm outline-none ring-primario/20 transition focus:ring-4 disabled:bg-suave"
                      disabled={!podeEnviar}
                      onChange={(evento) =>
                        atualizarCampo(
                          "tipo",
                          evento.target.value as TipoNotificacao
                        )
                      }
                      value={formulario.tipo}
                    >
                      <option value="info">Info</option>
                      <option value="sucesso">Sucesso</option>
                      <option value="alerta">Alerta</option>
                      <option value="erro">Erro</option>
                    </select>
                  </label>

                  <CampoTexto
                    disabled={!podeEnviar}
                    label="Titulo"
                    onChange={(valor) => atualizarCampo("titulo", valor)}
                    required
                    value={formulario.titulo}
                  />
                  <CampoArea
                    disabled={!podeEnviar}
                    label="Mensagem"
                    onChange={(valor) => atualizarCampo("mensagem", valor)}
                    value={formulario.mensagem}
                  />
                  <CampoTexto
                    disabled={!podeEnviar}
                    label="Link"
                    onChange={(valor) => atualizarCampo("link", valor)}
                    value={formulario.link}
                  />

                  <button
                    className="h-10 rounded-md bg-primario px-4 text-sm font-semibold text-primario-texto transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={salvando || !podeEnviar || !formulario.user_id}
                    type="submit"
                  >
                    {salvando ? "Enviando..." : "Enviar notificacao"}
                  </button>
                </div>
              </form>

              <section className="rounded-md border bg-white">
                <div className="grid gap-3 border-b px-5 py-4 md:grid-cols-[1fr_auto] md:items-center">
                  <div>
                    <h2 className="text-base font-semibold">Caixa de avisos</h2>
                    <p className="mt-1 text-sm text-suave-texto">
                      Acompanhe mensagens internas e alertas operacionais.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <label className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm">
                      <input
                        checked={somenteNaoLidas}
                        onChange={(evento) =>
                          setSomenteNaoLidas(evento.target.checked)
                        }
                        type="checkbox"
                      />
                      Nao lidas
                    </label>
                    <button
                      className="h-10 rounded-md border px-4 text-sm font-medium hover:bg-suave"
                      onClick={() => void carregarDados()}
                      type="button"
                    >
                      Atualizar
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 p-5">
                  {notificacoes.map((notificacao) => (
                    <article
                      className={
                        notificacao.lida_em
                          ? "rounded-md border p-4"
                          : "rounded-md border border-primario bg-primario/5 p-4"
                      }
                      key={notificacao.id}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <span className={classeTipo(notificacao.tipo)}>
                            {rotuloTipo(notificacao.tipo)}
                          </span>
                          <h3 className="mt-2 text-base font-semibold">
                            {notificacao.titulo}
                          </h3>
                          <p className="mt-1 text-sm text-suave-texto">
                            {notificacao.mensagem}
                          </p>
                        </div>
                        <span className="text-xs text-suave-texto">
                          {formatarData(notificacao.criado_em)}
                        </span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {notificacao.link ? (
                          <Link
                            className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-suave"
                            href={notificacao.link}
                          >
                            Abrir
                          </Link>
                        ) : null}
                        {!notificacao.lida_em ? (
                          <button
                            className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-suave"
                            onClick={() => void marcarComoLida(notificacao)}
                            type="button"
                          >
                            Marcar como lida
                          </button>
                        ) : null}
                      </div>
                    </article>
                  ))}
                  {notificacoes.length === 0 ? (
                    <p className="text-sm text-suave-texto">
                      Nenhuma notificacao encontrada.
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

function CampoTexto({
  disabled,
  label,
  onChange,
  required,
  value
}: {
  disabled?: boolean;
  label: string;
  onChange: (valor: string) => void;
  required?: boolean;
  value: string;
}): JSX.Element {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <input
        className="h-10 rounded-md border bg-white px-3 text-sm outline-none ring-primario/20 transition focus:ring-4 disabled:bg-suave"
        disabled={disabled}
        onChange={(evento) => onChange(evento.target.value)}
        required={required}
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
        className="min-h-28 rounded-md border bg-white px-3 py-2 text-sm outline-none ring-primario/20 transition focus:ring-4 disabled:bg-suave"
        disabled={disabled}
        onChange={(evento) => onChange(evento.target.value)}
        value={value}
      />
    </label>
  );
}

function rotuloTipo(tipo: TipoNotificacao): string {
  const rotulos: Record<TipoNotificacao, string> = {
    info: "Info",
    sucesso: "Sucesso",
    alerta: "Alerta",
    erro: "Erro"
  };

  return rotulos[tipo];
}

function classeTipo(tipo: TipoNotificacao): string {
  const classes: Record<TipoNotificacao, string> = {
    info: "rounded-md bg-suave px-2 py-1 text-xs font-medium text-suave-texto",
    sucesso: "rounded-md bg-primario/10 px-2 py-1 text-xs font-medium text-primario",
    alerta: "rounded-md bg-alerta/10 px-2 py-1 text-xs font-medium text-alerta",
    erro: "rounded-md bg-alerta px-2 py-1 text-xs font-medium text-alerta-texto"
  };

  return classes[tipo];
}

function formatarData(valor: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(valor));
}
