"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { NavegacaoApp } from "@/components/navegacao-app";
import { obterConfiguracaoSupabase } from "@/lib/env";
import { criarClienteSupabaseBrowser } from "@/lib/supabase/browser";
import { rotulosStatusOrdemServico } from "@/lib/validations/ordens-servico";
import type {
  Auditoria,
  LancamentoFinanceiro,
  OrdemServico,
  Produto,
  UsuarioSistema
} from "@/types";

type EstadoTela = "carregando" | "pronto" | "erro" | "configuracao";

type ResumoRelatorio = {
  osTotal: number;
  osAbertas: number;
  osFechadas: number;
  receitas: number;
  despesas: number;
  produtosCriticos: number;
};

type DadosRelatorio = {
  ordens: OrdemServico[];
  lancamentos: LancamentoFinanceiro[];
  produtosCriticos: Produto[];
  auditoria: Auditoria[];
  resumo: ResumoRelatorio;
};

const resumoInicial: ResumoRelatorio = {
  osTotal: 0,
  osAbertas: 0,
  osFechadas: 0,
  receitas: 0,
  despesas: 0,
  produtosCriticos: 0
};

const dadosIniciais: DadosRelatorio = {
  ordens: [],
  lancamentos: [],
  produtosCriticos: [],
  auditoria: [],
  resumo: resumoInicial
};

