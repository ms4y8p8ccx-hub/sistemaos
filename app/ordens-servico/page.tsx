"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { NavegacaoApp } from "@/components/navegacao-app";
import { obterConfiguracaoSupabase } from "@/lib/env";
import {
  podeAbrirOrdemServico,
  podeExecutarOrdemServico,
  podeGerenciarOrdensServico
} from "@/lib/auth/permissoes";
import { criarClienteSupabaseBrowser } from "@/lib/supabase/browser";
import {
  proximoStatusOrdemServico,
  rotulosStatusOrdemServico,
  statusOrdensServico
} from "@/lib/validations/ordens-servico";
import type {
  Cliente,
  Equipamento,
  ItemOrdemServico,
  OrdemServico,
  PrioridadeOrdemServico,
  StatusOrdemServico,
  TipoItemOs,
  UsuarioSistema
} from "@/types";

type EstadoTela = "carregando" | "pronto" | "erro" | "configuracao";

type FormularioOrdemServico = {
  cliente_id: string;
  equipamento_id: string;
  prioridade: PrioridadeOrdemServico;
  tecnico_responsavel_user_id: string;
  relato_cliente: string;
  prevista_para: string;
};

type FormularioDetalheOrdemServico = {
  prioridade: PrioridadeOrdemServico;
  tecnico_responsavel_user_id: string;
  relato_cliente: string;
  diagnostico: string;
  solucao: string;
  observacoes_internas: string;
  desconto: string;
  prevista_para: string;
};

type FormularioItem = {
  tipo: TipoItemOs;
  descricao: string;
  quantidade: string;
  valor_unitario: string;
};

const formularioOrdemInicial: FormularioOrdemServico = {
  cliente_id: "",
  equipamento_id: "",
  prioridade: "normal",
  tecnico_responsavel_user_id: "",
  relato_cliente: "",
  prevista_para: ""
};

const formularioItemInicial: FormularioItem = {
  tipo: "servico",
  descricao: "",
  quantidade: "1",
  valor_unitario: "0"
};

const statusKanban = statusOrdensServico.filter(
  (status) => status !== "entregue" && status !== "cancelada"
);

