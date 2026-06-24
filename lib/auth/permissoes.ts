import type { PerfilUsuario } from "@/types";

export const perfisUsuarios: Array<{
  perfil: PerfilUsuario;
  nome: string;
  descricao: string;
}> = [
  {
    perfil: "administrador",
    nome: "Administrador",
    descricao: "Acesso total, incluindo configuracoes e usuarios."
  },
  {
    perfil: "gerente",
    nome: "Gerente",
    descricao: "Operacao completa, exceto configuracoes do sistema."
  },
  {
    perfil: "tecnico",
    nome: "Tecnico",
    descricao: "Acompanha ordens atribuidas e registra execucao."
  },
  {
    perfil: "financeiro",
    nome: "Financeiro",
    descricao: "Acesso ao financeiro e relatorios."
  },
  {
    perfil: "atendente",
    nome: "Atendente",
    descricao: "Cadastra clientes, equipamentos e abre OS."
  }
];

export function podeGerenciarUsuarios(perfil: PerfilUsuario): boolean {
  return perfil === "administrador";
}

export function podeVerFinanceiro(perfil: PerfilUsuario): boolean {
  return perfil === "administrador" || perfil === "gerente" || perfil === "financeiro";
}

export function podeGerenciarFinanceiro(perfil: PerfilUsuario): boolean {
  return perfil === "administrador" || perfil === "gerente" || perfil === "financeiro";
}

export function podeVerRelatorios(perfil: PerfilUsuario): boolean {
  return perfil === "administrador" || perfil === "gerente" || perfil === "financeiro";
}

export function podeGerenciarConfiguracoes(perfil: PerfilUsuario): boolean {
  return perfil === "administrador";
}

export function podeEnviarNotificacoes(perfil: PerfilUsuario): boolean {
  return perfil === "administrador" || perfil === "gerente";
}

export function podeAbrirOrdemServico(perfil: PerfilUsuario): boolean {
  return perfil === "administrador" || perfil === "gerente" || perfil === "atendente";
}

export function podeVerOrdensServico(perfil: PerfilUsuario): boolean {
  return (
    perfil === "administrador" ||
    perfil === "gerente" ||
    perfil === "atendente" ||
    perfil === "tecnico"
  );
}

export function podeGerenciarOrdensServico(perfil: PerfilUsuario): boolean {
  return perfil === "administrador" || perfil === "gerente" || perfil === "atendente";
}

export function podeExecutarOrdemServico(perfil: PerfilUsuario): boolean {
  return perfil === "administrador" || perfil === "gerente" || perfil === "tecnico";
}

export function podeVerClientes(perfil: PerfilUsuario): boolean {
  return (
    perfil === "administrador" ||
    perfil === "gerente" ||
    perfil === "atendente" ||
    perfil === "financeiro"
  );
}

export function podeGerenciarClientes(perfil: PerfilUsuario): boolean {
  return perfil === "administrador" || perfil === "gerente" || perfil === "atendente";
}

export function podeVerEquipamentos(perfil: PerfilUsuario): boolean {
  return (
    perfil === "administrador" ||
    perfil === "gerente" ||
    perfil === "atendente" ||
    perfil === "tecnico"
  );
}

export function podeGerenciarEquipamentos(perfil: PerfilUsuario): boolean {
  return perfil === "administrador" || perfil === "gerente" || perfil === "atendente";
}

export function podeVerEstoque(perfil: PerfilUsuario): boolean {
  return perfil === "administrador" || perfil === "gerente" || perfil === "tecnico";
}

export function podeGerenciarEstoque(perfil: PerfilUsuario): boolean {
  return perfil === "administrador" || perfil === "gerente";
}