export default function PaginaRelatorios(): JSX.Element {
  const router = useRouter();
  const configuracao = useMemo(() => obterConfiguracaoSupabase(), []);
  const hoje = new Date().toISOString().slice(0, 10);
  const [estado, setEstado] = useState<EstadoTela>("carregando");
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<UsuarioSistema | null>(null);
  const [dados, setDados] = useState<DadosRelatorio>(dadosIniciais);
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState(hoje);
  const perfil = usuario?.role?.perfil;

  const obterToken = useCallback(async (): Promise<string | null> => {
    const supabase = criarClienteSupabaseBrowser();
    const { data } = await supabase.auth.getSession();

    return data.session?.access_token ?? null;
  }, []);

  const carregarDados = useCallback(async (): Promise<void> => {
    if (!configuracao.configurado) {
      setEstado("configuracao");
      setMensagem("Configure o Supabase para abrir relatorios.");
      return;
    }

    const token = await obterToken();

    if (!token) {
      router.replace("/login");
      return;
    }

    const parametros = new URLSearchParams();
    if (inicio) parametros.set("inicio", inicio);
    if (fim) parametros.set("fim", fim);

    const [respostaUsuario, respostaRelatorio] = await Promise.all([
      fetch("/api/me", {
        headers: { Authorization: `Bearer ${token}` }
      }),
      fetch(`/api/relatorios/operacional?${parametros.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
    ]);

    const corpoUsuario = (await respostaUsuario.json()) as {
      usuario?: UsuarioSistema;
      mensagem?: string;
    };
    const corpoRelatorio = (await respostaRelatorio.json()) as
      | DadosRelatorio
      | { mensagem?: string };

    if (!respostaUsuario.ok || !corpoUsuario.usuario) {
      setEstado("erro");
      setMensagem(corpoUsuario.mensagem ?? "Nao foi possivel carregar usuario.");
      return;
    }

    if (!respostaRelatorio.ok || !("resumo" in corpoRelatorio)) {
      setEstado("erro");
      setMensagem(
        "mensagem" in corpoRelatorio
          ? corpoRelatorio.mensagem ?? "Nao foi possivel carregar relatorio."
          : "Nao foi possivel carregar relatorio."
      );
      return;
    }

    setUsuario(corpoUsuario.usuario);
    setDados(corpoRelatorio);
    setEstado("pronto");
  }, [configuracao.configurado, fim, inicio, obterToken, router]);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);

  return (
    <main className="min-h-screen bg-fundo text-texto">
      <header className="border-b bg-white print:hidden">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-suave-texto">
              Relatorios
            </p>
            <h1 className="mt-1 text-2xl font-semibold">
              Resultado operacional
            </h1>
            {usuario ? (
              <p className="mt-1 text-sm text-suave-texto">
                {usuario.nome} - {usuario.role?.nome ?? "Sem perfil"}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium hover:bg-suave"
              onClick={() => window.print()}
              type="button"
            >
              Imprimir
            </button>
            <Link
              className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium hover:bg-suave"
              href="/dashboard"
            >
              Dashboard
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

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-6 print:max-w-none print:px-0">
        <div className="hidden print:block">
          <h1 className="text-2xl font-semibold">Relatorio operacional</h1>
          <p className="mt-1 text-sm text-suave-texto">
            Gerado em {new Date().toLocaleString("pt-BR")}
          </p>
        </div>

        {estado === "carregando" ? (
          <PainelMensagem texto="Carregando relatorio..." />
        ) : null}

        {estado === "configuracao" || estado === "erro" ? (
          <PainelMensagem texto={mensagem ?? "Nao foi possivel carregar relatorio."} />
        ) : null}

        {estado === "pronto" ? (
          <>
            <section className="rounded-md border bg-white p-5 print:hidden">
              <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
                <CampoData label="Inicio" onChange={setInicio} value={inicio} />
                <CampoData label="Fim" onChange={setFim} value={fim} />
                <button
                  className="h-10 rounded-md bg-primario px-4 text-sm font-semibold text-primario-texto"
                  onClick={() => void carregarDados()}
                  type="button"
                >
                  Atualizar
                </button>
              </div>
            </section>

            <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
              <Indicador titulo="OS total" valor={dados.resumo.osTotal.toString()} />
              <Indicador titulo="OS abertas" valor={dados.resumo.osAbertas.toString()} />
              <Indicador titulo="OS fechadas" valor={dados.resumo.osFechadas.toString()} />
              <Indicador titulo="Receitas" valor={formatarMoeda(dados.resumo.receitas)} />
              <Indicador titulo="Despesas" valor={formatarMoeda(dados.resumo.despesas)} />
              <Indicador
                titulo="Estoque critico"
                valor={dados.resumo.produtosCriticos.toString()}
              />
            </div>

            <section className="rounded-md border bg-white">
              <CabecalhoSecao titulo="Ordens de servico" />
              <Tabela>
                <thead className="bg-suave/60 text-suave-texto">
                  <tr>
                    <th className="px-5 py-3 font-medium">OS</th>
                    <th className="px-5 py-3 font-medium">Cliente</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.ordens.slice(0, 80).map((ordem) => (
                    <tr className="border-t" key={ordem.id}>
                      <td className="px-5 py-3 font-medium">OS {ordem.numero}</td>
                      <td className="px-5 py-3 text-suave-texto">
                        {ordem.cliente?.nome ?? "Cliente"}
                      </td>
                      <td className="px-5 py-3">
                        {rotulosStatusOrdemServico[ordem.status]}
                      </td>
                      <td className="px-5 py-3">
                        {formatarMoeda(ordem.valor_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Tabela>
            </section>

            <section className="rounded-md border bg-white">
              <CabecalhoSecao titulo="Financeiro" />
              <Tabela>
                <thead className="bg-suave/60 text-suave-texto">
                  <tr>
                    <th className="px-5 py-3 font-medium">Descricao</th>
                    <th className="px-5 py-3 font-medium">Tipo</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.lancamentos.slice(0, 80).map((lancamento) => (
                    <tr className="border-t" key={lancamento.id}>
                      <td className="px-5 py-3 font-medium">
                        {lancamento.descricao}
                      </td>
                      <td className="px-5 py-3 text-suave-texto">
                        {lancamento.tipo === "receita" ? "Receita" : "Despesa"}
                      </td>
                      <td className="px-5 py-3">{lancamento.status}</td>
                      <td className="px-5 py-3">
                        {formatarMoeda(lancamento.valor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Tabela>
            </section>

            <div className="grid gap-6 xl:grid-cols-2">
              <section className="rounded-md border bg-white">
                <CabecalhoSecao titulo="Produtos criticos" />
                <div className="grid gap-3 p-5">
                  {dados.produtosCriticos.map((produto) => (
                    <div className="rounded-md border p-4 text-sm" key={produto.id}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <strong>{produto.nome}</strong>
                          <p className="mt-1 text-xs text-suave-texto">
                            {produto.codigo_sku}
                          </p>
                        </div>
                        <span className="rounded-md bg-alerta/10 px-2 py-1 text-xs font-medium text-alerta">
                          {produto.estoque_atual}/{produto.estoque_minimo}
                        </span>
                      </div>
                    </div>
                  ))}
                  {dados.produtosCriticos.length === 0 ? (
                    <p className="text-sm text-suave-texto">
                      Nenhum produto critico.
                    </p>
                  ) : null}
                </div>
              </section>

              <section className="rounded-md border bg-white">
                <CabecalhoSecao titulo="Auditoria recente" />
                <div className="grid gap-3 p-5">
                  {dados.auditoria.map((registro) => (
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
                  {dados.auditoria.length === 0 ? (
                    <p className="text-sm text-suave-texto">
                      Nenhum registro de auditoria.
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

function CampoData({
  label,
  onChange,
  value
}: {
  label: string;
  onChange: (valor: string) => void;
  value: string;
}): JSX.Element {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <input
        className="h-10 rounded-md border bg-white px-3 text-sm outline-none ring-primario/20 transition focus:ring-4"
        onChange={(evento) => onChange(evento.target.value)}
        type="date"
        value={value}
      />
    </label>
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

function CabecalhoSecao({ titulo }: { titulo: string }): JSX.Element {
  return (
    <div className="border-b px-5 py-4">
      <h2 className="text-base font-semibold">{titulo}</h2>
    </div>
  );
}

function Tabela({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        {children}
      </table>
    </div>
  );
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
