"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { obterConfiguracaoSupabase } from "@/lib/env";
import { criarClienteSupabaseBrowser } from "@/lib/supabase/browser";
import { rotulosStatusOrdemServico } from "@/lib/validations/ordens-servico";
import type { ItemOrdemServico, OrdemServico } from "@/types";

type EstadoTela = "carregando" | "pronto" | "erro" | "configuracao";

type ConfiguracaoLocal = {
  nomeOficina: string;
  telefone: string;
  email: string;
  cidade: string;
  textoGarantia: string;
};

const configuracaoPadrao: ConfiguracaoLocal = {
  nomeOficina: "Oficina Agricola",
  telefone: "",
  email: "",
  cidade: "",
  textoGarantia:
    "Garantia condicionada ao uso correto do equipamento e revisao conforme orientacao tecnica."
};

export default function PaginaImpressaoOrdemServico(): JSX.Element {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const configuracao = useMemo(() => obterConfiguracaoSupabase(), []);
  const [estado, setEstado] = useState<EstadoTela>("carregando");
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [ordem, setOrdem] = useState<OrdemServico | null>(null);
  const [itens, setItens] = useState<ItemOrdemServico[]>([]);
  const [dadosOficina, setDadosOficina] =
    useState<ConfiguracaoLocal>(configuracaoPadrao);

  const carregarDados = useCallback(async (): Promise<void> => {
    if (!configuracao.configurado) {
      setEstado("configuracao");
      setMensagem("Configure o Supabase para imprimir OS.");
      return;
    }

    const supabase = criarClienteSupabaseBrowser();
    const { data } = await supabase.auth.getSession();

    if (!data.session) {
      router.replace("/login");
      return;
    }

    const resposta = await fetch(`/api/ordens-servico/${params.id}`, {
      headers: { Authorization: `Bearer ${data.session.access_token}` }
    });
    const corpo = (await resposta.json()) as {
      ordem?: OrdemServico;
      itens?: ItemOrdemServico[];
      mensagem?: string;
    };

    if (!resposta.ok || !corpo.ordem) {
      setEstado("erro");
      setMensagem(corpo.mensagem ?? "Nao foi possivel carregar a OS.");
      return;
    }

    const armazenado = window.localStorage.getItem("configuracoes_oficina");
    if (armazenado) {
      setDadosOficina(JSON.parse(armazenado) as ConfiguracaoLocal);
    }

    setOrdem(corpo.ordem);
    setItens(corpo.itens ?? []);
    setEstado("pronto");
  }, [configuracao.configurado, params.id, router]);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);

  return (
    <main className="min-h-screen bg-white text-texto">
      <div className="mx-auto max-w-4xl px-6 py-6 print:max-w-none print:px-0">
        <div className="mb-6 flex flex-wrap gap-2 print:hidden">
          <button
            className="h-10 rounded-md bg-primario px-4 text-sm font-semibold text-primario-texto"
            onClick={() => window.print()}
            type="button"
          >
            Imprimir ou salvar PDF
          </button>
          <Link
            className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium hover:bg-suave"
            href="/ordens-servico"
          >
            Voltar
          </Link>
        </div>

        {estado === "carregando" ? (
          <p className="text-sm text-suave-texto">Carregando OS...</p>
        ) : null}

        {estado === "configuracao" || estado === "erro" ? (
          <p className="rounded-md border bg-suave px-4 py-3 text-sm text-suave-texto">
            {mensagem ?? "Nao foi possivel carregar a OS."}
          </p>
        ) : null}

        {estado === "pronto" && ordem ? (
          <article className="grid gap-6">
            <header className="grid gap-4 border-b pb-5 md:grid-cols-[1fr_auto]">
              <div>
                <h1 className="text-2xl font-semibold">
                  {dadosOficina.nomeOficina}
                </h1>
                <p className="mt-1 text-sm text-suave-texto">
                  {dadosOficina.cidade}
                  {dadosOficina.telefone ? ` - ${dadosOficina.telefone}` : ""}
                  {dadosOficina.email ? ` - ${dadosOficina.email}` : ""}
                </p>
              </div>
              <div className="text-left md:text-right">
                <p className="text-sm text-suave-texto">Ordem de servico</p>
                <strong className="text-2xl">OS {ordem.numero}</strong>
                <p className="mt-1 text-sm">
                  {rotulosStatusOrdemServico[ordem.status]}
                </p>
              </div>
            </header>

            <section className="grid gap-4 md:grid-cols-2">
              <Bloco titulo="Cliente">
                <p>{ordem.cliente?.nome ?? "Cliente nao informado"}</p>
                <p className="text-sm text-suave-texto">
                  Documento: {ordem.cliente?.documento ?? "Nao informado"}
                </p>
              </Bloco>
              <Bloco titulo="Equipamento">
                <p>
                  {ordem.equipamento
                    ? [
                        ordem.equipamento.tipo,
                        ordem.equipamento.marca,
                        ordem.equipamento.modelo
                      ]
                        .filter(Boolean)
                        .join(" ")
                    : "Equipamento nao informado"}
                </p>
                <p className="text-sm text-suave-texto">
                  Serie: {ordem.equipamento?.numero_serie ?? "Nao informada"}
                </p>
              </Bloco>
            </section>

            <Bloco titulo="Relato e diagnostico">
              <p>{ordem.relato_cliente}</p>
              {ordem.diagnostico ? (
                <p className="mt-3">
                  <strong>Diagnostico:</strong> {ordem.diagnostico}
                </p>
              ) : null}
              {ordem.solucao ? (
                <p className="mt-3">
                  <strong>Solucao:</strong> {ordem.solucao}
                </p>
              ) : null}
            </Bloco>

            <section className="rounded-md border">
              <div className="border-b px-4 py-3">
                <h2 className="text-base font-semibold">Itens</h2>
              </div>
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-suave/60 text-suave-texto">
                  <tr>
                    <th className="px-4 py-3 font-medium">Descricao</th>
                    <th className="px-4 py-3 font-medium">Qtd</th>
                    <th className="px-4 py-3 font-medium">Unitario</th>
                    <th className="px-4 py-3 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((item) => (
                    <tr className="border-t" key={item.id}>
                      <td className="px-4 py-3">{item.descricao}</td>
                      <td className="px-4 py-3">{item.quantidade}</td>
                      <td className="px-4 py-3">
                        {formatarMoeda(item.valor_unitario)}
                      </td>
                      <td className="px-4 py-3">
                        {formatarMoeda(item.valor_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="ml-auto w-full max-w-sm rounded-md border p-4">
              <LinhaValor label="Mao de obra" valor={ordem.valor_mao_obra} />
              <LinhaValor label="Pecas" valor={ordem.valor_pecas} />
              <LinhaValor label="Desconto" valor={ordem.desconto} />
              <LinhaValor destaque label="Total" valor={ordem.valor_total} />
            </section>

            <Bloco titulo="Garantia e observacoes">
              <p>{dadosOficina.textoGarantia}</p>
            </Bloco>

            <footer className="grid gap-8 pt-10 md:grid-cols-2">
              <div className="border-t pt-3 text-center text-sm">
                Assinatura do cliente
              </div>
              <div className="border-t pt-3 text-center text-sm">
                Responsavel tecnico
              </div>
            </footer>
          </article>
        ) : null}
      </div>
    </main>
  );
}

function Bloco({
  children,
  titulo
}: {
  children: ReactNode;
  titulo: string;
}): JSX.Element {
  return (
    <section className="rounded-md border p-4">
      <h2 className="mb-3 text-base font-semibold">{titulo}</h2>
      <div className="text-sm leading-6">{children}</div>
    </section>
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
          ? "mt-2 flex justify-between border-t pt-2 font-semibold"
          : "flex justify-between py-1 text-sm"
      }
    >
      <span>{label}</span>
      <span>{formatarMoeda(valor)}</span>
    </div>
  );
}

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(Number(valor));
}
