"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { NavegacaoApp } from "@/components/navegacao-app";
import { obterConfiguracaoSupabase } from "@/lib/env";
import { podeGerenciarFinanceiro } from "@/lib/auth/permissoes";
import { criarClienteSupabaseBrowser } from "@/lib/supabase/browser";
import type {
  Cliente,
  Fornecedor,
  LancamentoFinanceiro,
  OrdemServico,
  StatusLancamentoFinanceiro,
  TipoLancamentoFinanceiro,
  UsuarioSistema
} from "@/types";

type EstadoTela = "carregando" | "pronto" | "erro" | "configuracao";

type FormularioLancamento = {
  ordem_servico_id: string;
  cliente_id: string;
  fornecedor_id: string;
  tipo: TipoLancamentoFinanceiro;
  status: StatusLancamentoFinanceiro;
  categoria: string;
  descricao: string;
  valor: string;
  data_vencimento: string;
  data_pagamento: string;
  metodo_pagamento: string;
  observacao: string;
};

type ResumoFinanceiro = {
  receitasPendentes: number;
  receitasPagas: number;
  despesasPendentes: number;
  despesasPagas: number;
  saldoRealizado: number;
  saldoPrevisto: number;
};

const formularioInicial: FormularioLancamento = {
  ordem_servico_id: "",
  cliente_id: "",
  fornecedor_id: "",
  tipo: "receita",
  status: "pendente",
  categoria: "OS",
  descricao: "",
  valor: "0",
  data_vencimento: "",
  data_pagamento: "",
  metodo_pagamento: "",
  observacao: ""
};

const resumoInicial: ResumoFinanceiro = {
  receitasPendentes: 0,
  receitasPagas: 0,
  despesasPendentes: 0,
  despesasPagas: 0,
  saldoRealizado: 0,
  saldoPrevisto: 0
};

