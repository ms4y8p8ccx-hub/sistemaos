"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { NavegacaoApp } from "@/components/navegacao-app";
import { podeGerenciarUsuarios } from "@/lib/auth/permissoes";
import { obterConfiguracaoSupabase } from "@/lib/env";
import { criarClienteSupabaseBrowser } from "@/lib/supabase/browser";
import type { PapelSistema, UsuarioSistema } from "@/types";

type EstadoTela = "carregando" | "pronto" | "erro" | "configuracao";

export default function PaginaUsuarios(): JSX.Element {
  const router = useRouter();
  const configuracao = useMemo(() => obterConfiguracaoSupabase(), []);
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([]);
  const [perfis, setPerfis] = useState<PapelSistema[]>([]);
  const [usuarioAtual, setUsuarioAtual] = useState<UsuarioSistema | null>(null);
  const [estado, setEstado] = useState<EstadoTela>("carregando");
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [formulario, setFormulario] = useState({
    nome: "",
    email: "",
    senha: "",
    telefone: "",
    role_id: ""
  });

  const obterToken = useCallback(async (): Promise<string | null> => {
    const supabase = criarClienteSupabaseBrowser();
    const { data } = await supabase.auth.getSession();

    return data.session?.access_token ?? null;
  }, []);

  const carregarDados = useCallback(async (): Promise<void> => {
    if (!configuracao.configurado) {
      setEstado("configuracao");
      setMensagem("Configure o Supabase para gerenciar usuarios.");
      return;
    }

    const token = await obterToken();

    if (!token) {
      router.replace("/login");
      return;
    }

    const cabecalhos = {
      Authorization: `Bearer ${token}`
    };

    const respostaUsuario = await fetch("/api/me", { headers: cabecalhos });
    const corpoUsuario = (await respostaUsuario.json()) as {
      usuario?: UsuarioSistema;
      mensagem?: string;
    };

    if (!respostaUsuario.ok || !corpoUsuario.usuario) {
      setEstado("erro");
      setMensagem(corpoUsuario.mensagem ?? "Nao foi possivel carregar usuario.");
      return;
    }

    const perfil = corpoUsuario.usuario.role?.perfil;
    setUsuarioAtual(corpoUsuario.usuario);

    if (!perfil || !podeGerenciarUsuarios(perfil)) {
      setEstado("erro");
      setMensagem("Somente administradores podem gerenciar usuarios.");
      return;
    }

    const [respostaUsuarios, respostaPerfis] = await Promise.all([
      fetch("/api/usuarios", { headers: cabecalhos }),
      fetch("/api/perfis", { headers: cabecalhos })
    ]);

    const corpoUsuarios = (await respostaUsuarios.json()) as {
      usuarios?: UsuarioSistema[];
      mensagem?: string;
    };
    const corpoPerfis = (await respostaPerfis.json()) as {
      perfis?: PapelSistema[];
      mensagem?: string;
    };

    if (!respostaUsuarios.ok) {
      setEstado("erro");
      setMensagem(corpoUsuarios.mensagem ?? "Nao foi possivel listar usuarios.");
      return;
    }

    if (!respostaPerfis.ok) {
      setEstado("erro");
      setMensagem(corpoPerfis.mensagem ?? "Nao foi possivel listar perfis.");
      return;
    }

    setUsuarios(corpoUsuarios.usuarios ?? []);
    setPerfis(corpoPerfis.perfis ?? []);
    setFormulario((valorAtual) => ({
      ...valorAtual,
      role_id: valorAtual.role_id || corpoPerfis.perfis?.[0]?.id || ""
    }));
    setEstado("pronto");
  }, [configuracao.configurado, obterToken, router]);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);

  async function criarUsuario(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();
    setMensagem(null);
    setSalvando(true);

    try {
      const token = await obterToken();

      if (!token) {
        router.replace("/login");
        return;
      }

      const resposta = await fetch("/api/usuarios", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(formulario)
      });

      const corpo = (await resposta.json()) as {
        usuario?: UsuarioSistema;
        mensagem?: string;
      };

      if (!resposta.ok || !corpo.usuario) {
        setMensagem(corpo.mensagem ?? "Nao foi possivel criar o usuario.");
        return;
      }

      setUsuarios((listaAtual) => [...listaAtual, corpo.usuario as UsuarioSistema]);
      setFormulario({
        nome: "",
        email: "",
        senha: "",
        telefone: "",
        role_id: perfis[0]?.id ?? ""
      });
      setMensagem("Usuario criado com sucesso.");
    } catch (falha) {
      setMensagem(
        falha instanceof Error
          ? falha.message
          : "Nao foi possivel criar o usuario."
      );
    } finally {
      setSalvando(false);
    }
  }

  const perfilAtual = usuarioAtual?.role?.perfil;

  return (
    <main className="min-h-screen bg-fundo text-texto">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-suave-texto">
              Administracao
            </p>
            <h1 className="mt-1 text-2xl font-semibold">Usuarios e perfis</h1>
          </div>
          <Link
            className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium hover:bg-suave"
            href="/painel"
          >
            Voltar ao painel
          </Link>
        </div>
      </header>

      <NavegacaoApp perfil={perfilAtual} />

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[360px_1fr]">
        <form className="rounded-md border bg-white p-5" onSubmit={criarUsuario}>
          <h2 className="text-base font-semibold">Novo usuario</h2>
          <div className="mt-5 grid gap-4">
            <CampoTexto
              label="Nome"
              onChange={(valor) =>
                setFormulario((atual) => ({ ...atual, nome: valor }))
              }
              required
              value={formulario.nome}
            />
            <CampoTexto
              label="E-mail"
              onChange={(valor) =>
                setFormulario((atual) => ({ ...atual, email: valor }))
              }
              required
              type="email"
              value={formulario.email}
            />
            <CampoTexto
              label="Senha inicial"
              onChange={(valor) =>
                setFormulario((atual) => ({ ...atual, senha: valor }))
              }
              required
              type="password"
              value={formulario.senha}
            />
            <CampoTexto
              label="Telefone"
              onChange={(valor) =>
                setFormulario((atual) => ({ ...atual, telefone: valor }))
              }
              value={formulario.telefone}
            />

            <label className="grid gap-2 text-sm font-medium">
              Perfil
              <select
                className="h-10 rounded-md border bg-white px-3 text-sm outline-none ring-primario/20 transition focus:ring-4"
                onChange={(evento) =>
                  setFormulario((atual) => ({
                    ...atual,
                    role_id: evento.target.value
                  }))
                }
                required
                value={formulario.role_id}
              >
                {perfis.map((perfil) => (
                  <option key={perfil.id} value={perfil.id}>
                    {perfil.nome}
                  </option>
                ))}
              </select>
            </label>

            {mensagem ? (
              <p className="rounded-md border bg-suave px-3 py-2 text-sm text-suave-texto">
                {mensagem}
              </p>
            ) : null}

            <button
              className="h-10 rounded-md bg-primario px-4 text-sm font-semibold text-primario-texto transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={salvando || estado !== "pronto"}
              type="submit"
            >
              {salvando ? "Salvando..." : "Criar usuario"}
            </button>
          </div>
        </form>

        <section className="rounded-md border bg-white">
          <div className="border-b px-5 py-4">
            <h2 className="text-base font-semibold">Equipe cadastrada</h2>
          </div>

          {estado === "carregando" ? (
            <p className="p-5 text-sm text-suave-texto">Carregando usuarios...</p>
          ) : null}

          {estado === "configuracao" || estado === "erro" ? (
            <p className="p-5 text-sm text-suave-texto">
              {mensagem ?? "Nao foi possivel carregar a equipe."}
            </p>
          ) : null}

          {estado === "pronto" ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-left text-sm">
                <thead className="bg-suave/60 text-suave-texto">
                  <tr>
                    <th className="px-5 py-3 font-medium">Nome</th>
                    <th className="px-5 py-3 font-medium">E-mail</th>
                    <th className="px-5 py-3 font-medium">Perfil</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((usuario) => (
                    <tr className="border-t" key={usuario.id}>
                      <td className="px-5 py-3 font-medium">{usuario.nome}</td>
                      <td className="px-5 py-3 text-suave-texto">{usuario.email}</td>
                      <td className="px-5 py-3">{usuario.role?.nome ?? "Sem perfil"}</td>
                      <td className="px-5 py-3">
                        <span className="rounded-md bg-suave px-2 py-1 text-xs font-medium">
                          {usuario.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {usuarios.length === 0 ? (
                    <tr>
                      <td className="px-5 py-6 text-suave-texto" colSpan={4}>
                        Nenhum usuario cadastrado.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}

function CampoTexto({
  label,
  onChange,
  required,
  type = "text",
  value
}: {
  label: string;
  onChange: (valor: string) => void;
  required?: boolean;
  type?: string;
  value: string;
}): JSX.Element {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <input
        className="h-10 rounded-md border bg-white px-3 text-sm outline-none ring-primario/20 transition focus:ring-4"
        onChange={(evento) => onChange(evento.target.value)}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}
