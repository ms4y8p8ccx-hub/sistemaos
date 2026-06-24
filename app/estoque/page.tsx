"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { NavegacaoApp } from "@/components/navegacao-app";
import { obterConfiguracaoSupabase } from "@/lib/env";
import { podeGerenciarEstoque } from "@/lib/auth/permissoes";
import { criarClienteSupabaseBrowser } from "@/lib/supabase/browser";
import type {
  Fornecedor,
  MovimentacaoEstoque,
  Produto,
  TipoMovimentacaoEstoque,
  TipoPessoa,
  UsuarioSistema
} from "@/types";

type EstadoTela = "carregando" | "pronto" | "erro" | "configuracao";

type FormularioFornecedor = {
  tipo: TipoPessoa;
  nome: string;
  documento: string;
  email: string;
  telefone: string;
  contato_responsavel: string;
  endereco_cidade: string;
  endereco_estado: string;
  observacoes: string;
  ativo: boolean;
};

type FormularioProduto = {
  fornecedor_id: string;
  codigo_sku: string;
  nome: string;
  descricao: string;
  unidade_medida: string;
  estoque_atual: string;
  estoque_minimo: string;
  preco_custo: string;
  preco_venda: string;
  localizacao_estoque: string;
  ativo: boolean;
};

type FormularioMovimentacao = {
  produto_id: string;
  tipo: TipoMovimentacaoEstoque;
  quantidade: string;
  custo_unitario: string;
  observacao: string;
};

const fornecedorInicial: FormularioFornecedor = {
  tipo: "juridica",
  nome: "",
  documento: "",
  email: "",
  telefone: "",
  contato_responsavel: "",
  endereco_cidade: "",
  endereco_estado: "",
  observacoes: "",
  ativo: true
};

const produtoInicial: FormularioProduto = {
  fornecedor_id: "",
  codigo_sku: "",
  nome: "",
  descricao: "",
  unidade_medida: "un",
  estoque_atual: "0",
  estoque_minimo: "0",
  preco_custo: "0",
  preco_venda: "0",
  localizacao_estoque: "",
  ativo: true
};

const movimentacaoInicial: FormularioMovimentacao = {
  produto_id: "",
  tipo: "entrada",
  quantidade: "1",
  custo_unitario: "",
  observacao: ""
};