export default function PaginaFinanceiro(): JSX.Element {
  const router = useRouter();
  const configuracao = useMemo(() => obterConfiguracaoSupabase(), []);
  const [estado, setEstado] = useState<EstadoTela>("carregando");
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<UsuarioSistema | null>(null);
  const [lancamentos, setLancamentos] = useState<LancamentoFinanceiro[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [resumo, setResumo] = useState<ResumoFinanceiro>(resumoInicial);
  const [formulario, setFormulario] =
    useState<FormularioLancamento>(formularioInicial);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [busca, setBusca] = useState("");

  const perfil = usuario?.role?.perfil;
  const podeGerenciar = Boolean(perfil && podeGerenciarFinanceiro(perfil));

  const obterToken = useCallback(async (): Promise<string | null> => {
    const supabase = criarClienteSupabaseBrowser();
    const { data } = await supabase.auth.getSession();

    return data.session?.access_token ?? null;
  }, []);

  const carregarDados = useCallback(async (): Promise<void> => {
    if (!configuracao.configurado) {
      setEstado("configuracao");
      setMensagem("Configure o Supabase para usar o financeiro.");
      return;
    }

    const token = await obterToken();

    if (!token) {
      router.replace("/login");
      return;
    }

    const parametros = new URLSearchParams({
      status: filtroStatus,
      tipo: filtroTipo
    });

    if (busca.trim()) {
      parametros.set("busca", busca.trim());
    }

    const [respostaUsuario, respostaOpcoes, respostaLancamentos] =
      await Promise.all([
        fetch("/api/me", {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch("/api/financeiro/opcoes", {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`/api/financeiro/lancamentos?${parametros.toString()}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

    const corpoUsuario = (await respostaUsuario.json()) as {
      usuario?: UsuarioSistema;
      mensagem?: string;
    };
    const corpoOpcoes = (await respostaOpcoes.json()) as {
      clientes?: Cliente[];
      fornecedores?: Fornecedor[];
      ordens?: OrdemServico[];
      mensagem?: string;
    };
    const corpoLancamentos = (await respostaLancamentos.json()) as {
      lancamentos?: LancamentoFinanceiro[];
      resumo?: ResumoFinanceiro;
      mensagem?: string;
    };

    if (!respostaUsuario.ok || !corpoUsuario.usuario) {
      setEstado("erro");
      setMensagem(corpoUsuario.mensagem ?? "Nao foi possivel carregar usuario.");
      return;
    }

    if (!respostaOpcoes.ok) {
      setEstado("erro");
      setMensagem(corpoOpcoes.mensagem ?? "Nao foi possivel carregar opcoes.");
      return;
    }

    if (!respostaLancamentos.ok) {
      setEstado("erro");
      setMensagem(
        corpoLancamentos.mensagem ?? "Nao foi possivel carregar lancamentos."
      );
      return;
    }

    setUsuario(corpoUsuario.usuario);
    setClientes(corpoOpcoes.clientes ?? []);
    setFornecedores(corpoOpcoes.fornecedores ?? []);
    setOrdens(corpoOpcoes.ordens ?? []);
    setLancamentos(corpoLancamentos.lancamentos ?? []);
    setResumo(corpoLancamentos.resumo ?? resumoInicial);
    setEstado("pronto");
  }, [
    busca,
    configuracao.configurado,
    filtroStatus,
    filtroTipo,
    obterToken,
    router
  ]);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);

  function atualizarCampo<K extends keyof FormularioLancamento>(
    campo: K,
    valor: FormularioLancamento[K]
  ): void {
    setFormulario((atual) => {
      if (campo === "tipo") {
        const tipo = valor as TipoLancamentoFinanceiro;

        return {
          ...atual,
          tipo,
          categoria: tipo === "receita" ? "OS" : "Pecas e insumos",
          fornecedor_id: tipo === "receita" ? "" : atual.fornecedor_id,
          cliente_id: tipo === "despesa" ? "" : atual.cliente_id,
          ordem_servico_id: tipo === "despesa" ? "" : atual.ordem_servico_id
        };
      }

      if (campo === "ordem_servico_id") {
        const ordem = ordens.find((item) => item.id === valor);

        return {
          ...atual,
          ordem_servico_id: valor as string,
          cliente_id: ordem?.cliente_id ?? atual.cliente_id,
          descricao: ordem
            ? `Recebimento OS ${ordem.numero}`
            : atual.descricao,
          valor: ordem ? String(ordem.valor_total) : atual.valor
        };
      }

      return {
        ...atual,
        [campo]: valor
      };
    });
  }

  function preencherEdicao(lancamento: LancamentoFinanceiro): void {
    setEditandoId(lancamento.id);
    setFormulario({
      ordem_servico_id: lancamento.ordem_servico_id ?? "",
      cliente_id: lancamento.cliente_id ?? "",
      fornecedor_id: lancamento.fornecedor_id ?? "",
      tipo: lancamento.tipo,
      status: lancamento.status,
      categoria: lancamento.categoria,
      descricao: lancamento.descricao,
      valor: String(lancamento.valor),
      data_vencimento: lancamento.data_vencimento ?? "",
      data_pagamento: lancamento.data_pagamento ?? "",
      metodo_pagamento: lancamento.metodo_pagamento ?? "",
      observacao: lancamento.observacao ?? ""
    });
    setMensagem(null);
  }

  function limparFormulario(): void {
    setEditandoId(null);
    setFormulario(formularioInicial);
  }

  async function salvarLancamento(
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
        editandoId
          ? `/api/financeiro/lancamentos/${editandoId}`
          : "/api/financeiro/lancamentos",
        {
          method: editandoId ? "PATCH" : "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(formulario)
        }
      );

      const corpo = (await resposta.json()) as {
        lancamento?: LancamentoFinanceiro;
        mensagem?: string;
      };

      if (!resposta.ok || !corpo.lancamento) {
        setMensagem(corpo.mensagem ?? "Nao foi possivel salvar lancamento.");
        return;
      }

      setMensagem(editandoId ? "Lancamento atualizado." : "Lancamento criado.");
      limparFormulario();
      await carregarDados();
    } catch (falha) {
      setMensagem(
        falha instanceof Error
          ? falha.message
          : "Nao foi possivel salvar lancamento."
      );
    } finally {
      setSalvando(false);
    }
  }

  async function baixarLancamento(lancamento: LancamentoFinanceiro): Promise<void> {
    setMensagem(null);
    setSalvando(true);

    try {
      const token = await obterToken();

      if (!token) {
        router.replace("/login");
        return;
      }

      const hoje = new Date().toISOString().slice(0, 10);
      const resposta = await fetch(
        `/api/financeiro/lancamentos/${lancamento.id}/baixa`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            data_pagamento: hoje,
            metodo_pagamento: lancamento.metodo_pagamento || "A confirmar"
          })
        }
      );

      const corpo = (await resposta.json()) as { mensagem?: string };

      if (!resposta.ok) {
        setMensagem(corpo.mensagem ?? "Nao foi possivel baixar lancamento.");
        return;
      }

      setMensagem("Lancamento baixado como pago.");
      await carregarDados();
    } catch (falha) {
      setMensagem(
        falha instanceof Error
          ? falha.message
          : "Nao foi possivel baixar lancamento."
      );
    } finally {
      setSalvando(false);
    }
  }

  async function cancelarLancamento(
    lancamento: LancamentoFinanceiro
  ): Promise<void> {
    setMensagem(null);
    setSalvando(true);

    try {
      const token = await obterToken();

      if (!token) {
        router.replace("/login");
        return;
      }

      const resposta = await fetch(
        `/api/financeiro/lancamentos/${lancamento.id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const corpo = (await resposta.json()) as { mensagem?: string };

      if (!resposta.ok) {
        setMensagem(corpo.mensagem ?? "Nao foi possivel cancelar lancamento.");
        return;
      }

      setMensagem("Lancamento cancelado.");
      await carregarDados();
    } catch (falha) {
      setMensagem(
        falha instanceof Error
          ? falha.message
          : "Nao foi possivel cancelar lancamento."
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
              Financeiro
            </p>
            <h1 className="mt-1 text-2xl font-semibold">
              Contas e recebimentos
            </h1>
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
        {mensagem ? (
          <p className="rounded-md border bg-suave px-4 py-3 text-sm text-suave-texto">
            {mensagem}
          </p>
        ) : null}

        {estado === "carregando" ? (
          <PainelMensagem texto="Carregando financeiro..." />
        ) : null}

        {estado === "configuracao" || estado === "erro" ? (
          <PainelMensagem texto={mensagem ?? "Nao foi possivel carregar financeiro."} />
        ) : null}

        {estado === "pronto" ? (
          <>
            <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
              <Indicador titulo="Recebido" valor={formatarMoeda(resumo.receitasPagas)} />
              <Indicador titulo="A receber" valor={formatarMoeda(resumo.receitasPendentes)} />
              <Indicador titulo="Pago" valor={formatarMoeda(resumo.despesasPagas)} />
              <Indicador titulo="A pagar" valor={formatarMoeda(resumo.despesasPendentes)} />
              <Indicador titulo="Saldo real" valor={formatarMoeda(resumo.saldoRealizado)} />
              <Indicador titulo="Previsto" valor={formatarMoeda(resumo.saldoPrevisto)} />
            </div>

            <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
              <form
                className="rounded-md border bg-white p-5"
                onSubmit={salvarLancamento}
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold">
                    {editandoId ? "Editar lancamento" : "Novo lancamento"}
                  </h2>
                  {editandoId ? (
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
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                    <label className="grid gap-2 text-sm font-medium">
                      Tipo
                      <select
                        className="h-10 rounded-md border bg-white px-3 text-sm outline-none ring-primario/20 transition focus:ring-4 disabled:bg-suave"
                        disabled={!podeGerenciar}
                        onChange={(evento) =>
                          atualizarCampo(
                            "tipo",
                            evento.target.value as TipoLancamentoFinanceiro
                          )
                        }
                        value={formulario.tipo}
                      >
                        <option value="receita">Receita</option>
                        <option value="despesa">Despesa</option>
                      </select>
                    </label>

                    <label className="grid gap-2 text-sm font-medium">
                      Status
                      <select
                        className="h-10 rounded-md border bg-white px-3 text-sm outline-none ring-primario/20 transition focus:ring-4 disabled:bg-suave"
                        disabled={!podeGerenciar}
                        onChange={(evento) =>
                          atualizarCampo(
                            "status",
                            evento.target.value as StatusLancamentoFinanceiro
                          )
                        }
                        value={formulario.status}
                      >
                        <option value="pendente">Pendente</option>
                        <option value="pago">Pago</option>
                        <option value="cancelado">Cancelado</option>
                      </select>
                    </label>
                  </div>

                  {formulario.tipo === "receita" ? (
                    <>
                      <label className="grid gap-2 text-sm font-medium">
                        OS vinculada
                        <select
                          className="h-10 rounded-md border bg-white px-3 text-sm outline-none ring-primario/20 transition focus:ring-4 disabled:bg-suave"
                          disabled={!podeGerenciar}
                          onChange={(evento) =>
                            atualizarCampo("ordem_servico_id", evento.target.value)
                          }
                          value={formulario.ordem_servico_id}
                        >
                          <option value="">Sem OS</option>
                          {ordens.map((ordem) => (
                            <option key={ordem.id} value={ordem.id}>
                              OS {ordem.numero} - {formatarMoeda(ordem.valor_total)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="grid gap-2 text-sm font-medium">
                        Cliente
                        <select
                          className="h-10 rounded-md border bg-white px-3 text-sm outline-none ring-primario/20 transition focus:ring-4 disabled:bg-suave"
                          disabled={!podeGerenciar}
                          onChange={(evento) =>
                            atualizarCampo("cliente_id", evento.target.value)
                          }
                          value={formulario.cliente_id}
                        >
                          <option value="">Selecione</option>
                          {clientes.map((cliente) => (
                            <option key={cliente.id} value={cliente.id}>
                              {cliente.nome}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  ) : (
                    <label className="grid gap-2 text-sm font-medium">
                      Fornecedor
                      <select
                        className="h-10 rounded-md border bg-white px-3 text-sm outline-none ring-primario/20 transition focus:ring-4 disabled:bg-suave"
                        disabled={!podeGerenciar}
                        onChange={(evento) =>
                          atualizarCampo("fornecedor_id", evento.target.value)
                        }
                        value={formulario.fornecedor_id}
                      >
                        <option value="">Sem fornecedor</option>
                        {fornecedores.map((fornecedor) => (
                          <option key={fornecedor.id} value={fornecedor.id}>
                            {fornecedor.nome}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  <CampoTexto
                    disabled={!podeGerenciar}
                    label="Categoria"
                    onChange={(valor) => atualizarCampo("categoria", valor)}
                    required
                    value={formulario.categoria}
                  />
                  <CampoTexto
                    disabled={!podeGerenciar}
                    label="Descricao"
                    onChange={(valor) => atualizarCampo("descricao", valor)}
                    required
                    value={formulario.descricao}
                  />

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                    <CampoTexto
                      disabled={!podeGerenciar}
                      label="Valor"
                      onChange={(valor) => atualizarCampo("valor", valor)}
                      required
                      type="number"
                      value={formulario.valor}
                    />
                    <CampoTexto
                      disabled={!podeGerenciar}
                      label="Vencimento"
                      onChange={(valor) =>
                        atualizarCampo("data_vencimento", valor)
                      }
                      type="date"
                      value={formulario.data_vencimento}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                    <CampoTexto
                      disabled={!podeGerenciar}
                      label="Pagamento"
                      onChange={(valor) =>
                        atualizarCampo("data_pagamento", valor)
                      }
                      type="date"
                      value={formulario.data_pagamento}
                    />
                    <CampoTexto
                      disabled={!podeGerenciar}
                      label="Metodo"
                      onChange={(valor) =>
                        atualizarCampo("metodo_pagamento", valor)
                      }
                      value={formulario.metodo_pagamento}
                    />
                  </div>

                  <CampoArea
                    disabled={!podeGerenciar}
                    label="Observacao"
                    onChange={(valor) => atualizarCampo("observacao", valor)}
                    value={formulario.observacao}
                  />

                  <button
                    className="h-10 rounded-md bg-primario px-4 text-sm font-semibold text-primario-texto transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={salvando || !podeGerenciar}
                    type="submit"
                  >
                    {salvando
                      ? "Salvando..."
                      : editandoId
                        ? "Salvar lancamento"
                        : "Criar lancamento"}
                  </button>
                </div>
              </form>

              <section className="rounded-md border bg-white">
                <div className="grid gap-4 border-b px-5 py-4 lg:grid-cols-[1fr_auto] lg:items-end">
                  <div>
                    <h2 className="text-base font-semibold">Lancamentos</h2>
                    <p className="mt-1 text-sm text-suave-texto">
                      Controle contas a receber, contas a pagar e baixas.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <input
                      className="h-10 min-w-52 rounded-md border bg-white px-3 text-sm outline-none ring-primario/20 transition focus:ring-4"
                      onChange={(evento) => setBusca(evento.target.value)}
                      placeholder="Buscar descricao ou categoria"
                      value={busca}
                    />
                    <select
                      className="h-10 rounded-md border bg-white px-3 text-sm outline-none ring-primario/20 transition focus:ring-4"
                      onChange={(evento) => setFiltroTipo(evento.target.value)}
                      value={filtroTipo}
                    >
                      <option value="todos">Todos tipos</option>
                      <option value="receita">Receitas</option>
                      <option value="despesa">Despesas</option>
                    </select>
                    <select
                      className="h-10 rounded-md border bg-white px-3 text-sm outline-none ring-primario/20 transition focus:ring-4"
                      onChange={(evento) => setFiltroStatus(evento.target.value)}
                      value={filtroStatus}
                    >
                      <option value="todos">Todos status</option>
                      <option value="pendente">Pendentes</option>
                      <option value="pago">Pagos</option>
                      <option value="cancelado">Cancelados</option>
                    </select>
                    <button
                      className="h-10 rounded-md border px-4 text-sm font-medium hover:bg-suave"
                      onClick={() => void carregarDados()}
                      type="button"
                    >
                      Filtrar
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1020px] border-collapse text-left text-sm">
                    <thead className="bg-suave/60 text-suave-texto">
                      <tr>
                        <th className="px-5 py-3 font-medium">Lancamento</th>
                        <th className="px-5 py-3 font-medium">Vinculo</th>
                        <th className="px-5 py-3 font-medium">Vencimento</th>
                        <th className="px-5 py-3 font-medium">Valor</th>
                        <th className="px-5 py-3 font-medium">Status</th>
                        <th className="px-5 py-3 font-medium">Acoes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lancamentos.map((lancamento) => (
                        <tr className="border-t" key={lancamento.id}>
                          <td className="px-5 py-3">
                            <p className="font-medium">{lancamento.descricao}</p>
                            <p className="mt-1 text-xs text-suave-texto">
                              {rotuloTipo(lancamento.tipo)} - {lancamento.categoria}
                            </p>
                          </td>
                          <td className="px-5 py-3 text-suave-texto">
                            {lancamento.ordem_servico ? (
                              <p>OS {lancamento.ordem_servico.numero}</p>
                            ) : null}
                            <p>
                              {lancamento.cliente?.nome ??
                                lancamento.fornecedor?.nome ??
                                "Sem vinculo"}
                            </p>
                          </td>
                          <td className="px-5 py-3 text-suave-texto">
                            {lancamento.data_vencimento
                              ? formatarDataCurta(lancamento.data_vencimento)
                              : "Sem vencimento"}
                            {lancamento.data_pagamento ? (
                              <p className="mt-1 text-xs">
                                Pago em{" "}
                                {formatarDataCurta(lancamento.data_pagamento)}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-5 py-3">
                            <strong
                              className={
                                lancamento.tipo === "receita"
                                  ? "text-primario"
                                  : "text-alerta"
                              }
                            >
                              {formatarMoeda(lancamento.valor)}
                            </strong>
                          </td>
                          <td className="px-5 py-3">
                            <span className={classeStatus(lancamento.status)}>
                              {rotuloStatus(lancamento.status)}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex flex-wrap gap-2">
                              <button
                                className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-suave disabled:opacity-60"
                                disabled={!podeGerenciar || salvando}
                                onClick={() => preencherEdicao(lancamento)}
                                type="button"
                              >
                                Editar
                              </button>
                              {lancamento.status === "pendente" ? (
                                <button
                                  className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-suave disabled:opacity-60"
                                  disabled={!podeGerenciar || salvando}
                                  onClick={() => void baixarLancamento(lancamento)}
                                  type="button"
                                >
                                  Baixar
                                </button>
                              ) : null}
                              {lancamento.status !== "cancelado" ? (
                                <button
                                  className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-suave disabled:opacity-60"
                                  disabled={!podeGerenciar || salvando}
                                  onClick={() =>
                                    void cancelarLancamento(lancamento)
                                  }
                                  type="button"
                                >
                                  Cancelar
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {lancamentos.length === 0 ? (
                        <tr>
                          <td className="px-5 py-6 text-suave-texto" colSpan={6}>
                            Nenhum lancamento encontrado.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
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
      <strong className="mt-2 block text-xl font-semibold">{valor}</strong>
    </article>
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
        step={type === "number" ? "0.01" : undefined}
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

function rotuloTipo(tipo: TipoLancamentoFinanceiro): string {
  return tipo === "receita" ? "Receita" : "Despesa";
}

function rotuloStatus(status: StatusLancamentoFinanceiro): string {
  const rotulos: Record<StatusLancamentoFinanceiro, string> = {
    pendente: "Pendente",
    pago: "Pago",
    cancelado: "Cancelado"
  };

  return rotulos[status];
}

function classeStatus(status: StatusLancamentoFinanceiro): string {
  const classes: Record<StatusLancamentoFinanceiro, string> = {
    pendente: "rounded-md bg-alerta/10 px-2 py-1 text-xs font-medium text-alerta",
    pago: "rounded-md bg-primario/10 px-2 py-1 text-xs font-medium text-primario",
    cancelado: "rounded-md bg-suave px-2 py-1 text-xs font-medium text-suave-texto"
  };

  return classes[status];
}

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(Number(valor));
}

function formatarDataCurta(valor: string): string {
  const [ano, mes, dia] = valor.slice(0, 10).split("-");

  return `${dia}/${mes}/${ano}`;
}
