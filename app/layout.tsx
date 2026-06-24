import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gestao de OS Agricola",
  description: "Sistema de gestao de ordens de servico para oficina agricola."
};

export default function LayoutRaiz({
  children
}: Readonly<{
  children: React.ReactNode;
}>): JSX.Element {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
