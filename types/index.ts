export type PerfilUsuario =
  | "administrador"
  | "gerente"
  | "tecnico"
  | "financeiro"
  | "atendente";

export type StatusOrdemServico =
  | "aberta"
  | "em_diagnostico"
  | "aguardando_peca"
  | "em_execucao"
  | "aguardando_aprovacao_cliente"
  | "concluida"
  | "entregue"
  | "cancelada";

export type PrioridadeOrdemServico = "baixa" | "normal" | "alta" | "urgente";

export type TipoItemOs = "peca" | "servico";

export type TipoMovimentacaoEstoque =
  | "entrada"
  | "saida"
  | "ajuste"
  | "reserva"
  | "devolucao";

export type TipoLancamentoFinanceiro = "receita" | "despesa";

export type StatusLancamentoFinanceiro = "pendente" | "pago" | "cancelado";

export type TipoNotificacao = "info" | "sucesso" | "alerta" | "erro";

export type TipoPessoa = "fisica" | "juridica";

export type PapelSistema = {
  id: string;
  nome: string;
  perfil: PerfilUsuario;
  descricao: string | null;
  ativo: boolean;
};

export type UsuarioSistema = {
  id: string;
  auth_user_id: string | null;
  nome: string;
  email: string;
  telefone: string | null;
  ativo: boolean;
  role_id: string;
  role: {
    id: string;
    nome: string;
    perfil: PerfilUsuario;
  } | null;
};

export type Cliente = {
  id: string;
  tipo: TipoPessoa;
  nome: string;
  documento: string | null;
  email: string | null;
  telefone: string | null;
  celular: string | null;
  endereco_logradouro: string | null;
  endereco_numero: string | null;
  endereco_complemento: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_estado: string | null;
  endereco_cep: string | null;
  observacoes: string | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
};

export type Equipamento = {
  id: string;
  cliente_id: string;
  tipo: string;
  marca: string | null;
  modelo: string | null;
  ano_fabricacao: number | null;
  numero_serie: string | null;
  placa: string | null;
  horimetro: number | null;
  observacoes: string | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
  cliente?: {
    id: string;
    nome: string;
    documento: string | null;
  } | null;
};

export type OrdemServico = {
  id: string;
  numero: number;
  cliente_id: string;
  equipamento_id: string;
  status: StatusOrdemServico;
  prioridade: PrioridadeOrdemServico;
  tecnico_responsavel_user_id: string | null;
  relato_cliente: string;
  diagnostico: string | null;
  solucao: string | null;
  observacoes_internas: string | null;
  valor_mao_obra: number;
  valor_pecas: number;
  desconto: number;
  valor_total: number;
  aberta_em: string;
  prevista_para: string | null;
  concluida_em: string | null;
  entregue_em: string | null;
  criado_em: string;
  atualizado_em: string;
  cliente?: {
    id: string;
    nome: string;
    documento: string | null;
  } | null;
  equipamento?: {
    id: string;
    tipo: string;
    marca: string | null;
    modelo: string | null;
    numero_serie: string | null;
  } | null;
  tecnico?: {
    id: string;
    nome: string;
    email: string;
  } | null;
};

export type ItemOrdemServico = {
  id: string;
  ordem_servico_id: string;
  produto_id: string | null;
  tipo: TipoItemOs;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  criado_em: string;
  atualizado_em: string;
};

export type Fornecedor = {
  id: string;
  tipo: TipoPessoa;
  nome: string;
  documento: string | null;
  email: string | null;
  telefone: string | null;
  contato_responsavel: string | null;
  endereco_cidade: string | null;
  endereco_estado: string | null;
  observacoes: string | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
};

export type Produto = {
  id: string;
  fornecedor_id: string | null;
  codigo_sku: string;
  nome: string;
  descricao: string | null;
  unidade_medida: string;
  estoque_atual: number;
  estoque_minimo: number;
  preco_custo: number;
  preco_venda: number;
  localizacao_estoque: string | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
  fornecedor?: {
    id: string;
    nome: string;
  } | null;
};

export type MovimentacaoEstoque = {
  id: string;
  produto_id: string;
  ordem_servico_id: string | null;
  tipo: TipoMovimentacaoEstoque;
  quantidade: number;
  custo_unitario: number | null;
  observacao: string | null;
  criado_em: string;
  atualizado_em: string;
  produto?: {
    id: string;
    codigo_sku: string;
    nome: string;
  } | null;
};

export type LancamentoFinanceiro = {
  id: string;
  ordem_servico_id: string | null;
  cliente_id: string | null;
  fornecedor_id: string | null;
  tipo: TipoLancamentoFinanceiro;
  status: StatusLancamentoFinanceiro;
  categoria: string;
  descricao: string;
  valor: number;
  data_vencimento: string | null;
  data_pagamento: string | null;
  metodo_pagamento: string | null;
  observacao: string | null;
  criado_em: string;
  atualizado_em: string;
  ordem_servico?: {
    id: string;
    numero: number;
    valor_total: number;
  } | null;
  cliente?: {
    id: string;
    nome: string;
  } | null;
  fornecedor?: {
    id: string;
    nome: string;
  } | null;
};

export type Notificacao = {
  id: string;
  user_id: string;
  tipo: TipoNotificacao;
  titulo: string;
  mensagem: string;
  link: string | null;
  lida_em: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type Auditoria = {
  id: string;
  user_id: string | null;
  acao: string;
  entidade: string;
  entidade_id: string | null;
  criado_em: string;
  user?: {
    id: string;
    nome: string;
    email: string;
  } | null;
};
