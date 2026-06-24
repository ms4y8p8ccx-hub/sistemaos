# Sistema OS Agricola

Sistema web para gestao de ordens de servico de oficina/mecanica agricola, com clientes, equipamentos, OS, estoque, financeiro, notificacoes, dashboard e configuracoes.

## Stack

- Next.js 14 com App Router
- TypeScript
- Tailwind CSS
- Supabase/PostgreSQL
- Zod
- Recharts
- React PDF
- Resend

## Ambiente local

1. Instale as dependencias:

```bash
npm install
```

2. Crie o arquivo `.env.local` com base no `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
```

3. Rode o projeto:

```bash
npm run dev
```

4. Acesse:

```text
http://127.0.0.1:3000
```

## Banco de dados

O schema inicial esta em:

```text
supabase/migrations/20260622120000_schema_inicial.sql
```

Os dados de exemplo estao em:

```text
supabase/seed.sql
```

Para configurar um projeto Supabase novo, execute primeiro a migration no SQL Editor do Supabase e depois rode o seed.

## Deploy na Vercel

O projeto esta pronto para ser importado pela Vercel a partir do GitHub.

Configuracao recomendada no painel da Vercel:

- Framework Preset: `Next.js`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: deixe em branco/padrao
- Production Branch: `main`

Variaveis de ambiente obrigatorias na Vercel:

```bash
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Variaveis opcionais para e-mail transacional:

```bash
RESEND_API_KEY
RESEND_FROM_EMAIL
```

Marque as variaveis para `Production` e `Preview`. Depois de alterar variaveis de ambiente na Vercel, faca um novo deploy para elas entrarem em vigor.

## Comandos de validacao

Antes de publicar alteracoes relevantes:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Perfis do sistema

- Administrador: acesso total
- Gerente: operacao completa sem configuracoes sensiveis
- Tecnico/Mecanico: OS atribuidas, status, itens e evidencias
- Financeiro: lancamentos e relatorios financeiros
- Atendente: clientes, equipamentos e abertura de OS