export default function PaginaOrdensServico(): JSX.Element {
  const router = useRouter();
  const configuracao = useMemo(() => obterConfiguracaoSupabase(), []);
  const [estado, setEstado] = useState<EstadoTela>("carregando");
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<UsuarioSistema | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [tecnicos, setTecnicos] = useState<UsuarioSistema[]>([]);
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [ordemSelecionada, setOrdemSelecionada] =
    useState<OrdemServico | null>(null);
  const [itens, setItens] = useState<ItemOrdemServico[]>([]);
  const [formularioOrdem, setFormularioOrdem] =
    useState<FormularioOrdemServico>(formularioOrdemInicial);
  const [formularioDetalhe, setFormularioDetalhe] =
    useState<FormularioDetalheOrdemServico | null>(null);
  const [formularioItem, setFormularioItem] =
    useState<FormularioItem>(formularioItemInicial);
  const [salvando, setSalvando] = useState(false);

  const perfil = usuario?.role?.perfil;
  const podeAbrir = Boolean(perfil && podeAbrirOrdemServico(perfil));
  const podeGerenciar = Boolean(perfil && podeGerenciarOrdensServico(perfil));
  const podeExecutar = Boolean(perfil && podeExecutarOrdemServico(perfil));
  const equipamentosDoCliente = equipamentos.filter(
    (equipamento) => equipamento.cliente_id === formularioOrdem.cliente_id
  );

  const obterToken = useCallback(async (): Promise<string | null> => {
    const supabase = criarClienteSupabaseBrowser();
    const { data } = await supabase.auth.getSession();

    return data.session?.access_token ?? null;
  }, []);

  const carregarDados = useCallback(async (): Promise<void> => {
    if (!configuracao.configurado) {
      setEstado("configuracao");
      setMensagem("Configure o Supabase para gerenciar ordens de servico.");
      return;
    }

    const token = await obterToken();

    if (!token) {
      router.replace("/login");
      return;
    }

    const [respostaUsuario, respostaOpcoes, respostaOrdens] =
      await Promise.all([
        fetch("/api/me", {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch("/api/ordens-servico/opcoes", {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch("/api/ordens-servico", {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

    const corpoUsuario = (await respostaUsuario.json()) as {
      usuario?: UsuarioSistema;
      mensagem?: string;
    };
    const corpoOpcoes = (await respostaOpcoes.json()) as {
      clientes?: Cliente[];
      equipamentos?: Equipamento[];
      tecnicos?: UsuarioSistema[];
      mensagem?: string;
    };
    const corpoOrdens = (await respostaOrdens.json()) as {
      ordens?: OrdemServico[];
      mensagem?: string;
    };

    if (!respostaUsuario.ok || !corpoUsuario.usuario) {
      setEstado("erro");
      setMensagem(corpoUsuario.mensagem ?? "Nao foi possivel carregar o usuario.");
      return;
    }

    if (!respostaOpcoes.ok) {
      setEstado("erro");
      setMensagem(corpoOpcoes.mensagem ?? "Nao foi possivel carregar opcoes.");
      return;
    }

    if (!respostaOrdens.ok) {
      setEstado("erro");
      setMensagem(corpoOrdens.mensagem ?? "Nao foi possivel carregar OS.");
      return;
    }

    const clientesAtivos = corpoOpcoes.clientes ?? [];
    const equipamentosAtivos = corpoOpcoes.equipamentos ?? [];
    const clienteInicialId = clientesAtivos[0]?.id ?? "";
    const equipamentoInicialId =
      equipamentosAtivos.find(
        (equipamento) => equipamento.cliente_id === clienteInicialId
      )?.id ?? "";

    setUsuario(corpoUsuario.usuario);
    setClientes(clientesAtivos);
    setEquipamentos(equipamentosAtivos);
    setTecnicos(corpoOpcoes.tecnicos ?? []);
    setOrdens(corpoOrdens.ordens ?? []);
    setFormularioOrdem((atual) => ({
      ...atual,
      cliente_id: atual.cliente_id || clienteInicialId,
      equipamento_id: atual.equipamento_id || equipamentoInicialId
    }));
    setEstado("pronto");
  }, [configuracao.configurado, obterToken, router]);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);

  function atualizarCampoOrdem<K extends keyof FormularioOrdemServico>(
    campo: K,
    valor: FormularioOrdemServico[K]
  ): void {
    setFormularioOrdem((atual) => {
      if (campo === "cliente_id") {
        const equipamentoInicial =
          equipamentos.find((equipamento) => equipamento.cliente_id === valor)
            ?.id ?? "";

        return {
          ...atual,
          cliente_id: valor as string,
          equipamento_id: equipamentoInicial
        };
      }

      return {
        ...atual,
        [campo]: valor
      };
    });
  }

  function atualizarCampoDetalhe<K extends keyof FormularioDetalheOrdemServico>(
    campo: K,
    valor: FormularioDetalheOrdemServico[K]
  ): void {
    setFormularioDetalhe((atual) =>
      atual
        ? {
            ...atual,
            [campo]: valor
          }
        : atual
    );
  }

  function atualizarCampoItem<K extends keyof FormularioItem>(
    campo: K,
    valor: FormularioItem[K]
  ): void {
    setFormularioItem((atual) => ({
      ...atual,
      [campo]: valor
    }));
  }

  async function carregarDetalhe(ordemId: string): Promise<void> {
    setMensagem(null);
    const token = await obterToken();

    if (!token) {
      router.replace("/login");
      return;
    }

    const resposta = await fetch(`/api/ordens-servico/${ordemId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const corpo = (await resposta.json()) as {
      ordem?: OrdemServico;
      itens?: ItemOrdemServico[];
      mensagem?: string;
    };

    if (!resposta.ok || !corpo.ordem) {
      setMensagem(corpo.mensagem ?? "Nao foi possivel carregar a OS.");
      return;
    }

    setOrdemSelecionada(corpo.ordem);
    setItens(corpo.itens ?? []);
    setFormularioDetalhe({
      prioridade: corpo.ordem.prioridade,
      tecnico_responsavel_user_id:
        corpo.ordem.tecnico_responsavel_user_id ?? "",
      relato_cliente: corpo.ordem.relato_cliente,
      diagnostico: corpo.ordem.diagnostico ?? "",
      solucao: corpo.ordem.solucao ?? "",
      observacoes_internas: corpo.ordem.observacoes_internas ?? "",
      desconto: corpo.ordem.desconto?.toString() ?? "0",
      prevista_para: corpo.ordem.prevista_para
        ? corpo.ordem.prevista_para.slice(0, 16)
        : ""
    });
  }

  async function abrirOrdemServico(
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

      const resposta = await fetch("/api/ordens-servico", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(formularioOrdem)
      });

      const corpo = (await resposta.json()) as {
        ordem?: OrdemServico;
        mensagem?: string;
      };

      if (!resposta.ok || !corpo.ordem) {
        setMensagem(corpo.mensagem ?? "Nao foi possivel abrir a OS.");
        return;
      }

      setMensagem(`OS ${corpo.ordem.numero} aberta com sucesso.`);
      setFormularioOrdem((atual) => ({
        ...formularioOrdemInicial,
        cliente_id: atual.cliente_id,
        equipamento_id: atual.equipamento_id
      }));
      await carregarDados();
      await carregarDetalhe(corpo.ordem.id);
    } catch (falha) {
      setMensagem(
        falha instanceof Error ? falha.message : "Nao foi possivel abrir a OS."
      );
    } finally {
      setSalvando(false);
    }
  }

  async function salvarDetalhe(): Promise<void> {
    if (!ordemSelecionada || !formularioDetalhe) {
      return;
    }

    setMensagem(null);
    setSalvando(true);

    try {
      const token = await obterToken();

      if (!token) {
        router.replace("/login");
        return;
      }

      const resposta = await fetch(`/api/ordens-servico/${ordemSelecionada.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(formularioDetalhe)
      });

      const corpo = (await resposta.json()) as {
        ordem?: OrdemServico;
        mensagem?: string;
      };

      if (!resposta.ok || !corpo.ordem) {
        setMensagem(corpo.mensagem ?? "Nao foi possivel salvar a OS.");
        return;
      }

      setMensagem("OS atualizada.");
      await carregarDados();
      await carregarDetalhe(corpo.ordem.id);
    } catch (falha) {
      setMensagem(
        falha instanceof Error ? falha.message : "Nao foi possivel salvar a OS."
      );
    } finally {
      setSalvando(false);
    }
  }

  async function alterarStatus(status: StatusOrdemServico): Promise<void> {
    if (!ordemSelecionada) {
      return;
    }

    setMensagem(null);
    setSalvando(true);

    try {
      const token = await obterToken();

      if (!token) {
        router.replace("/login");
        return;
      }

      const resposta = await fetch(
        `/api/ordens-servico/${ordemSelecionada.id}/status`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ status })
        }
      );

      const corpo = (await resposta.json()) as {
        ordem?: OrdemServico;
        mensagem?: string;
      };

      if (!resposta.ok || !corpo.ordem) {
        setMensagem(corpo.mensagem ?? "Nao foi possivel alterar status.");
        return;
      }

      setMensagem("Status atualizado.");
      await carregarDados();
      await carregarDetalhe(corpo.ordem.id);
    } catch (falha) {
      setMensagem(
        falha instanceof Error
          ? falha.message
          : "Nao foi possivel alterar status."
      );
    } finally {
      setSalvando(false);
    }
  }

  async function adicionarItem(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();

    if (!ordemSelecionada) {
      return;
    }

    setMensagem(null);
    setSalvando(true);

    try {
      const token = await obterToken();

      if (!token) {
        router.replace("/login");
        return;
      }

      const resposta = await fetch(
        `/api/ordens-servico/${ordemSelecionada.id}/itens`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(formularioItem)
        }
      );

      const corpo = (await resposta.json()) as {
        item?: ItemOrdemServico;
        mensagem?: string;
      };

      if (!resposta.ok || !corpo.item) {
        setMensagem(corpo.mensagem ?? "Nao foi possivel adicionar item.");
        return;
      }

      setFormularioItem(formularioItemInicial);
      setMensagem("Item adicionado.");
      await carregarDados();
      await carregarDetalhe(ordemSelecionada.id);
    } catch (falha) {
      setMensagem(
        falha instanceof Error
          ? falha.message
          : "Nao foi possivel adicionar item."
      );
    } finally {
      setSalvando(false);
    }
  }

  async function removerItem(item: ItemOrdemServico): Promise<void> {
    if (!ordemSelecionada) {
      return;
    }

    setMensagem(null);
    setSalvando(true);

    try {
      const token = await obterToken();

      if (!token) {
        router.replace("/login");
        return;
      }

      const resposta = await fetch(
        `/api/ordens-servico/${ordemSelecionada.id}/itens/${item.id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const corpo = (await resposta.json()) as { mensagem?: string };

      if (!resposta.ok) {
        setMensagem(corpo.mensagem ?? "Nao foi possivel remover item.");
        return;
      }

      setMensagem("Item removido.");
      await carregarDados();
      await carregarDetalhe(ordemSelecionada.id);
    } catch (falha) {
      setMensagem(
        falha instanceof Error
          ? falha.message
          : "Nao foi possivel remover item."
      );
    } finally {
      setSalvando(false);
    }
  }

  const proximoStatus = ordemSelecionada
    ? proximoStatusOrdemServico[ordemSelecionada.status]
    : undefined;
  const podeAlterarExecucao =
    podeGerenciar ||
    (podeExecutar &&
      ordemSelecionada?.tecnico_responsavel_user_id === usuario?.id);
  const podeCancelar =
    ordemSelecionada &&
    !["concluida", "entregue", "cancelada"].includes(ordemSelecionada.status);

  return (
    <main className="min-h-screen bg-fundo text-texto">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-suave-texto">
              Operacao
            </p>
            <h1 className="mt-1 text-2xl font-semibold">
              Ordens de servico
            </h1>
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
              href="/equipamentos"
            >
              Equipamentos
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
          <PainelMensagem texto="Carregando ordens de servico..." />
        ) : null}

        {estado === "configuracao" || estado === "erro" ? (
          <PainelMensagem
            texto={mensagem ?? "Nao foi possivel carregar as ordens."}
          />
        ) : null}

        {estado === "pronto" ? (
          <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
            <form
              className="rounded-md border bg-white p-5"
              onSubmit={abrirOrdemServico}
            >
              <h2 className="text-base font-semibold">Abrir OS</h2>
              <div className="mt-5 grid gap-4">
                <label className="grid gap-2 text-sm font-medium">
                  Cliente
                  <select
                    className="h-10 rounded-md border bg-white px-3 text-sm outline-none ring-primario/20 transition focus:ring-4 disabled:bg-suave"
                    disabled={!podeAbrir || clientes.length === 0}
                    onChange={(evento) =>
                      atualizarCampoOrdem("cliente_id", evento.target.value)
                    }
                    required
                    value={formularioOrdem.cliente_id}
                  >
                    {clientes.map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.nome}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm font-medium">
                  Equipamento
                  <select
                    className="h-10 rounded-md border bg-white px-3 text-sm outline-none ring-primario/20 transition focus:ring-4 disabled:bg-suave"
                    disabled={!podeAbrir || equipamentosDoCliente.length === 0}
                    onChange={(evento) =>
                      atualizarCampoOrdem("equipamento_id", evento.target.value)
                    }
                    required
                    value={formularioOrdem.equipamento_id}
                  >
                    {equipamentosDoCliente.map((equipamento) => (
                      <option key={equipamento.id} value={equipamento.id}>
                        {rotuloEquipamento(equipamento)}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                  <label className="grid gap-2 text-sm font-medium">
                    Prioridade
                    <select
                      className="h-10 rounded-md border bg-white px-3 text-sm outline-none ring-primario/20 transition focus:ring-4 disabled:bg-suave"
                      disabled={!podeAbrir}
                      onChange={(evento) =>
                        atualizarCampoOrdem(
                          "prioridade",
                          evento.target.value as PrioridadeOrdemServico
                        )
                      }
                      value={formularioOrdem.prioridade}
                    >
                      <option value="baixa">Baixa</option>
                      <option value="normal">Normal</option>
                      <option value="alta">Alta</option>
                      <option value="urgente">Urgente</option>
                    </select>
                  </label>

                  <label className="grid gap-2 text-sm font-medium">
                    Tecnico
                    <select
                      className="h-10 rounded-md border bg-white px-3 text-sm outline-none ring-primario/20 transition focus:ring-4 disabled:bg-suave"
                      disabled={!podeAbrir}
                      onChange={(evento) =>
                        atualizarCampoOrdem(
                          "tecnico_responsavel_user_id",
                          evento.target.value
                        )
                      }
                      value={formularioOrdem.tecnico_responsavel_user_id}
                    >
                      <option value="">Sem tecnico</option>
                      {tecnicos.map((tecnico) => (
                        <option key={tecnico.id} value={tecnico.id}>
                          {tecnico.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <CampoTexto
                  disabled={!podeAbrir}
                  label="Previsao"
                  onChange={(valor) =>
                    atualizarCampoOrdem("prevista_para", valor)
                  }
                  type="datetime-local"
                  value={formularioOrdem.prevista_para}
                />

                <label className="grid gap-2 text-sm font-medium">
                  Relato do cliente
                  <textarea
                    className="min-h-28 rounded-md border bg-white px-3 py-2 text-sm outline-none ring-primario/20 transition focus:ring-4 disabled:bg-suave"
                    disabled={!podeAbrir}
                    onChange={(evento) =>
                      atualizarCampoOrdem("relato_cliente", evento.target.value)
                    }
                    required
                    value={formularioOrdem.relato_cliente}
                  />
                </label>

                {clientes.length === 0 || equipamentos.length === 0 ? (
                  <p className="rounded-md border bg-suave px-3 py-2 text-sm text-suave-texto">
                    Cadastre cliente e equipamento antes de abrir uma OS.
                  </p>
                ) : null}

                <button
                  className="h-10 rounded-md bg-primario px-4 text-sm font-semibold text-primario-texto transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={
                    salvando ||
                    !podeAbrir ||
                    !formularioOrdem.cliente_id ||
                    !formularioOrdem.equipamento_id
                  }
                  type="submit"
                >
                  {salvando ? "Abrindo..." : "Abrir OS"}
                </button>
              </div>
            </form>

            <div className="grid gap-6">
              <section className="rounded-md border bg-white">
                <div className="border-b px-5 py-4">
                  <h2 className="text-base font-semibold">Kanban de OS</h2>
                </div>
                <div className="grid gap-3 overflow-x-auto p-5 lg:grid-cols-3 2xl:grid-cols-6">
                  {statusKanban.map((status) => {
                    const ordensStatus = ordens.filter(
                      (ordem) => ordem.status === status
                    );

                    return (
                      <div className="min-h-48 rounded-md border bg-suave/40" key={status}>
                        <div className="border-b px-3 py-2">
                          <h3 className="text-sm font-semibold">
                            {rotulosStatusOrdemServico[status]}
                          </h3>
                          <p className="mt-1 text-xs text-suave-texto">
                            {ordensStatus.length} OS
                          </p>
                        </div>
                        <div className="grid gap-2 p-2">
                          {ordensStatus.map((ordem) => (
                            <button
                              className="rounded-md border bg-white p-3 text-left text-sm hover:border-primario"
                              key={ordem.id}
                              onClick={() => void carregarDetalhe(ordem.id)}
                              type="button"
                            >
                              <strong>OS {ordem.numero}</strong>
                              <p className="mt-1 text-xs text-suave-texto">
                                {ordem.cliente?.nome ?? "Cliente"}
                              </p>
                              <p className="mt-1 text-xs text-suave-texto">
                                {ordem.equipamento
                                  ? rotuloEquipamento(ordem.equipamento)
                                  : "Equipamento"}
                              </p>
                              <p className="mt-2 text-xs font-medium">
                                {rotuloPrioridade(ordem.prioridade)}
                              </p>
                            </button>
                          ))}
                          {ordensStatus.length === 0 ? (
                            <p className="px-2 py-3 text-xs text-suave-texto">
                              Sem ordens.
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {ordemSelecionada && formularioDetalhe ? (
                <section className="rounded-md border bg-white">
                  <div className="grid gap-3 border-b px-5 py-4 lg:grid-cols-[1fr_auto] lg:items-start">
                    <div>
                      <h2 className="text-base font-semibold">
                        OS {ordemSelecionada.numero}
                      </h2>
                      <p className="mt-1 text-sm text-suave-texto">
                        {ordemSelecionada.cliente?.nome ?? "Cliente"} -{" "}
                        {ordemSelecionada.equipamento
                          ? rotuloEquipamento(ordemSelecionada.equipamento)
                          : "Equipamento"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        className="h-10 rounded-md border px-4 py-2 text-sm font-medium hover:bg-suave"
                        href={`/ordens-servico/${ordemSelecionada.id}/impressao`}
                      >
                        Imprimir OS
                      </Link>
                      {proximoStatus && podeAlterarExecucao ? (
                        <button
                          className="h-10 rounded-md bg-primario px-4 text-sm font-semibold text-primario-texto disabled:opacity-60"
                          disabled={salvando}
                          onClick={() => void alterarStatus(proximoStatus)}
                          type="button"
                        >
                          Avancar para{" "}
                          {rotulosStatusOrdemServico[proximoStatus]}
                        </button>
                      ) : null}
                      {podeCancelar && podeGerenciar ? (
                        <button
                          className="h-10 rounded-md border px-4 text-sm font-medium hover:bg-suave disabled:opacity-60"
                          disabled={salvando}
                          onClick={() => void alterarStatus("cancelada")}
                          type="button"
                        >
                          Cancelar
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-6 p-5 xl:grid-cols-[1fr_420px]">
                    <div className="grid gap-5">
                      <div className="grid gap-4 md:grid-cols-3">
                        <label className="grid gap-2 text-sm font-medium">
                          Prioridade
                          <select
                            className="h-10 rounded-md border bg-white px-3 text-sm outline-none ring-primario/20 transition focus:ring-4 disabled:bg-suave"
                            disabled={!podeGerenciar}
                            onChange={(evento) =>
                              atualizarCampoDetalhe(
                                "prioridade",
                                evento.target.value as PrioridadeOrdemServico
                              )
                            }
                            value={formularioDetalhe.prioridade}
                          >
                            <option value="baixa">Baixa</option>
                            <option value="normal">Normal</option>
                            <option value="alta">Alta</option>
                            <option value="urgente">Urgente</option>
                          </select>
                        </label>

                        <label className="grid gap-2 text-sm font-medium">
                          Tecnico
                          <select
                            className="h-10 rounded-md border bg-white px-3 text-sm outline-none ring-primario/20 transition focus:ring-4 disabled:bg-suave"
                            disabled={!podeGerenciar}
                            onChange={(evento) =>
                              atualizarCampoDetalhe(
                                "tecnico_responsavel_user_id",
                                evento.target.value
                              )
                            }
                            value={formularioDetalhe.tecnico_responsavel_user_id}
                          >
                            <option value="">Sem tecnico</option>
                            {tecnicos.map((tecnico) => (
                              <option key={tecnico.id} value={tecnico.id}>
                                {tecnico.nome}
                              </option>
                            ))}
                          </select>
                        </label>

                        <CampoTexto
                          disabled={!podeGerenciar}
                          label="Previsao"
                          onChange={(valor) =>
                            atualizarCampoDetalhe("prevista_para", valor)
                          }
                          type="datetime-local"
                          value={formularioDetalhe.prevista_para}
                        />
                      </div>

                      <CampoArea
                        disabled={!podeGerenciar}
                        label="Relato do cliente"
                        onChange={(valor) =>
                          atualizarCampoDetalhe("relato_cliente", valor)
                        }
                        value={formularioDetalhe.relato_cliente}
                      />
                      <CampoArea
                        disabled={!podeAlterarExecucao}
                        label="Diagnostico"
                        onChange={(valor) =>
                          atualizarCampoDetalhe("diagnostico", valor)
                        }
                        value={formularioDetalhe.diagnostico}
                      />
                      <CampoArea
                        disabled={!podeAlterarExecucao}
                        label="Solucao executada"
                        onChange={(valor) =>
                          atualizarCampoDetalhe("solucao", valor)
                        }
                        value={formularioDetalhe.solucao}
                      />
                      <CampoArea
                        disabled={!podeGerenciar}
                        label="Observacoes internas"
                        onChange={(valor) =>
                          atualizarCampoDetalhe("observacoes_internas", valor)
                        }
                        value={formularioDetalhe.observacoes_internas}
                      />
                      <div className="grid gap-4 md:grid-cols-[160px_auto] md:items-end">
                        <CampoTexto
                          disabled={!podeGerenciar}
                          label="Desconto"
                          onChange={(valor) =>
                            atualizarCampoDetalhe("desconto", valor)
                          }
                          type="number"
                          value={formularioDetalhe.desconto}
                        />
                        <button
                          className="h-10 rounded-md border px-4 text-sm font-medium hover:bg-suave disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={salvando || (!podeGerenciar && !podeAlterarExecucao)}
                          onClick={() => void salvarDetalhe()}
                          type="button"
                        >
                          Salvar dados da OS
                        </button>
                      </div>
                    </div>

                    <aside className="grid content-start gap-4">
                      <div className="rounded-md border p-4">
                        <h3 className="text-sm font-semibold">Orcamento</h3>
                        <div className="mt-3 grid gap-2 text-sm">
                          <LinhaValor
                            label="Mao de obra"
                            valor={ordemSelecionada.valor_mao_obra}
                          />
                          <LinhaValor
                            label="Pecas"
                            valor={ordemSelecionada.valor_pecas}
                          />
                          <LinhaValor
                            label="Desconto"
                            valor={ordemSelecionada.desconto}
                          />
                          <LinhaValor
                            destaque
                            label="Total"
                            valor={ordemSelecionada.valor_total}
                          />
                        </div>
                      </div>

                      <form
                        className="rounded-md border p-4"
                        onSubmit={adicionarItem}
                      >
                        <h3 className="text-sm font-semibold">Adicionar item</h3>
                        <div className="mt-3 grid gap-3">
                          <label className="grid gap-2 text-sm font-medium">
                            Tipo
                            <select
                              className="h-10 rounded-md border bg-white px-3 text-sm outline-none ring-primario/20 transition focus:ring-4 disabled:bg-suave"
                              disabled={!podeAlterarExecucao}
                              onChange={(evento) =>
                                atualizarCampoItem(
                                  "tipo",
                                  evento.target.value as TipoItemOs
                                )
                              }
                              value={formularioItem.tipo}
                            >
                              <option value="servico">Servico</option>
                              <option value="peca">Peca</option>
                            </select>
                          </label>
                          <CampoTexto
                            disabled={!podeAlterarExecucao}
                            label="Descricao"
                            onChange={(valor) =>
                              atualizarCampoItem("descricao", valor)
                            }
                            required
                            value={formularioItem.descricao}
                          />
                          <div className="grid gap-3 md:grid-cols-2">
                            <CampoTexto
                              disabled={!podeAlterarExecucao}
                              label="Quantidade"
                              onChange={(valor) =>
                                atualizarCampoItem("quantidade", valor)
                              }
                              required
                              type="number"
                              value={formularioItem.quantidade}
                            />
                            <CampoTexto
                              disabled={!podeAlterarExecucao}
                              label="Valor unitario"
                              onChange={(valor) =>
                                atualizarCampoItem("valor_unitario", valor)
                              }
                              required
                              type="number"
                              value={formularioItem.valor_unitario}
                            />
                          </div>
                          <button
                            className="h-10 rounded-md bg-primario px-4 text-sm font-semibold text-primario-texto transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={salvando || !podeAlterarExecucao}
                            type="submit"
                          >
                            Adicionar
                          </button>
                        </div>
                      </form>

                      <div className="rounded-md border">
                        <div className="border-b px-4 py-3">
                          <h3 className="text-sm font-semibold">Itens da OS</h3>
                        </div>
                        <div className="grid gap-2 p-3">
                          {itens.map((item) => (
                            <div
                              className="rounded-md border p-3 text-sm"
                              key={item.id}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-medium">
                                    {item.descricao}
                                  </p>
                                  <p className="mt-1 text-xs text-suave-texto">
                                    {item.tipo === "servico"
                                      ? "Servico"
                                      : "Peca"}{" "}
                                    - {item.quantidade} x{" "}
                                    {formatarMoeda(item.valor_unitario)}
                                  </p>
                                </div>
                                <strong>{formatarMoeda(item.valor_total)}</strong>
                              </div>
                              {podeAlterarExecucao ? (
                                <button
                                  className="mt-3 rounded-md border px-3 py-2 text-xs font-medium hover:bg-suave disabled:opacity-60"
                                  disabled={salvando}
                                  onClick={() => void removerItem(item)}
                                  type="button"
                                >
                                  Remover
                                </button>
                              ) : null}
                            </div>
                          ))}
                          {itens.length === 0 ? (
                            <p className="px-1 py-3 text-sm text-suave-texto">
                              Nenhum item adicionado.
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </aside>
                  </div>
                </section>
              ) : (
                <PainelMensagem texto="Selecione uma OS no Kanban para ver detalhes." />
              )}
            </div>
          </div>
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

function CampoTexto({
  disabled,
  label,
  onChange,
  required,
  type = "text",
  value
}: {
  disabled?: boolean;
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
        className="h-10 rounded-md border bg-white px-3 text-sm outline-none ring-primario/20 transition focus:ring-4 disabled:bg-suave"
        disabled={disabled}
        onChange={(evento) => onChange(evento.target.value)}
        required={required}
        type={type}
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
        className="min-h-24 rounded-md border bg-white px-3 py-2 text-sm outline-none ring-primario/20 transition focus:ring-4 disabled:bg-suave"
        disabled={disabled}
        onChange={(evento) => onChange(evento.target.value)}
        value={value}
      />
    </label>
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
          ? "flex justify-between border-t pt-2 font-semibold"
          : "flex justify-between"
      }
    >
      <span>{label}</span>
      <span>{formatarMoeda(valor)}</span>
    </div>
  );
}

function rotuloEquipamento(
  equipamento: Pick<Equipamento, "tipo" | "marca" | "modelo" | "numero_serie">
): string {
  return [
    equipamento.tipo,
    equipamento.marca,
    equipamento.modelo,
    equipamento.numero_serie ? `Serie ${equipamento.numero_serie}` : null
  ]
    .filter(Boolean)
    .join(" ");
}

function rotuloPrioridade(prioridade: PrioridadeOrdemServico): string {
  const rotulos: Record<PrioridadeOrdemServico, string> = {
    baixa: "Baixa",
    normal: "Normal",
    alta: "Alta",
    urgente: "Urgente"
  };

  return rotulos[prioridade];
}

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(Number(valor));
}
