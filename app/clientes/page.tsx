"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { NavegacaoApp } from "@/components/navegacao-app";
import { obterConfiguracaoSupabase } from "@/lib/env";
import { podeGerenciarClientes } from "@/lib/auth/permissoes";
import { criarClienteSupabaseBrowser } from "@/lib/supabase/browser";
import type { Cliente, TipoPessoa, UsuarioSistema } from "@/types";

type EstadoTela = "carregando" | "pronto" | "erro" | "configuracao";

type FormularioCliente = {
  tipo: TipoPessoa;
  nome: string;
  documento: string;
  email: string;
  telefone: string;
  celular: string;
  endereco_logradouro: string;
  endereco_numero: string;
  endereco_complemento: string;
  endereco_bairro: string;
  endereco_cidade: string;
  endereco_estado: string;
  endereco_cep: string;
  observacoes: string;
  ativo: boolean;
};

const formularioInicial: FormularioCliente = {
  tipo: "juridica",
  nome: "",
  documento: "",
  email: "",
  telefone: "",
  celular: "",
  endereco_logradouro: "",
  endereco_numero: "",
  endereco_complemento: "",
  endereco_bairro: "",
  endereco_cidade: "",
  endereco_estado: "",
  endereco_cep: "",
  observacoes: "",
  ativo: true
};

