"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { obterConfiguracaoSupabase } from "@/lib/env";
import { criarClienteSupabaseBrowser } from "@/lib/supabase/browser";

export default function PaginaLogin(): JSX.Element {
  const router = useRouter();
  const configuracao = useMemo(() => obterConfiguracaoSupabase(), []);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function entrar(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();
    setErro(null);

    if (!configuracao.configurado) {
      setErro("Configure o Supabase em .env.local antes de entrar.");
      return;
    }

    setCarregando(true);

    try {
      const supabase = criarClienteSupabaseBrowser();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: senha
      });

      if (error) {
        setErro("E-mail ou senha invalidos.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (falha) {
      setErro(
        falha instanceof Error
          ? falha.message
          : "Nao foi possivel iniciar a sessao."
      );
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-fundo text-texto lg:grid-cols-[minmax(320px,440px)_1fr]">
      <section className="flex min-h-screen flex-col justify-between border-r px-8 py-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-suave-texto">
            Oficina agricola
          </p>
          <h1 className="mt-3 text-3xl font-semibold">
            Gestao de ordens de servico
          </h1>
          <p className="mt-3 text-sm leading-6 text-suave-texto">
            Acesso operacional para equipe de atendimento, mecanica, estoque e
            financeiro.
          </p>
        </div>

        <form className="mt-10 flex flex-col gap-4" onSubmit={entrar}>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" htmlFor="email">
              E-mail
            </label>
            <input
              autoComplete="email"
              className="h-10 rounded-md border bg-white px-3 text-sm outline-none ring-primario/20 transition focus:ring-4"
              id="email"
              onChange={(evento) => setEmail(evento.target.value)}
              required
              type="email"
              value={email}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" htmlFor="senha">
              Senha
            </label>
            <input
              autoComplete="current-password"
              className="h-10 rounded-md border bg-white px-3 text-sm outline-none ring-primario/20 transition focus:ring-4"
              id="senha"
              onChange={(evento) => setSenha(evento.target.value)}
              required
              type="password"
              value={senha}
            />
          </div>

          {erro ? (
            <p className="rounded-md border border-alerta/30 bg-alerta/10 px-3 py-2 text-sm text-alerta">
              {erro}
            </p>
          ) : null}

          {!configuracao.configurado ? (
            <p className="rounded-md border bg-suave px-3 py-2 text-sm text-suave-texto">
              Supabase pendente: preencha `NEXT_PUBLIC_SUPABASE_URL` e
              `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
            </p>
          ) : null}

          <button
            className="h-10 rounded-md bg-primario px-4 text-sm font-semibold text-primario-texto transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={carregando}
            type="submit"
          >
            {carregando ? "Entrando..." : "Entrar"}
          </button>

          <Link
            className="text-sm font-medium text-primario"
            href="/configuracao-inicial"
          >
            Configurar primeiro administrador
          </Link>
        </form>

        <p className="pt-8 text-xs text-suave-texto">
          Perfis: administrador, gerente, tecnico, financeiro e atendente.
        </p>
      </section>

      <section className="hidden bg-suave/40 px-10 py-8 lg:block">
        <div className="grid h-full grid-rows-[auto_1fr] gap-8">
          <header className="flex items-center justify-between border-b pb-4">
            <span className="text-sm font-medium text-suave-texto">
              Sistema operacional
            </span>
            <span className="rounded-md border bg-white px-3 py-1 text-sm">
              Oficina agricola
            </span>
          </header>

          <div className="grid content-start gap-4">
            {[
              ["Ordens de servico", "Kanban, status, itens e impressao"],
              ["Cadastros", "Clientes, equipamentos e equipe"],
              ["Estoque", "Produtos, fornecedores e movimentacoes"],
              ["Financeiro", "Receitas, despesas, baixas e relatorios"]
            ].map(([titulo, descricao]) => (
              <article
                className="rounded-md border bg-white p-5"
                key={titulo}
              >
                <h2 className="text-base font-semibold">{titulo}</h2>
                <p className="mt-2 text-sm text-suave-texto">{descricao}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
