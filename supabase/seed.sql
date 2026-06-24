insert into roles (id, nome, perfil, descricao)
values
  (
    '00000000-0000-0000-0000-000000000001',
    'Administrador',
    'administrador',
    'Acesso total ao sistema.'
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'Gerente',
    'gerente',
    'Acesso operacional completo, exceto configuracoes do sistema.'
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'Tecnico',
    'tecnico',
    'Acompanha e executa ordens de servico atribuidas.'
  ),
  (
    '00000000-0000-0000-0000-000000000004',
    'Financeiro',
    'financeiro',
    'Acesso ao financeiro e relatorios.'
  ),
  (
    '00000000-0000-0000-0000-000000000005',
    'Atendente',
    'atendente',
    'Cadastra clientes, equipamentos e abre ordens de servico.'
  )
on conflict (perfil) do update
set
  nome = excluded.nome,
  descricao = excluded.descricao,
  ativo = true;

insert into users (id, role_id, nome, email)
values (
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Sistema',
  'sistema@oficina.local'
)
on conflict (email) do update
set
  nome = excluded.nome,
  role_id = excluded.role_id,
  ativo = true;

insert into clientes (
  id,
  tipo,
  nome,
  documento,
  email,
  telefone,
  endereco_cidade,
  endereco_estado,
  criado_por_user_id
)
values
  (
    '20000000-0000-0000-0000-000000000001',
    'juridica',
    'Fazenda Santa Helena',
    '12345678000190',
    'contato@santahelena.local',
    '(18) 3333-1000',
    'Presidente Prudente',
    'SP',
    '10000000-0000-0000-0000-000000000001'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    'fisica',
    'Joao Ribeiro',
    '12345678901',
    'joao.ribeiro@example.com',
    '(18) 99999-2000',
    'Assis',
    'SP',
    '10000000-0000-0000-0000-000000000001'
  )
on conflict do nothing;

insert into equipamentos (
  id,
  cliente_id,
  tipo,
  marca,
  modelo,
  ano_fabricacao,
  numero_serie,
  horimetro,
  criado_por_user_id
)
values
  (
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'Trator',
    'John Deere',
    '6110J',
    2020,
    'JD6110J-2020-001',
    2450,
    '10000000-0000-0000-0000-000000000001'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    'Pulverizador',
    'Jacto',
    'Uniport 3030',
    2019,
    'JACTO-3030-7788',
    1870,
    '10000000-0000-0000-0000-000000000001'
  )
on conflict do nothing;

insert into fornecedores (
  id,
  tipo,
  nome,
  documento,
  email,
  telefone,
  contato_responsavel,
  criado_por_user_id
)
values (
  '40000000-0000-0000-0000-000000000001',
  'juridica',
  'Agro Pecas Oeste',
  '98765432000110',
  'vendas@agropecasoeste.local',
  '(18) 3333-4000',
  'Mariana Lopes',
  '10000000-0000-0000-0000-000000000001'
)
on conflict do nothing;

insert into produtos (
  id,
  fornecedor_id,
  codigo_sku,
  nome,
  descricao,
  unidade_medida,
  estoque_atual,
  estoque_minimo,
  preco_custo,
  preco_venda,
  localizacao_estoque,
  criado_por_user_id
)
values
  (
    '50000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    'FILT-OLEO-001',
    'Filtro de oleo motor',
    'Filtro compativel com tratores linha media.',
    'un',
    12,
    4,
    85,
    135,
    'A1-03',
    '10000000-0000-0000-0000-000000000001'
  ),
  (
    '50000000-0000-0000-0000-000000000002',
    '40000000-0000-0000-0000-000000000001',
    'OLEO-15W40-20L',
    'Oleo diesel 15W40 20L',
    'Balde 20 litros para motores diesel.',
    'bd',
    8,
    3,
    310,
    430,
    'B2-01',
    '10000000-0000-0000-0000-000000000001'
  )
on conflict (codigo_sku) do update
set
  nome = excluded.nome,
  descricao = excluded.descricao,
  estoque_atual = excluded.estoque_atual,
  estoque_minimo = excluded.estoque_minimo,
  preco_custo = excluded.preco_custo,
  preco_venda = excluded.preco_venda,
  ativo = true;

insert into ordens_servico (
  id,
  cliente_id,
  equipamento_id,
  status,
  prioridade,
  criado_por_user_id,
  atualizado_por_user_id,
  relato_cliente,
  valor_mao_obra,
  valor_pecas
)
values (
  '60000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  'aberta',
  'alta',
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Cliente relata perda de potencia e vazamento proximo ao filtro.',
  320,
  135
)
on conflict do nothing;

insert into itens_os (
  id,
  ordem_servico_id,
  produto_id,
  tipo,
  descricao,
  quantidade,
  valor_unitario,
  criado_por_user_id
)
values
  (
    '70000000-0000-0000-0000-000000000001',
    '60000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000001',
    'peca',
    'Filtro de oleo motor',
    1,
    135,
    '10000000-0000-0000-0000-000000000001'
  ),
  (
    '70000000-0000-0000-0000-000000000002',
    '60000000-0000-0000-0000-000000000001',
    null,
    'servico',
    'Diagnostico inicial e troca de filtro',
    1,
    320,
    '10000000-0000-0000-0000-000000000001'
  )
on conflict do nothing;