export default function PaginaClientes(): JSX.Element {
  const router = useRouter();
  const configuracao = useMemo(() => obterConfiguracaoSupabase(), []);
  const [estado, setEstado] = useState<EstadoTela>("carregando");
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [usuario, setUsuario] = useState<UsuarioSistema | null>(null);
  const [busca, setBusca] = useState("");
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [formulario, setFormulario] =
    useState<FormularioCliente>(formularioInicial);
  const [clienteEditandoId, setClienteEditandoId] = useState<string | null>(
    null
  );
  const [salvando, setSalvando] = useState(false);

  const perfil = usuario?.role?.perfil;
  const podeGerenciar = Boolean(perfil && podeGerenciarClientes(perfil));

  const obterToken = useCallback(async (): Promise<string | null> => {
    const supabase = criarClienteSupabaseBrowser();
    const { data } = await supabase.auth.getSession();

    return data.session?.access_token ?? null;
  }, []);

  const carregarClientes = useCallback(async (): Promise<void> => {
    if (!configuracao.configurado) {
      setEstado("configuracao");
      setMensagem("Configure o Supabase para gerenciar clientes.");
      return;
    }

    const token = await obterToken();

    if (!token) {
      router.replace("/login");
      return;
    }

    const parametros = new URLSearchParams({
      ativos: mostrarInativos ? "false" : "true"
    });

    if (busca.trim()) {
      parametros.set("busca", busca.trim());
    }

    const [respostaUsuario, respostaClientes] = await Promise.all([
      fetch("/api/me", {
        headers: { Authorization: `Bearer ${token}` }
      }),
      fetch(`/api/clientes?${parametros.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
    ]);

    const corpoUsuario = (await respostaUsuario.json()) as {
      usuario?: UsuarioSistema;
      mensagem?: string;
    };
    const corpoClientes = (await respostaClientes.json()) as {
      clientes?: Cliente[];
      mensagem?: string;
    };

    if (!respostaUsuario.ok || !corpoUsuario.usuario) {
      setEstado("erro");
      setMensagem(corpoUsuario.mensagem ?? "Nao foi possivel carregar o usuario.");
      return;
    }

    if (!respostaClientes.ok) {
      setEstado("erro");
      setMensagem(
        corpoClientes.mensagem ?? "Nao foi possivel carregar clientes."
      );
      return;
    }

    setUsuario(corpoUsuario.usuario);
    setClientes(corpoClientes.clientes ?? []);
    setEstado("pronto");
  }, [busca, configuracao.configurado, mostrarInativos, obterToken, router]);

  useEffect(() => {
    void carregarClientes();
  }, [carregarClientes]);

  function atualizarCampo<K extends keyof FormularioCliente>(
    campo: K,
    valor: FormularioCliente[K]
  ): void {
    setFormulario((atual) => ({
      ...atual,
      [campo]: valor
    }));
  }

  function preencherEdicao(cliente: Cliente): void {
    setClienteEditandoId(cliente.id);
    setFormulario({
      tipo: cliente.tipo,
      nome: cliente.nome,
      documento: cliente.documento ?? "",
      email: cliente.email ?? "",
      telefone: cliente.telefone ?? "",
      celular: cliente.celular ?? "",
      endereco_logradouro: cliente.endereco_logradouro ?? "",
      endereco_numero: cliente.endereco_numero ?? "",
      endereco_complemento: cliente.endereco_complemento ?? "",
      endereco_bairro: cliente.endereco_bairro ?? "",
      endereco_cidade: cliente.endereco_cidade ?? "",
      endereco_estado: cliente.endereco_estado ?? "",
      endereco_cep: cliente.endereco_cep ?? "",
      observacoes: cliente.observacoes ?? "",
      ativo: cliente.ativo
    });
    setMensagem(null);
  }

  function limparFormulario(): void {
    setFormulario(formularioInicial);
    setClienteEditandoId(null);
    setMensagem(null);
  }

  async function salvarCliente(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();
    setMensagem(null);
    setSalvando(true);

    try {
      const token = await obterToken();

      if (!token) {
        router.replace("/login");
        return;
      }

      const resposta = await fetch(
        clienteEditandoId ? `/api/clientes/${clienteEditandoId}` : "/api/clientes",
        {
          method: clienteEditandoId ? "PATCH" : "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(formulario)
        }
      );

      const corpo = (await resposta.json()) as {
        cliente?: Cliente;
        mensagem?: string;
      };

      if (!resposta.ok || !corpo.cliente) {
        setMensagem(corpo.mensagem ?? "Nao foi possivel salvar o cliente.");
        return;
      }

      setMensagem(
        clienteEditandoId
          ? "Cliente atualizado com sucesso."
          : "Cliente cadastrado com sucesso."
      );
      limparFormulario();
      await carregarClientes();
    } catch (falha) {
      setMensagem(
        falha instanceof Error
          ? falha.message
          : "Nao foi possivel salvar o cliente."
      );
    } finally {
      setSalvando(false);
    }
  }

  async function desativarCliente(cliente: Cliente): Promise<void> {
    setMensagem(null);
    setSalvando(true);

    try {
      const token = await obterToken();

      if (!token) {
        router.replace("/login");
        return;
      }

      const resposta = await fetch(`/api/clientes/${cliente.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const corpo = (await resposta.json()) as { mensagem?: string };

      if (!resposta.ok) {
        setMensagem(corpo.mensagem ?? "Nao foi possivel desativar o cliente.");
        return;
      }

      setMensagem("Cliente desativado.");
      await carregarClientes();
    } catch (falha) {
      setMensagem(
        falha instanceof Error
          ? falha.message
          : "Nao foi possivel desativar o cliente."
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <main className="min-h-screen bg-fundo text-texto">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-suave-texto">
              Cadastros
            </p>
            <h1 className="mt-1 text-2xl font-semibold">Clientes</h1>
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

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-6 xl:grid-cols-[420px_1fr]">
        <form className="rounded-md border bg-white p-5" onSubmit={salvarCliente}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">
              {clienteEditandoId ? "Editar cliente" : "Novo cliente"}
            </h2>
            {clienteEditandoId ? (
              <button
                className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-suave"
                onClick={limparFormulario}
                type="button"
              >
                Cancelar
              </button>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4">
            <label className="grid gap-2 text-sm font-medium">
              Tipo
              <select
                className="h-10 rounded-md border bg-white px-3 text-sm outline-none ring-primario/20 transition focus:ring-4"
                disabled={!podeGerenciar}
                onChange={(evento) =>
                  atualizarCampo("tipo", evento.target.value as TipoPessoa)
                }
                value={formulario.tipo}
              >
                <option value="juridica">Pessoa juridica</option>
                <option value="fisica">Pessoa fisica</option>
              </select>
            </label>

            <CampoTexto
              label="Nome"
              onChange={(valor) => atualizarCampo("nome", valor)}
              required
              value={formulario.nome}
              disabled={!podeGerenciar}
            />
            <CampoTexto
              label="Documento"
              onChange={(valor) => atualizarCampo("documento", valor)}
              value={formulario.documento}
              disabled={!podeGerenciar}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <CampoTexto
                label="Telefone"
                onChange={(valor) => atualizarCampo("telefone", valor)}
                value={formulario.telefone}
                disabled={!podeGerenciar}
              />
              <CampoTexto
                label="Celular"
                onChange={(valor) => atualizarCampo("celular", valor)}
                value={formulario.celular}
                disabled={!podeGerenciar}
              />
            </div>
            <CampoTexto
              label="E-mail"
              onChange={(valor) => atualizarCampo("email", valor)}
              type="email"
              value={formulario.email}
              disabled={!podeGerenciar}
            />

            <div className="grid gap-4 md:grid-cols-[1fr_110px]">
              <CampoTexto
                label="Endereco"
                onChange={(valor) =>
                  atualizarCampo("endereco_logradouro", valor)
                }
                value={formulario.endereco_logradouro}
                disabled={!podeGerenciar}
              />
              <CampoTexto
                label="Numero"
                onChange={(valor) => atualizarCampo("endereco_numero", valor)}
                value={formulario.endereco_numero}
                disabled={!podeGerenciar}
              />
            </div>
            <CampoTexto
              label="Complemento"
              onChange={(valor) =>
                atualizarCampo("endereco_complemento", valor)
              }
              value={formulario.endereco_complemento}
              disabled={!podeGerenciar}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <CampoTexto
                label="Bairro"
                onChange={(valor) => atualizarCampo("endereco_bairro", valor)}
                value={formulario.endereco_bairro}
                disabled={!podeGerenciar}
              />
              <CampoTexto
                label="Cidade"
                onChange={(valor) => atualizarCampo("endereco_cidade", valor)}
                value={formulario.endereco_cidade}
                disabled={!podeGerenciar}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-[90px_1fr]">
              <CampoTexto
                label="UF"
                maxLength={2}
                onChange={(valor) =>
                  atualizarCampo("endereco_estado", valor.toUpperCase())
                }
                value={formulario.endereco_estado}
                disabled={!podeGerenciar}
              />
              <CampoTexto
                label="CEP"
                onChange={(valor) => atualizarCampo("endereco_cep", valor)}
                value={formulario.endereco_cep}
                disabled={!podeGerenciar}
              />
            </div>

            <label className="grid gap-2 text-sm font-medium">
              Observacoes
              <textarea
                className="min-h-24 rounded-md border bg-white px-3 py-2 text-sm outline-none ring-primario/20 transition focus:ring-4 disabled:bg-suave"
                disabled={!podeGerenciar}
                onChange={(evento) =>
                  atualizarCampo("observacoes", evento.target.value)
                }
                value={formulario.observacoes}
              />
            </label>

            {clienteEditandoId ? (
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  checked={formulario.ativo}
                  disabled={!podeGerenciar}
                  onChange={(evento) =>
                    atualizarCampo("ativo", evento.target.checked)
                  }
                  type="checkbox"
                />
                Cliente ativo
              </label>
            ) : null}

            {mensagem ? (
              <p className="rounded-md border bg-suave px-3 py-2 text-sm text-suave-texto">
                {mensagem}
              </p>
            ) : null}

            {!podeGerenciar && estado === "pronto" ? (
              <p className="rounded-md border bg-suave px-3 py-2 text-sm text-suave-texto">
                Seu perfil pode consultar clientes, mas nao pode alterar
                cadastros.
              </p>
            ) : null}

            <button
              className="h-10 rounded-md bg-primario px-4 text-sm font-semibold text-primario-texto transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={salvando || estado !== "pronto" || !podeGerenciar}
              type="submit"
            >
              {salvando
                ? "Salvando..."
                : clienteEditandoId
                  ? "Salvar alteracoes"
                  : "Cadastrar cliente"}
            </button>
          </div>
        </form>

        <section className="rounded-md border bg-white">
          <div className="grid gap-4 border-b px-5 py-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <h2 className="text-base font-semibold">Clientes cadastrados</h2>
              <p className="mt-1 text-sm text-suave-texto">
                Consulte clientes ativos e prepare a base para equipamentos e
                ordens de servico.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                className="h-10 min-w-56 rounded-md border bg-white px-3 text-sm outline-none ring-primario/20 transition focus:ring-4"
                onChange={(evento) => setBusca(evento.target.value)}
                placeholder="Buscar por nome, documento ou e-mail"
                value={busca}
              />
              <button
                className="h-10 rounded-md border px-4 text-sm font-medium hover:bg-suave"
                onClick={() => void carregarClientes()}
                type="button"
              >
                Buscar
              </button>
              <label className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm">
                <input
                  checked={mostrarInativos}
                  onChange={(evento) =>
                    setMostrarInativos(evento.target.checked)
                  }
                  type="checkbox"
                />
                Inativos
              </label>
            </div>
          </div>

          {estado === "carregando" ? (
            <p className="p-5 text-sm text-suave-texto">Carregando clientes...</p>
          ) : null}

          {estado === "configuracao" || estado === "erro" ? (
            <p className="p-5 text-sm text-suave-texto">
              {mensagem ?? "Nao foi possivel carregar os clientes."}
            </p>
          ) : null}

          {estado === "pronto" ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                <thead className="bg-suave/60 text-suave-texto">
                  <tr>
                    <th className="px-5 py-3 font-medium">Cliente</th>
                    <th className="px-5 py-3 font-medium">Contato</th>
                    <th className="px-5 py-3 font-medium">Cidade</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((cliente) => (
                    <tr className="border-t" key={cliente.id}>
                      <td className="px-5 py-3">
                        <p className="font-medium">{cliente.nome}</p>
                        <p className="mt-1 text-xs text-suave-texto">
                          {cliente.tipo === "juridica"
                            ? "Pessoa juridica"
                            : "Pessoa fisica"}
                          {cliente.documento ? ` - ${cliente.documento}` : ""}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-suave-texto">
                        <p>{cliente.email ?? "Sem e-mail"}</p>
                        <p className="mt-1 text-xs">
                          {cliente.telefone ?? cliente.celular ?? "Sem telefone"}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-suave-texto">
                        {cliente.endereco_cidade
                          ? `${cliente.endereco_cidade}${
                              cliente.endereco_estado
                                ? `/${cliente.endereco_estado}`
                                : ""
                            }`
                          : "Nao informado"}
                      </td>
                      <td className="px-5 py-3">
                        <span className="rounded-md bg-suave px-2 py-1 text-xs font-medium">
                          {cliente.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-suave disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={!podeGerenciar || salvando}
                            onClick={() => preencherEdicao(cliente)}
                            type="button"
                          >
                            Editar
                          </button>
                          {cliente.ativo ? (
                            <button
                              className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-suave disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={!podeGerenciar || salvando}
                              onClick={() => void desativarCliente(cliente)}
                              type="button"
                            >
                              Desativar
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {clientes.length === 0 ? (
                    <tr>
                      <td className="px-5 py-6 text-suave-texto" colSpan={5}>
                        Nenhum cliente encontrado.
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
  disabled,
  label,
  maxLength,
  onChange,
  required,
  type = "text",
  value
}: {
  disabled?: boolean;
  label: string;
  maxLength?: number;
  onChange: (valor: string) => void;
  required?: boolean;
  type?: string;
  value: string;
}): JSX.Element {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <input
        className="h-10 rounded-md border bg-white px-3 text-sm outline-none ring-primario/20 transition focus:ring-4 disabled:bg-suave"
        disabled={disabled}
        maxLength={maxLength}
        onChange={(evento) => onChange(evento.target.value)}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}
