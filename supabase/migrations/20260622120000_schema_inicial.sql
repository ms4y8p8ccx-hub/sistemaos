create extension if not exists pgcrypto;

do $$
begin
  create type perfil_usuario as enum (
    'administrador',
    'gerente',
    'tecnico',
    'financeiro',
    'atendente'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type tipo_pessoa as enum ('fisica', 'juridica');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type status_ordem_servico as enum (
    'aberta',
    'em_diagnostico',
    'aguardando_peca',
    'em_execucao',
    'aguardando_aprovacao_cliente',
    'concluida',
    'entregue',
    'cancelada'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type prioridade_ordem_servico as enum (
    'baixa',
    'normal',
    'alta',
    'urgente'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type tipo_item_os as enum ('peca', 'servico');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type tipo_movimentacao_estoque as enum (
    'entrada',
    'saida',
    'ajuste',
    'reserva',
    'devolucao'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type tipo_lancamento_financeiro as enum ('receita', 'despesa');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type status_lancamento_financeiro as enum (
    'pendente',
    'pago',
    'cancelado'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type tipo_notificacao as enum ('info', 'sucesso', 'alerta', 'erro');
exception
  when duplicate_object then null;
end $$;

create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  perfil perfil_usuario not null unique,
  descricao text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  role_id uuid not null references roles(id),
  nome text not null,
  email text not null unique,
  telefone text,
  ativo boolean not null default true,
  ultimo_acesso_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  tipo tipo_pessoa not null default 'fisica',
  nome text not null,
  documento text,
  email text,
  telefone text,
  celular text,
  endereco_logradouro text,
  endereco_numero text,
  endereco_complemento text,
  endereco_bairro text,
  endereco_cidade text,
  endereco_estado char(2),
  endereco_cep text,
  observacoes text,
  ativo boolean not null default true,
  criado_por_user_id uuid references users(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index if not exists clientes_documento_unico_idx
  on clientes (documento)
  where documento is not null and documento <> '';

create table if not exists equipamentos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete restrict,
  tipo text not null,
  marca text,
  modelo text,
  ano_fabricacao integer,
  numero_serie text,
  placa text,
  horimetro numeric(12, 2),
  observacoes text,
  ativo boolean not null default true,
  criado_por_user_id uuid references users(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint equipamentos_ano_valido_chk
    check (ano_fabricacao is null or ano_fabricacao between 1900 and 2100),
  constraint equipamentos_horimetro_nao_negativo_chk
    check (horimetro is null or horimetro >= 0)
);

create table if not exists fornecedores (
  id uuid primary key default gen_random_uuid(),
  tipo tipo_pessoa not null default 'juridica',
  nome text not null,
  documento text,
  email text,
  telefone text,
  contato_responsavel text,
  endereco_cidade text,
  endereco_estado char(2),
  observacoes text,
  ativo boolean not null default true,
  criado_por_user_id uuid references users(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index if not exists fornecedores_documento_unico_idx
  on fornecedores (documento)
  where documento is not null and documento <> '';

create table if not exists produtos (
  id uuid primary key default gen_random_uuid(),
  fornecedor_id uuid references fornecedores(id) on delete set null,
  codigo_sku text not null unique,
  nome text not null,
  descricao text,
  unidade_medida text not null default 'un',
  estoque_atual numeric(12, 3) not null default 0,
  estoque_minimo numeric(12, 3) not null default 0,
  preco_custo numeric(12, 2) not null default 0,
  preco_venda numeric(12, 2) not null default 0,
  localizacao_estoque text,
  ativo boolean not null default true,
  criado_por_user_id uuid references users(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint produtos_estoque_nao_negativo_chk
    check (estoque_atual >= 0 and estoque_minimo >= 0),
  constraint produtos_precos_nao_negativos_chk
    check (preco_custo >= 0 and preco_venda >= 0)
);

create table if not exists ordens_servico (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated by default as identity unique,
  cliente_id uuid not null references clientes(id) on delete restrict,
  equipamento_id uuid not null references equipamentos(id) on delete restrict,
  status status_ordem_servico not null default 'aberta',
  prioridade prioridade_ordem_servico not null default 'normal',
  tecnico_responsavel_user_id uuid references users(id),
  criado_por_user_id uuid references users(id),
  atualizado_por_user_id uuid references users(id),
  relato_cliente text not null,
  diagnostico text,
  solucao text,
  observacoes_internas text,
  valor_mao_obra numeric(12, 2) not null default 0,
  valor_pecas numeric(12, 2) not null default 0,
  desconto numeric(12, 2) not null default 0,
  valor_total numeric(12, 2)
    generated always as (valor_mao_obra + valor_pecas - desconto) stored,
  aberta_em timestamptz not null default now(),
  prevista_para timestamptz,
  concluida_em timestamptz,
  entregue_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint ordens_servico_valores_nao_negativos_chk
    check (valor_mao_obra >= 0 and valor_pecas >= 0 and desconto >= 0),
  constraint ordens_servico_total_nao_negativo_chk
    check ((valor_mao_obra + valor_pecas - desconto) >= 0)
);

create table if not exists transicoes_status_os (
  id uuid primary key default gen_random_uuid(),
  ordem_servico_id uuid not null references ordens_servico(id) on delete cascade,
  status_anterior status_ordem_servico,
  status_novo status_ordem_servico not null,
  user_id uuid references users(id),
  observacao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists itens_os (
  id uuid primary key default gen_random_uuid(),
  ordem_servico_id uuid not null references ordens_servico(id) on delete cascade,
  produto_id uuid references produtos(id) on delete set null,
  tipo tipo_item_os not null,
  descricao text not null,
  quantidade numeric(12, 3) not null default 1,
  valor_unitario numeric(12, 2) not null default 0,
  valor_total numeric(12, 2)
    generated always as (quantidade * valor_unitario) stored,
  criado_por_user_id uuid references users(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint itens_os_quantidade_positiva_chk check (quantidade > 0),
  constraint itens_os_valor_unitario_nao_negativo_chk check (valor_unitario >= 0)
);

create table if not exists movimentacoes_estoque (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references produtos(id) on delete restrict,
  ordem_servico_id uuid references ordens_servico(id) on delete set null,
  tipo tipo_movimentacao_estoque not null,
  quantidade numeric(12, 3) not null,
  custo_unitario numeric(12, 2),
  observacao text,
  user_id uuid references users(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint movimentacoes_estoque_quantidade_positiva_chk
    check (quantidade > 0),
  constraint movimentacoes_estoque_custo_nao_negativo_chk
    check (custo_unitario is null or custo_unitario >= 0)
);

create table if not exists financeiro_lancamentos (
  id uuid primary key default gen_random_uuid(),
  ordem_servico_id uuid references ordens_servico(id) on delete set null,
  cliente_id uuid references clientes(id) on delete set null,
  fornecedor_id uuid references fornecedores(id) on delete set null,
  tipo tipo_lancamento_financeiro not null,
  status status_lancamento_financeiro not null default 'pendente',
  categoria text not null,
  descricao text not null,
  valor numeric(12, 2) not null,
  data_vencimento date,
  data_pagamento date,
  metodo_pagamento text,
  observacao text,
  registrado_por_user_id uuid references users(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint financeiro_lancamentos_valor_positivo_chk check (valor > 0)
);

create table if not exists notificacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  tipo tipo_notificacao not null default 'info',
  titulo text not null,
  mensagem text not null,
  link text,
  lida_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists anexos (
  id uuid primary key default gen_random_uuid(),
  entidade text not null,
  entidade_id uuid not null,
  bucket text not null,
  caminho text not null,
  nome_original text not null,
  tipo_mime text,
  tamanho_bytes bigint,
  enviado_por_user_id uuid references users(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint anexos_tamanho_nao_negativo_chk
    check (tamanho_bytes is null or tamanho_bytes >= 0)
);

create table if not exists auditoria (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  acao text not null,
  entidade text not null,
  entidade_id uuid,
  dados_anteriores jsonb,
  dados_novos jsonb,
  ip inet,
  user_agent text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists users_role_id_idx on users (role_id);
create index if not exists users_auth_user_id_idx on users (auth_user_id);
create index if not exists clientes_nome_idx on clientes using gin (to_tsvector('portuguese', nome));
create index if not exists equipamentos_cliente_id_idx on equipamentos (cliente_id);
create index if not exists equipamentos_numero_serie_idx on equipamentos (numero_serie);
create index if not exists produtos_nome_idx on produtos using gin (to_tsvector('portuguese', nome));
create index if not exists ordens_servico_cliente_id_idx on ordens_servico (cliente_id);
create index if not exists ordens_servico_equipamento_id_idx on ordens_servico (equipamento_id);
create index if not exists ordens_servico_status_idx on ordens_servico (status);
create index if not exists ordens_servico_tecnico_idx on ordens_servico (tecnico_responsavel_user_id);
create index if not exists transicoes_status_os_ordem_idx on transicoes_status_os (ordem_servico_id);
create index if not exists itens_os_ordem_idx on itens_os (ordem_servico_id);
create index if not exists movimentacoes_estoque_produto_idx on movimentacoes_estoque (produto_id);
create index if not exists financeiro_lancamentos_status_idx on financeiro_lancamentos (status);
create index if not exists financeiro_lancamentos_vencimento_idx on financeiro_lancamentos (data_vencimento);
create index if not exists notificacoes_user_lida_idx on notificacoes (user_id, lida_em);
create index if not exists auditoria_entidade_idx on auditoria (entidade, entidade_id);
create index if not exists auditoria_criado_em_idx on auditoria (criado_em);

create or replace function registrar_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create or replace function status_os_transicao_valida(
  status_anterior status_ordem_servico,
  status_novo status_ordem_servico
)
returns boolean
language sql
immutable
as $$
  select
    status_anterior is null
    or status_anterior = status_novo
    or (
      status_novo = 'cancelada'
      and status_anterior in (
        'aberta',
        'em_diagnostico',
        'aguardando_peca',
        'em_execucao',
        'aguardando_aprovacao_cliente'
      )
    )
    or (status_anterior = 'aberta' and status_novo = 'em_diagnostico')
    or (status_anterior = 'em_diagnostico' and status_novo = 'aguardando_peca')
    or (status_anterior = 'aguardando_peca' and status_novo = 'em_execucao')
    or (
      status_anterior = 'em_execucao'
      and status_novo = 'aguardando_aprovacao_cliente'
    )
    or (
      status_anterior = 'aguardando_aprovacao_cliente'
      and status_novo = 'concluida'
    )
    or (status_anterior = 'concluida' and status_novo = 'entregue');
$$;

create or replace function validar_transicao_status_os()
returns trigger
language plpgsql
as $$
begin
  if not status_os_transicao_valida(old.status, new.status) then
    raise exception 'Transicao de status invalida: % -> %', old.status, new.status;
  end if;

  if new.status = 'concluida' and old.status is distinct from new.status then
    new.concluida_em = coalesce(new.concluida_em, now());
  end if;

  if new.status = 'entregue' and old.status is distinct from new.status then
    new.entregue_em = coalesce(new.entregue_em, now());
  end if;

  return new;
end;
$$;

create or replace function registrar_transicao_status_os()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;

  insert into transicoes_status_os (
    ordem_servico_id,
    status_anterior,
    status_novo,
    user_id
  )
  values (
    new.id,
    case when tg_op = 'INSERT' then null else old.status end,
    new.status,
    coalesce(new.atualizado_por_user_id, new.criado_por_user_id)
  );

  return new;
end;
$$;

drop trigger if exists roles_atualizado_em_trg on roles;
create trigger roles_atualizado_em_trg
before update on roles
for each row execute function registrar_atualizado_em();

drop trigger if exists users_atualizado_em_trg on users;
create trigger users_atualizado_em_trg
before update on users
for each row execute function registrar_atualizado_em();

drop trigger if exists clientes_atualizado_em_trg on clientes;
create trigger clientes_atualizado_em_trg
before update on clientes
for each row execute function registrar_atualizado_em();

drop trigger if exists equipamentos_atualizado_em_trg on equipamentos;
create trigger equipamentos_atualizado_em_trg
before update on equipamentos
for each row execute function registrar_atualizado_em();

drop trigger if exists fornecedores_atualizado_em_trg on fornecedores;
create trigger fornecedores_atualizado_em_trg
before update on fornecedores
for each row execute function registrar_atualizado_em();

drop trigger if exists produtos_atualizado_em_trg on produtos;
create trigger produtos_atualizado_em_trg
before update on produtos
for each row execute function registrar_atualizado_em();

drop trigger if exists ordens_servico_atualizado_em_trg on ordens_servico;
create trigger ordens_servico_atualizado_em_trg
before update on ordens_servico
for each row execute function registrar_atualizado_em();

drop trigger if exists ordens_servico_validar_status_trg on ordens_servico;
create trigger ordens_servico_validar_status_trg
before update of status on ordens_servico
for each row execute function validar_transicao_status_os();

drop trigger if exists ordens_servico_registrar_status_trg on ordens_servico;
create trigger ordens_servico_registrar_status_trg
after insert or update of status on ordens_servico
for each row
execute function registrar_transicao_status_os();

drop trigger if exists transicoes_status_os_atualizado_em_trg on transicoes_status_os;
create trigger transicoes_status_os_atualizado_em_trg
before update on transicoes_status_os
for each row execute function registrar_atualizado_em();

drop trigger if exists itens_os_atualizado_em_trg on itens_os;
create trigger itens_os_atualizado_em_trg
before update on itens_os
for each row execute function registrar_atualizado_em();

drop trigger if exists movimentacoes_estoque_atualizado_em_trg on movimentacoes_estoque;
create trigger movimentacoes_estoque_atualizado_em_trg
before update on movimentacoes_estoque
for each row execute function registrar_atualizado_em();

drop trigger if exists financeiro_lancamentos_atualizado_em_trg on financeiro_lancamentos;
create trigger financeiro_lancamentos_atualizado_em_trg
before update on financeiro_lancamentos
for each row execute function registrar_atualizado_em();

drop trigger if exists notificacoes_atualizado_em_trg on notificacoes;
create trigger notificacoes_atualizado_em_trg
before update on notificacoes
for each row execute function registrar_atualizado_em();

drop trigger if exists anexos_atualizado_em_trg on anexos;
create trigger anexos_atualizado_em_trg
before update on anexos
for each row execute function registrar_atualizado_em();

drop trigger if exists auditoria_atualizado_em_trg on auditoria;
create trigger auditoria_atualizado_em_trg
before update on auditoria
for each row execute function registrar_atualizado_em();