export default function PaginaEstoque(): JSX.Element {
  const router = useRouter();
  const configuracao = useMemo(() => obterConfiguracaoSupabase(), []);
  const [estado, setEstado] = useState<EstadoTela>("carregando");
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<UsuarioSistema | null>(null);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoEstoque[]>([]);
  const [busca, setBusca] = useState("");
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [somenteCriticos, setSomenteCriticos] = useState(false);
  const [formFornecedor, setFormFornecedor] =
    useState<FormularioFornecedor>(fornecedorInicial);
  const [formProduto, setFormProduto] =
    useState<FormularioProduto>(produtoInicial);
  const [formMovimentacao, setFormMovimentacao] =
    useState<FormularioMovimentacao>(movimentacaoInicial);
  const [produtoEditandoId, setProdutoEditandoId] = useState<string | null>(
    null
  );
  const [salvando, setSalvando] = useState(false);

  const perfil = usuario?.role?.perfil;
  const podeGerenciar = Boolean(perfil && podeGerenciarEstoque(perfil));
  const produtosCriticos = produtos.filter(
    (produto) => produto.estoque_atual <= produto.estoque_minimo
  );

  const obterToken = useCallback(async (): Promise<string | null> => {
    const supabase = criarClienteSupabaseBrowser();
    const { data } = await supabase.auth.getSession();

    return data.session?.access_token ?? null;
  }, []);

  const carregarDados = useCallback(async (): Promise<void> => {
    if (!configuracao.configurado) {
      setEstado("configuracao");
      setMensagem("Configure o Supabase para gerenciar estoque.");
      return;
    }

    const token = await obterToken();

    if (!token) {
      router.replace("/login");
      return;
    }

    const parametrosProdutos = new URLSearchParams({
      ativos: mostrarInativos ? "false" : "true",
      criticos: somenteCriticos ? "true" : "false"
    });

    if (busca.trim()) {
      parametrosProdutos.set("busca", busca.trim());
    }

    const [respostaUsuario, respostaFornecedores, respostaProdutos, respostaMov] =
      await Promise.all([
        fetch("/api/me", {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch("/api/estoque/fornecedores", {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`/api/estoque/produtos?${parametrosProdutos.toString()}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch("/api/estoque/movimentacoes", {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

    const corpoUsuario = (await respostaUsuario.json()) as {
      usuario?: UsuarioSistema;
      mensagem?: string;
    };
    const corpoFornecedores = (await respostaFornecedores.json()) as {
      fornecedores?: Fornecedor[];
      mensagem?: string;
    };
    const corpoProdutos = (await respostaProdutos.json()) as {
      produtos?: Produto[];
      mensagem?: string;
    };
    const corpoMov = (await respostaMov.json()) as {
      movimentacoes?: MovimentacaoEstoque[];
      mensagem?: string;
    };

    if (!respostaUsuario.ok || !corpoUsuario.usuario) {
      setEstado("erro");
      setMensagem(corpoUsuario.mensagem ?? "Nao foi possivel carregar o usuario.");
      return;
    }

    if (!respostaFornecedores.ok) {
      setEstado("erro");
      setMensagem(
        corpoFornecedores.mensagem ?? "Nao foi possivel carregar fornecedores."
      );
      return;
    }

    if (!respostaProdutos.ok) {
      setEstado("erro");
      setMensagem(corpoProdutos.mensagem ?? "Nao foi possivel carregar produtos.");
      return;
    }

    if (!respostaMov.ok) {
      setEstado("erro");
      setMensagem(corpoMov.mensagem ?? "Nao foi possivel carregar movimentacoes.");
      return;
    }

    const fornecedoresAtivos = corpoFornecedores.fornecedores ?? [];
    const produtosAtivos = corpoProdutos.produtos ?? [];

    setUsuario(corpoUsuario.usuario);
    setFornecedores(fornecedoresAtivos);
    setProdutos(produtosAtivos);
    setMovimentacoes(corpoMov.movimentacoes ?? []);
    setFormProduto((atual) => ({
      ...atual,
      fornecedor_id: atual.fornecedor_id || fornecedoresAtivos[0]?.id || ""
    }));
    setFormMovimentacao((atual) => ({
      ...atual,
      produto_id: atual.produto_id || produtosAtivos[0]?.id || ""
    }));
    setEstado("pronto");
  }, [
    busca,
    configuracao.configurado,
    mostrarInativos,
    obterToken,
    router,
    somenteCriticos
  ]);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);

  function atualizarFornecedor<K extends keyof FormularioFornecedor>(
    campo: K,
    valor: FormularioFornecedor[K]
  ): void {
    setFormFornecedor((atual) => ({ ...atual, [campo]: valor }));
  }

  function atualizarProduto<K extends keyof FormularioProduto>(
    campo: K,
    valor: FormularioProduto[K]
  ): void {
    setFormProduto((atual) => ({ ...atual, [campo]: valor }));
  }

  function atualizarMovimentacao<K extends keyof FormularioMovimentacao>(
    campo: K,
    valor: FormularioMovimentacao[K]
  ): void {
    setFormMovimentacao((atual) => ({ ...atual, [campo]: valor }));
  }

  function preencherEdicaoProduto(produto: Produto): void {
    setProdutoEditandoId(produto.id);
    setFormProduto({
      fornecedor_id: produto.fornecedor_id ?? "",
      codigo_sku: produto.codigo_sku,
      nome: produto.nome,
      descricao: produto.descricao ?? "",
      unidade_medida: produto.unidade_medida,
      estoque_atual: produto.estoque_atual.toString(),
      estoque_minimo: produto.estoque_minimo.toString(),
      preco_custo: produto.preco_custo.toString(),
      preco_venda: produto.preco_venda.toString(),
      localizacao_estoque: produto.localizacao_estoque ?? "",
      ativo: produto.ativo
    });
    setMensagem(null);
  }

  function limparProduto(): void {
    setProdutoEditandoId(null);
    setFormProduto({
      ...produtoInicial,
      fornecedor_id: fornecedores[0]?.id ?? ""
    });
  }

  async function salvarFornecedor(
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

      const resposta = await fetch("/api/estoque/fornecedores", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(formFornecedor)
      });

      const corpo = (await resposta.json()) as {
        fornecedor?: Fornecedor;
        mensagem?: string;
      };

      if (!resposta.ok || !corpo.fornecedor) {
        setMensagem(corpo.mensagem ?? "Nao foi possivel salvar fornecedor.");
        return;
      }

      setFormFornecedor(fornecedorInicial);
      setMensagem("Fornecedor cadastrado.");
      await carregarDados();
    } catch (falha) {
      setMensagem(
        falha instanceof Error
          ? falha.message
          : "Nao foi possivel salvar fornecedor."
      );
    } finally {
      setSalvando(false);
    }
  }

  async function salvarProduto(evento: FormEvent<HTMLFormElement>): Promise<void> {
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
        produtoEditandoId
          ? `/api/estoque/produtos/${produtoEditandoId}`
          : "/api/estoque/produtos",
        {
          method: produtoEditandoId ? "PATCH" : "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(formProduto)
        }
      );

      const corpo = (await resposta.json()) as {
        produto?: Produto;
        mensagem?: string;
      };

      if (!resposta.ok || !corpo.produto) {
        setMensagem(corpo.mensagem ?? "Nao foi possivel salvar produto.");
        return;
      }

      setMensagem(produtoEditandoId ? "Produto atualizado." : "Produto criado.");
      limparProduto();
      await carregarDados();
    } catch (falha) {
      setMensagem(
        falha instanceof Error
          ? falha.message
          : "Nao foi possivel salvar produto."
      );
    } finally {
      setSalvando(false);
    }
  }

  async function movimentarEstoque(
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

      const resposta = await fetch("/api/estoque/movimentacoes", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(formMovimentacao)
      });

      const corpo = (await resposta.json()) as { mensagem?: string };

      if (!resposta.ok) {
        setMensagem(corpo.mensagem ?? "Nao foi possivel movimentar estoque.");
        return;
      }

      setMensagem("Movimentacao registrada.");
      setFormMovimentacao((atual) => ({
        ...movimentacaoInicial,
        produto_id: atual.produto_id
      }));
      await carregarDados();
    } catch (falha) {
      setMensagem(
        falha instanceof Error
          ? falha.message
          : "Nao foi possivel movimentar estoque."
      );
    } finally {
      setSalvando(false);
    }
  }

  async function desativarProduto(produto: Produto): Promise<void> {
    setMensagem(null);
    setSalvando(true);

    try {
      const token = await obterToken();

      if (!token) {
        router.replace("/login");
        return;
      }

      const resposta = await fetch(`/api/estoque/produtos/${produto.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      const corpo = (await resposta.json()) as { mensagem?: string };

      if (!resposta.ok) {
        setMensagem(corpo.mensagem ?? "Nao foi possivel desativar produto.");
        return;
      }

      setMensagem("Produto desativado.");
      await carregarDados();
    } catch (falha) {
      setMensagem(
        falha instanceof Error
          ? falha.message
          : "Nao foi possivel desativar produto."
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
              Estoque
            </p>
            <h1 className="mt-1 text-2xl font-semibold">Pecas e produtos</h1>
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
          <PainelMensagem texto="Carregando estoque..." />
        ) : null}

        {estado === "configuracao" || estado === "erro" ? (
          <PainelMensagem
            texto={mensagem ?? "Nao foi possivel carregar o estoque."}
          />
        ) : null}

        {estado === "pronto" ? (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <Indicador titulo="Produtos" valor={produtos.length.toString()} />
              <Indicador
                titulo="Criticos"
                valor={produtosCriticos.length.toString()}
              />
              <Indicador
                titulo="Fornecedores"
                valor={fornecedores.length.toString()}
              />
              <Indicador
                titulo="Movimentacoes"
                valor={movimentacoes.length.toString()}
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
              <div className="grid content-start gap-6">
                <form
                  className="rounded-md border bg-white p-5"
                  onSubmit={salvarProduto}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-base font-semibold">
                      {produtoEditandoId ? "Editar produto" : "Novo produto"}
                    </h2>
                    {produtoEditandoId ? (
                      <button
                        className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-suave"
                        onClick={limparProduto}
                        type="button"
                      >
                        Cancelar
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-5 grid gap-4">
                    <label className="grid gap-2 text-sm font-medium">
                      Fornecedor
                      <select
                        className="h-10 rounded-md border bg-white px-3 text-sm outline-none ring-primario/20 transition focus:ring-4 disabled:bg-suave"
                        disabled={!podeGerenciar}
                        onChange={(evento) =>
                          atualizarProduto("fornecedor_id", evento.target.value)
                        }
                        value={formProduto.fornecedor_id}
                      >
                        <option value="">Sem fornecedor</option>
                        {fornecedores.map((fornecedor) => (
                          <option key={fornecedor.id} value={fornecedor.id}>
                            {fornecedor.nome}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="grid gap-4 md:grid-cols-[140px_1fr]">
                      <CampoTexto
                        disabled={!podeGerenciar}
                        label="SKU"
                        onChange={(valor) => atualizarProduto("codigo_sku", valor)}
                        required
                        value={formProduto.codigo_sku}
                      />
                      <CampoTexto
                        disabled={!podeGerenciar}
                        label="Nome"
                        onChange={(valor) => atualizarProduto("nome", valor)}
                        required
                        value={formProduto.nome}
                      />
                    </div>

                    <CampoTexto
                      disabled={!podeGerenciar}
                      label="Descricao"
                      onChange={(valor) => atualizarProduto("descricao", valor)}
                      value={formProduto.descricao}
                    />

                    <div className="grid gap-4 md:grid-cols-3">
                      <CampoTexto
                        disabled={!podeGerenciar}
                        label="Unidade"
                        onChange={(valor) =>
                          atualizarProduto("unidade_medida", valor)
                        }
                        required
                        value={formProduto.unidade_medida}
                      />
                      <CampoTexto
                        disabled={!podeGerenciar || Boolean(produtoEditandoId)}
                        label="Estoque inicial"
                        onChange={(valor) =>
                          atualizarProduto("estoque_atual", valor)
                        }
                        type="number"
                        value={formProduto.estoque_atual}
                      />
                      <CampoTexto
                        disabled={!podeGerenciar}
                        label="Estoque minimo"
                        onChange={(valor) =>
                          atualizarProduto("estoque_minimo", valor)
                        }
                        type="number"
                        value={formProduto.estoque_minimo}
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <CampoTexto
                        disabled={!podeGerenciar}
                        label="Preco custo"
                        onChange={(valor) => atualizarProduto("preco_custo", valor)}
                        type="number"
                        value={formProduto.preco_custo}
                      />
                      <CampoTexto
                        disabled={!podeGerenciar}
                        label="Preco venda"
                        onChange={(valor) => atualizarProduto("preco_venda", valor)}
                        type="number"
                        value={formProduto.preco_venda}
                      />
                    </div>

                    <CampoTexto
                      disabled={!podeGerenciar}
                      label="Localizacao"
                      onChange={(valor) =>
                        atualizarProduto("localizacao_estoque", valor)
                      }
                      value={formProduto.localizacao_estoque}
                    />

                    {produtoEditandoId ? (
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <input
                          checked={formProduto.ativo}
                          disabled={!podeGerenciar}
                          onChange={(evento) =>
                            atualizarProduto("ativo", evento.target.checked)
                          }
                          type="checkbox"
                        />
                        Produto ativo
                      </label>
                    ) : null}

                    <button
                      className="h-10 rounded-md bg-primario px-4 text-sm font-semibold text-primario-texto transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={salvando || !podeGerenciar}
                      type="submit"
                    >
                      {salvando
                        ? "Salvando..."
                        : produtoEditandoId
                          ? "Salvar produto"
                          : "Cadastrar produto"}
                    </button>
                  </div>
                </form>

                <form
                  className="rounded-md border bg-white p-5"
                  onSubmit={movimentarEstoque}
                >
                  <h2 className="text-base font-semibold">Movimentar estoque</h2>
                  <div className="mt-5 grid gap-4">
                    <label className="grid gap-2 text-sm font-medium">
                      Produto
                      <select
                        className="h-10 rounded-md border bg-white px-3 text-sm outline-none ring-primario/20 transition focus:ring-4 disabled:bg-suave"
                        disabled={!podeGerenciar || produtos.length === 0}
                        onChange={(evento) =>
                          atualizarMovimentacao("produto_id", evento.target.value)
                        }
                        required
                        value={formMovimentacao.produto_id}
                      >
                        {produtos.map((produto) => (
                          <option key={produto.id} value={produto.id}>
                            {produto.codigo_sku} - {produto.nome}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="grid gap-4 md:grid-cols-3">
                      <label className="grid gap-2 text-sm font-medium">
                        Tipo
                        <select
                          className="h-10 rounded-md border bg-white px-3 text-sm outline-none ring-primario/20 transition focus:ring-4 disabled:bg-suave"
                          disabled={!podeGerenciar}
                          onChange={(evento) =>
                            atualizarMovimentacao(
                              "tipo",
                              evento.target.value as TipoMovimentacaoEstoque
                            )
                          }
                          value={formMovimentacao.tipo}
                        >
                          <option value="entrada">Entrada</option>
                          <option value="saida">Saida</option>
                          <option value="ajuste">Ajuste</option>
                          <option value="reserva">Reserva</option>
                          <option value="devolucao">Devolucao</option>
                        </select>
                      </label>
                      <CampoTexto
                        disabled={!podeGerenciar}
                        label="Quantidade"
                        onChange={(valor) =>
                          atualizarMovimentacao("quantidade", valor)
                        }
                        required
                        type="number"
                        value={formMovimentacao.quantidade}
                      />
                      <CampoTexto
                        disabled={!podeGerenciar}
                        label="Custo unit."
                        onChange={(valor) =>
                          atualizarMovimentacao("custo_unitario", valor)
                        }
                        type="number"
                        value={formMovimentacao.custo_unitario}
                      />
                    </div>

                    <CampoTexto
                      disabled={!podeGerenciar}
                      label="Observacao"
                      onChange={(valor) =>
                        atualizarMovimentacao("observacao", valor)
                      }
                      value={formMovimentacao.observacao}
                    />

                    <button
                      className="h-10 rounded-md bg-primario px-4 text-sm font-semibold text-primario-texto transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={
                        salvando ||
                        !podeGerenciar ||
                        !formMovimentacao.produto_id
                      }
                      type="submit"
                    >
                      Registrar movimentacao
                    </button>
                  </div>
                </form>

                <form
                  className="rounded-md border bg-white p-5"
                  onSubmit={salvarFornecedor}
                >
                  <h2 className="text-base font-semibold">Fornecedor rapido</h2>
                  <div className="mt-5 grid gap-4">
                    <label className="grid gap-2 text-sm font-medium">
                      Tipo
                      <select
                        className="h-10 rounded-md border bg-white px-3 text-sm outline-none ring-primario/20 transition focus:ring-4 disabled:bg-suave"
                        disabled={!podeGerenciar}
                        onChange={(evento) =>
                          atualizarFornecedor(
                            "tipo",
                            evento.target.value as TipoPessoa
                          )
                        }
                        value={formFornecedor.tipo}
                      >
                        <option value="juridica">Pessoa juridica</option>
                        <option value="fisica">Pessoa fisica</option>
                      </select>
                    </label>
                    <CampoTexto
                      disabled={!podeGerenciar}
                      label="Nome"
                      onChange={(valor) => atualizarFornecedor("nome", valor)}
                      required
                      value={formFornecedor.nome}
                    />
                    <div className="grid gap-4 md:grid-cols-2">
                      <CampoTexto
                        disabled={!podeGerenciar}
                        label="Documento"
                        onChange={(valor) =>
                          atualizarFornecedor("documento", valor)
                        }
                        value={formFornecedor.documento}
                      />
                      <CampoTexto
                        disabled={!podeGerenciar}
                        label="Telefone"
                        onChange={(valor) =>
                          atualizarFornecedor("telefone", valor)
                        }
                        value={formFornecedor.telefone}
                      />
                    </div>
                    <CampoTexto
                      disabled={!podeGerenciar}
                      label="E-mail"
                      onChange={(valor) => atualizarFornecedor("email", valor)}
                      type="email"
                      value={formFornecedor.email}
                    />
                    <button
                      className="h-10 rounded-md border px-4 text-sm font-medium hover:bg-suave disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={salvando || !podeGerenciar}
                      type="submit"
                    >
                      Cadastrar fornecedor
                    </button>
                  </div>
                </form>
              </div>

              <div className="grid content-start gap-6">
                <section className="rounded-md border bg-white">
                  <div className="grid gap-4 border-b px-5 py-4 lg:grid-cols-[1fr_auto] lg:items-end">
                    <div>
                      <h2 className="text-base font-semibold">
                        Produtos em estoque
                      </h2>
                      <p className="mt-1 text-sm text-suave-texto">
                        Controle saldo, custo, venda e estoque minimo.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <input
                        className="h-10 min-w-52 rounded-md border bg-white px-3 text-sm outline-none ring-primario/20 transition focus:ring-4"
                        onChange={(evento) => setBusca(evento.target.value)}
                        placeholder="Buscar SKU, nome ou descricao"
                        value={busca}
                      />
                      <button
                        className="h-10 rounded-md border px-4 text-sm font-medium hover:bg-suave"
                        onClick={() => void carregarDados()}
                        type="button"
                      >
                        Buscar
                      </button>
                      <label className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm">
                        <input
                          checked={somenteCriticos}
                          onChange={(evento) =>
                            setSomenteCriticos(evento.target.checked)
                          }
                          type="checkbox"
                        />
                        Criticos
                      </label>
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

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                      <thead className="bg-suave/60 text-suave-texto">
                        <tr>
                          <th className="px-5 py-3 font-medium">Produto</th>
                          <th className="px-5 py-3 font-medium">Fornecedor</th>
                          <th className="px-5 py-3 font-medium">Saldo</th>
                          <th className="px-5 py-3 font-medium">Precos</th>
                          <th className="px-5 py-3 font-medium">Status</th>
                          <th className="px-5 py-3 font-medium">Acoes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {produtos.map((produto) => (
                          <tr className="border-t" key={produto.id}>
                            <td className="px-5 py-3">
                              <p className="font-medium">{produto.nome}</p>
                              <p className="mt-1 text-xs text-suave-texto">
                                {produto.codigo_sku}
                                {produto.localizacao_estoque
                                  ? ` - ${produto.localizacao_estoque}`
                                  : ""}
                              </p>
                            </td>
                            <td className="px-5 py-3 text-suave-texto">
                              {produto.fornecedor?.nome ?? "Sem fornecedor"}
                            </td>
                            <td className="px-5 py-3">
                              <p className="font-medium">
                                {produto.estoque_atual} {produto.unidade_medida}
                              </p>
                              <p className="mt-1 text-xs text-suave-texto">
                                minimo {produto.estoque_minimo}
                              </p>
                            </td>
                            <td className="px-5 py-3 text-suave-texto">
                              <p>Custo {formatarMoeda(produto.preco_custo)}</p>
                              <p className="mt-1 text-xs">
                                Venda {formatarMoeda(produto.preco_venda)}
                              </p>
                            </td>
                            <td className="px-5 py-3">
                              <span
                                className={
                                  produto.estoque_atual <= produto.estoque_minimo
                                    ? "rounded-md bg-alerta/10 px-2 py-1 text-xs font-medium text-alerta"
                                    : "rounded-md bg-suave px-2 py-1 text-xs font-medium"
                                }
                              >
                                {produto.estoque_atual <= produto.estoque_minimo
                                  ? "Critico"
                                  : produto.ativo
                                    ? "Ativo"
                                    : "Inativo"}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-suave disabled:opacity-60"
                                  disabled={!podeGerenciar || salvando}
                                  onClick={() => preencherEdicaoProduto(produto)}
                                  type="button"
                                >
                                  Editar
                                </button>
                                {produto.ativo ? (
                                  <button
                                    className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-suave disabled:opacity-60"
                                    disabled={!podeGerenciar || salvando}
                                    onClick={() => void desativarProduto(produto)}
                                    type="button"
                                  >
                                    Desativar
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ))}
                        {produtos.length === 0 ? (
                          <tr>
                            <td className="px-5 py-6 text-suave-texto" colSpan={6}>
                              Nenhum produto encontrado.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="rounded-md border bg-white">
                  <div className="border-b px-5 py-4">
                    <h2 className="text-base font-semibold">
                      Movimentacoes recentes
                    </h2>
                  </div>
                  <div className="grid gap-2 p-5">
                    {movimentacoes.map((movimentacao) => (
                      <div
                        className="rounded-md border px-4 py-3 text-sm"
                        key={movimentacao.id}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">
                              {movimentacao.produto?.nome ?? "Produto"}
                            </p>
                            <p className="mt-1 text-xs text-suave-texto">
                              {rotuloMovimentacao(movimentacao.tipo)} -{" "}
                              {movimentacao.quantidade}
                            </p>
                          </div>
                          <span className="text-xs text-suave-texto">
                            {formatarData(movimentacao.criado_em)}
                          </span>
                        </div>
                        {movimentacao.observacao ? (
                          <p className="mt-2 text-xs text-suave-texto">
                            {movimentacao.observacao}
                          </p>
                        ) : null}
                      </div>
                    ))}
                    {movimentacoes.length === 0 ? (
                      <p className="text-sm text-suave-texto">
                        Nenhuma movimentacao registrada.
                      </p>
                    ) : null}
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
      <strong className="mt-2 block text-3xl font-semibold">{valor}</strong>
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
        type={type}
        value={value}
      />
    </label>
  );
}

function rotuloMovimentacao(tipo: TipoMovimentacaoEstoque): string {
  const rotulos: Record<TipoMovimentacaoEstoque, string> = {
    entrada: "Entrada",
    saida: "Saida",
    ajuste: "Ajuste",
    reserva: "Reserva",
    devolucao: "Devolucao"
  };

  return rotulos[tipo];
}

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(Number(valor));
}

function formatarData(valor: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(valor));
}
