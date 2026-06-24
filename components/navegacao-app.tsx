"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  podeGerenciarConfiguracoes,
  podeGerenciarUsuarios,
  podeVerClientes,
  podeVerEquipamentos,
  podeVerEstoque,
  podeVerFinanceiro,
  podeVerOrdensServico,
  podeVerRelatorios
} from "@/lib/auth/permissoes";
import type { PerfilUsuario } from "@/types";

type ItemNavegacao = {
  href: string;
  label: string;
  descricao: string;
  visivel: boolean;
};

export function NavegacaoApp({
  perfil
}: {
  perfil?: PerfilUsuario | null;
}): JSX.Element {
  const pathname = usePathname();

  const itens: ItemNavegacao[] = [
    {
      href: "/painel",
      label: "Inicio",
      descricao: "atalhos",
      visivel: true
    },
    {
      href: "/dashboard",
      label: "Dashboard",
      descricao: "visao geral",
      visivel: true
    },
    {
      href: "/ordens-servico",
      label: "OS",
      descricao: "kanban",
      visivel: Boolean(perfil && podeVerOrdensServico(perfil))
    },
    {
      href: "/clientes",
      label: "Clientes",
      descricao: "cadastros",
      visivel: Boolean(perfil && podeVerClientes(perfil))
    },
    {
      href: "/equipamentos",
      label: "Equipamentos",
      descricao: "maquinas",
      visivel: Boolean(perfil && podeVerEquipamentos(perfil))
    },
    {
      href: "/estoque",
      label: "Estoque",
      descricao: "pecas",
      visivel: Boolean(perfil && podeVerEstoque(perfil))
    },
    {
      href: "/financeiro",
      label: "Financeiro",
      descricao: "contas",
      visivel: Boolean(perfil && podeVerFinanceiro(perfil))
    },
    {
      href: "/notificacoes",
      label: "Avisos",
      descricao: "alertas",
      visivel: true
    },
    {
      href: "/relatorios",
      label: "Relatorios",
      descricao: "analise",
      visivel: Boolean(perfil && podeVerRelatorios(perfil))
    },
    {
      href: "/usuarios",
      label: "Usuarios",
      descricao: "equipe",
      visivel: Boolean(perfil && podeGerenciarUsuarios(perfil))
    },
    {
      href: "/configuracoes",
      label: "Config",
      descricao: "sistema",
      visivel: Boolean(perfil && podeGerenciarConfiguracoes(perfil))
    }
  ];

  return (
    <nav className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-6 py-3">
        {itens
          .filter((item) => item.visivel)
          .map((item) => {
            const ativo =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                className={
                  ativo
                    ? "min-w-fit rounded-md border border-primario bg-primario px-3 py-2 text-sm font-semibold text-primario-texto"
                    : "min-w-fit rounded-md border bg-white px-3 py-2 text-sm font-medium hover:border-primario hover:bg-suave"
                }
                href={item.href}
                key={item.href}
              >
                <span className="block leading-4">{item.label}</span>
                <span
                  className={
                    ativo
                      ? "block text-[11px] font-medium text-primario-texto/80"
                      : "block text-[11px] font-medium text-suave-texto"
                  }
                >
                  {item.descricao}
                </span>
              </Link>
            );
          })}
      </div>
    </nav>
  );
}
