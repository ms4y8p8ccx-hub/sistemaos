# Schema do Banco de Dados

Etapa 2 do projeto: schema inicial do Supabase/PostgreSQL.

## Decisao tecnica

Nesta etapa o projeto usa Supabase direto, via `@supabase/supabase-js`, sem
Prisma. A escolha evita adicionar um ORM antes de haver necessidade real e
mantem o schema versionado em SQL nativo do PostgreSQL.

## Arquivos

- `supabase/migrations/20260622120000_schema_inicial.sql`: tabelas, enums,
  indices, constraints e triggers.
- `supabase/seed.sql`: dados de exemplo para testes manuais depois que o
  schema for aplicado.

## Entidades criadas

- `roles`
- `users`
- `clientes`
- `equipamentos`
- `fornecedores`
- `produtos`
- `ordens_servico`
- `transicoes_status_os`
- `itens_os`
- `movimentacoes_estoque`
- `financeiro_lancamentos`
- `notificacoes`
- `anexos`
- `auditoria`

## Regras importantes no banco

- Todas as tabelas possuem `criado_em` e `atualizado_em`.
- Triggers atualizam `atualizado_em` automaticamente.
- A OS registra historico em `transicoes_status_os` ao ser criada e quando o
  status muda.
- O fluxo de status da OS e validado no banco.
- Valores monetarios e quantidades possuem constraints basicas.
- `auditoria` fica pronta para as acoes relevantes da aplicacao registrarem
  quem fez, o que fez e quando fez.

## Proximo passo

Antes de aplicar no Supabase, revise o SQL da migration. Apos aprovacao, o
schema pode ser aplicado no banco e a etapa 3 pode iniciar: autenticacao e
gestao de usuarios/perfis.
