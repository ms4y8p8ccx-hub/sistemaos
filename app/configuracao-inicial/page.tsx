"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { obterConfiguracaoSupabase } from "@/lib/env";
import { criarClienteSupabaseBrowser } from "@/lib/supabase/browser";

export default function PaginaConfiguracaoInicial(): JSX.Element {
  const router = useRouter();
  const configuracao = useMemo(() => obterConfiguracaoSupabase(), []);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function criarAdministrador(
    evento: FormEvent<HTMLFormElement>
  ): Promise<void> {
    evento.preventDefault();
    setMensagem(null);

    if (!configuracao.configurado) {
      setMensagem("Configure o Supabase em .env.local antes de continuar.");
      return;
    }

    setSalvando(true);

    try {
      const resposta = await fetch("/api/bootstrap/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ nome, email, senha })
      });

      const corpo = (await resposta.json()) as { mensagem?: string };

      if (!resposta.ok) {
        setMensagem(
          corpo.mensagem ?? "Nao foi possivel criar o administrador."
        );
        return;
      }

      const supabase = criarClienteSupabaseBrowser();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: senha
      });

      if (error) {
        setMensagem("Administrador criado. Entre pela tela de login.");
        router.push("/login");
        return;
      }

      router.push("/painel");
      router.refresh();
    } catch (falha) {
      setMensagem(
        falha instanceof Error
          ? falha.message
          : "Nao foi possivel criar o administrador."
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <main className="min-h-screen bg-fundo px-6 py-8 text-texto">
      <section className="mx-auto grid max-w-xl gap-6">
        <div className="border-b pb-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-suave-texto">
            Primeiro acesso
          </p>
          <h1 className="mt-2 text-3xl font-semibold">
            Criar administrador
          </h1>
          <p className="mt-3 text-sm leading-6 text-suave-texto">
            Esta etapa cria o primeiro usuario com acesso total ao sistema.
          </p>
        </div>

        <form className="grid gap-4 rounded-md border bg-white p-5" onSubmit={criarAdministrador}>
          <Campo
            label="Nome"
            onChange={setNome}
            required
            value={nome}
          />
          <Campo
            label="E-mail"
            onChange={setEmail}
            required
            type="email"
            value={email}
          />
          <Campo
            label="Senha"
            onChange={setSenha}
            required
            type="password"
            value={senha}
          />

          {mensagem ? (
            <p className="rounded-md border bg-suave px-3 py-2 text-sm text-suave-texto">
              {mensagem}
            </p>
          ) : null}

          {!configuracao.configurado ? (
            <p className="rounded-md border border-alerta/30 bg-alerta/10 px-3 py-2 text-sm text-alerta">
              Variaveis publicas do Supabase nao configuradas.
            </p>
          ) : null}

          <button
            className="h-10 rounded-md bg-primario px-4 text-sm font-semibold text-primario-texto transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={salvando}
            type="submit"
          >
            {salvando ? "Criando..." : "Criar administrador"}
          </button>
        </form>

        <Link className="text-sm font-medium text-primario" href="/login">
          Voltar ao login
        </Link>
      </section>
    </main>
  );
}

function Campo({
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
