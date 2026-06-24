"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { NavegacaoApp } from "@/components/navegacao-app";
import { obterConfiguracaoSupabase } from "@/lib/env";
import { podeGerenciarEquipamentos } from "@/lib/auth/permissoes";
import { criarClienteSupabaseBrowser } from "@/lib/supabase/browser";
import type { Cliente, Equipamento, UsuarioSistema } from "@/types";

type EstadoTela = "carregando" | "pronto" | "erro" | "configuracao";

type FormularioEquipamento = {
  cliente_id: string;
  tipo: string;
  marca: string;
  modelo: string;
  ano_fabricacao: string;
  numero_serie: string;
  placa: string;
  horimetro: string;
  observacoes: string;
  ativo: boolean;
};

const formularioInicial: FormularioEquipamento = {
  cliente_id: "",
  tipo: "",
  marca: "",
  modelo: "",
  ano_fabricacao: "",
  numero_serie: "",
  placa: "",
  horimetro: "",
  observacoes: "",
  ativo: true
};

export default function PaginaEquipamentos(): JSX.Element {
  const router = useRouter();
  const configuracao = useMemo(() => obterConfiguracaoSupabase(), []);
  const [estado, setEstado] = useState<EstadoTela>("carregando");
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<UsuarioSistema | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [busca, setBusca] = useState("");
  const [clienteFiltroId, setClienteFiltroId] = useState("");
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [formulario, setFormulario] =
    useState<FormularioEquipamento>(formularioInicial);
  const [equipamentoEditandoId, setEquipamentoEditandoId] = useState<
    string | null
  >(null);
  const [salvando, setSalvando] = useState(false);

  const perfil = usuario?.role?.perfil;
  const podeGerenciar = Boolean(perfil && podeGerenciarEquipamentos(perfil));

  const obterToken = useCallback(async (): Promise<string | null> => {
    const supabase = criarClienteSupabaseBrowser();
    const { data } = await supabase.auth.getSession();

    return data.session?.access_token ?? null;
  }, []);

  const carregarDados = useCallback(async (): Promise<void> => {
    if (!configuracao.configurado) {
      setEstado("configuracao");
      setMensagem("Configure o Supabase para gerenciar equipamentos.");
      return;
    }

    const token = await obterToken();

    if (!token) {
      router.replace("/login");
      return;
    }

    const parametrosEquipamentos = new URLSearchParams({
      ativos: mostrarInativos ? "false" : "true"
    });

    if (busca.trim()) {
      parametrosEquipamentos.set("busca", busca.trim());
    }

    if (clienteFiltroId) {
      parametrosEquipamentos.set("cliente_id", clienteFiltroId);
    }

    const [respostaUsuario, respostaClientes, respostaEquipamentos] =
      await Promise.all([
        fetch("/api/me", {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch("/api/clientes", {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`/api/equipamentos?${parametrosEquipamentos.toString()}`, {
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
    const corpoEquipamentos = (await respostaEquipamentos.json()) as {
      equipamentos?: Equipamento[];
      mensagem?: string;
    };

    if (!respostaUsuario.ok || !corpoUsuario.usuario) {
      setEstado("erro");
      setMensagem(corpoUsuario.mensagem ?? "Nao foi possivel carregar o usuario.");
      return;
    }

    if (!respostaClientes.ok) {
      setEstado("erro");
      setMensagem(corpoClientes.mensagem ?? "Nao foi possivel carregar clientes.");
      return;
    }

    if (!respostaEquipamentos.ok) {
      setEstado("erro");
      setMensagem(
        corpoEquipamentos.mensagem ??
          "Nao foi possivel carregar equipamentos."
      );
      return;
    }

    const clientesAtivos = corpoClientes.clientes ?? [];

    setUsuario(corpoUsuario.usuario);
    setClientes(clientesAtivos);
    setEquipamentos(corpoEquipamentos.equipamentos ?? []);
    setFormulario((valorAtual) => ({
      ...valorAtual,
      cliente_id: valorAtual.cliente_id || clientesAtivos[0]?.id || ""
    }));
    setEstado("pronto");
  }, [
    busca,
    clienteFiltroId,
    configuracao.configurado,
    mostrarInativos,
    obterToken,
    router
  ]);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);

  function atualizarCampo<K extends keyof FormularioEquipamento>(
    campo: K,
    valor: FormularioEquipamento[K]
  ): void {
    setFormulario((atual) => ({
      ...atual,
      [campo]: valor
    }));
  }

  function limparFormulario(): void {
    setFormulario({
      ...formularioInicial,
      cliente_id: clientes[0]?.id ?? ""
    });
    setEquipamentoEditandoId(null);
    setMensagem(null);
  }

  function preencherEdicao(equipamento: Equipamento): void {
    setEquipamentoEditandoId(equipamento.id);
    setFormulario({
      cliente_id: equipamento.cliente_id,
      tipo: equipamento.tipo,
      marca: equipamento.marca ?? "",
      modelo: equipamento.modelo ?? "",
      ano_fabricacao: equipamento.ano_fabricacao?.toString() ?? "",
      numero_serie: equipamento.numero_serie ?? "",
      placa: equipamento.placa ?? "",
      horimetro: equipamento.horimetro?.toString() ?? "",
      observacoes: equipamento.observacoes ?? "",
      ativo: equipamento.ativo
    });
    setMensagem(null);
  }

  async function salvarEquipamento(
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

      const resposta = await fetch(
        equipamentoEditandoId
          ? `/api/equipamentos/${equipamentoEditandoId}`
          : "/api/equipamentos",
        {
          method: equipamentoEditandoId ? "PATCH" : "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(formulario)
        }
      );

      const corpo = (await resposta.json()) as {
        equipamento?: Equipamento;
        mensagem?: string;
      };

      if (!resposta.ok || !corpo.equipamento) {
        setMensagem(corpo.mensagem ?? "Nao foi possivel salvar o equipamento.");
        return;
      }

      setMensagem(
        equipamentoEditandoId
          ? "Equipamento atualizado com sucesso."
          : "Equipamento cadastrado com sucesso."
      );
      limparFormulario();
      await carregarDados();
    } catch (falha) {
      setMensagem(
        falha instanceof Error
          ? falha.message
          : "Nao foi possivel salvar o equipamento."
      );
    } finally {
      setSalvando(false);
    }
  }

  async function desativarEquipamento(
    equipamento: Equipamento
  ): Promise<void> {
    setMensagem(null);
    setSalvando(true);

    try {
      const token = await obterToken();

      if (!token) {
        router.replace("/login");
        return;
      }

      const resposta = await fetch(`/api/equipamentos/${equipamento.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const corpo = (await resposta.json()) as { mensagem?: string };

      if (!resposta.ok) {
        setMensagem(
          corpo.mensagem ?? "Nao foi possivel desativar o equipamento."
        );
        return;
      }

      setMensagem("Equipamento desativado.");
      await carregarDados();
    } catch (falha) {
      setMensagem(
        falha instanceof Error
          ? falha.message
          : "Nao foi possivel desativar o equipamento."
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
            <h1 className="mt-1 text-2xl font-semibold">Equipamentos</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium hover:bg-suave"
              href="/clientes"
            >
              Clientes
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

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-6 xl:grid-cols-[420px_1fr]">
        <form
          className="rounded-md border bg-white p-5"
          onSubmit={salvarEquipamento}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">
              {equipamentoEditandoId ? "Editar equipamento" : "Novo equipamento"}
            </h2>
            {equipamentoEditandoId ? (
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
              Cliente
              <select
                className="h-10 rounded-md border bg-white px-3 text-sm outline-none ring-primario/20 transition focus:ring-4 disabled:bg-suave"
                disabled={!podeGerenciar || clientes.length === 0}
                onChange={(evento) =>
                  atualizarCampo("cliente_id", evento.target.value)
                }
                required
                value={formulario.cliente_id}
              >
                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nome}
                  </option>
                ))}
              </select>
            </label>

            <CampoTexto
              disabled={!podeGerenciar}
              label="Tipo"
              onChange={(valor) => atualizarCampo("tipo", valor)}
              placeholder="Trator, colheitadeira, pulverizador..."
              required
              value={formulario.tipo}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <CampoTexto
                disabled={!podeGerenciar}
                label="Marca"
                onChange={(valor) => atualizarCampo("marca", valor)}
                value={formulario.marca}
              />
              <CampoTexto
                disabled={!podeGerenciar}
                label="Modelo"
                onChange={(valor) => atualizarCampo("modelo", valor)}
                value={formulario.modelo}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <CampoTexto
                disabled={!podeGerenciar}
                label="Ano"
                maxLength={4}
                onChange={(valor) => atualizarCampo("ano_fabricacao", valor)}
                type="number"
                value={formulario.ano_fabricacao}
              />
              <CampoTexto
                disabled={!podeGerenciar}
                label="Horimetro"
                onChange={(valor) => atualizarCampo("horimetro", valor)}
                type="number"
                value={formulario.horimetro}
              />
            </div>

            <CampoTexto
              disabled={!podeGerenciar}
              label="Numero de serie"
              onChange={(valor) => atualizarCampo("numero_serie", valor)}
              value={formulario.numero_serie}
            />
            <CampoTexto
              disabled={!podeGerenciar}
              label="Placa"
              onChange={(valor) => atualizarCampo("placa", valor)}
              value={formulario.placa}
            />

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

            {equipamentoEditandoId ? (
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  checked={formulario.ativo}
                  disabled={!podeGerenciar}
                  onChange={(evento) =>
                    atualizarCampo("ativo", evento.target.checked)
                  }
                  type="checkbox"
                />
                Equipamento ativo
              </label>
            ) : null}

            {mensagem ? (
              <p className="rounded-md border bg-suave px-3 py-2 text-sm text-suave-texto">
                {mensagem}
              </p>
            ) : null}

            {clientes.length === 0 && estado === "pronto" ? (
              <p className="rounded-md border bg-suave px-3 py-2 text-sm text-suave-texto">
                Cadastre um cliente ativo antes de adicionar equipamentos.
              </p>
            ) : null}

            {!podeGerenciar && estado === "pronto" ? (
              <p className="rounded-md border bg-suave px-3 py-2 text-sm text-suave-texto">
                Seu perfil pode consultar equipamentos, mas nao pode alterar
                cadastros.
              </p>
            ) : null}

            <button
              className="h-10 rounded-md bg-primario px-4 text-sm font-semibold text-primario-texto transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={
                salvando ||
                estado !== "pronto" ||
                !podeGerenciar ||
                clientes.length === 0
              }
              type="submit"
            >
              {salvando
                ? "Salvando..."
                : equipamentoEditandoId
                  ? "Salvar alteracoes"
                  : "Cadastrar equipamento"}
            </button>
          </div>
        </form>

        <section className="rounded-md border bg-white">
          <div className="grid gap-4 border-b px-5 py-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <h2 className="text-base font-semibold">
                Equipamentos cadastrados
              </h2>
              <p className="mt-1 text-sm text-suave-texto">
                Relacione tratores, maquinas e implementos aos clientes.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                className="h-10 min-w-52 rounded-md border bg-white px-3 text-sm outline-none ring-primario/20 transition focus:ring-4"
                onChange={(evento) => setBusca(evento.target.value)}
                placeholder="Buscar tipo, marca, modelo, serie"
                value={busca}
              />
              <select
                className="h-10 rounded-md border bg-white px-3 text-sm outline-none ring-primario/20 transition focus:ring-4"
                onChange={(evento) => setClienteFiltroId(evento.target.value)}
                value={clienteFiltroId}
              >
                <option value="">Todos os clientes</option>
                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nome}
                  </option>
                ))}
              </select>
              <button
                className="h-10 rounded-md border px-4 text-sm font-medium hover:bg-suave"
                onClick={() => void carregarDados()}
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
            <p className="p-5 text-sm text-suave-texto">
              Carregando equipamentos...
            </p>
          ) : null}

          {estado === "configuracao" || estado === "erro" ? (
            <p className="p-5 text-sm text-suave-texto">
              {mensagem ?? "Nao foi possivel carregar os equipamentos."}
            </p>
          ) : null}

          {estado === "pronto" ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                <thead className="bg-suave/60 text-suave-texto">
                  <tr>
                    <th className="px-5 py-3 font-medium">Equipamento</th>
                    <th className="px-5 py-3 font-medium">Cliente</th>
                    <th className="px-5 py-3 font-medium">Identificacao</th>
                    <th className="px-5 py-3 font-medium">Horimetro</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {equipamentos.map((equipamento) => (
                    <tr className="border-t" key={equipamento.id}>
                      <td className="px-5 py-3">
                        <p className="font-medium">{equipamento.tipo}</p>
                        <p className="mt-1 text-xs text-suave-texto">
                          {[equipamento.marca, equipamento.modelo]
                            .filter(Boolean)
                            .join(" ")}
                          {equipamento.ano_fabricacao
                            ? ` - ${equipamento.ano_fabricacao}`
                            : ""}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-suave-texto">
                        {equipamento.cliente?.nome ?? "Cliente nao informado"}
                      </td>
                      <td className="px-5 py-3 text-suave-texto">
                        <p>{equipamento.numero_serie ?? "Sem serie"}</p>
                        <p className="mt-1 text-xs">
                          {equipamento.placa ?? "Sem placa"}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-suave-texto">
                        {equipamento.horimetro ?? "Nao informado"}
                      </td>
                      <td className="px-5 py-3">
                        <span className="rounded-md bg-suave px-2 py-1 text-xs font-medium">
                          {equipamento.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-suave disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={!podeGerenciar || salvando}
                            onClick={() => preencherEdicao(equipamento)}
                            type="button"
                          >
                            Editar
                          </button>
                          {equipamento.ativo ? (
                            <button
                              className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-suave disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={!podeGerenciar || salvando}
                              onClick={() =>
                                void desativarEquipamento(equipamento)
                              }
                              type="button"
                            >
                              Desativar
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {equipamentos.length === 0 ? (
                    <tr>
                      <td className="px-5 py-6 text-suave-texto" colSpan={6}>
                        Nenhum equipamento encontrado.
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
  placeholder,
  required,
  type = "text",
  value
}: {
  disabled?: boolean;
  label: string;
  maxLength?: number;
  onChange: (valor: string) => void;
  placeholder?: string;
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
        placeholder={placeholder}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}
