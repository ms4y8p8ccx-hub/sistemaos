# AGENTS.md — Sistema de Gestão de Ordens de Serviço (Oficina/Mecânica Agrícola)

> Este arquivo fica na raiz do repositório. O Codex CLI lê este arquivo automaticamente em todo turno, então tudo aqui é regra permanente do projeto — não precisa ser repetido nos prompts do dia a dia.

---

## Visão do Projeto

Sistema web completo de **gestão de ordens de serviço (OS) para oficina/mecânica agrícola**, cobrindo o fluxo abertura → diagnóstico → execução → fechamento de OS, com clientes, equipamentos, estoque de peças, financeiro, multiusuário (perfis/permissões) e notificações.

Referência de produto: sistemas como AgroOS Pro / AgoraOS — painel administrativo para oficinas que atendem máquinas e implementos agrícolas (tratores, colheitadeiras, pulverizadores).

---

## Stack do Projeto

- **Frontend:** Next.js 14+ (App Router), TypeScript, Tailwind CSS
- **Componentes:** shadcn/ui
- **Backend:** API Routes do Next.js (full-stack)
- **Banco de dados:** PostgreSQL via Supabase (auth, storage e realtime incluídos)
- **ORM:** Prisma (se não usar o client do Supabase direto)
- **Gráficos:** Recharts
- **PDF:** react-pdf ou puppeteer
- **Notificações:** Supabase Realtime (in-app) + Resend (e-mail transacional)

Não troque nenhum item dessa stack sem perguntar antes. Se algo não estiver especificado (ex: biblioteca de formulários, gerenciador de estado), escolha a opção mais simples e amplamente usada no ecossistema Next.js e explique a escolha antes de instalar.

---

## Estrutura e Convenções de Código

- Código em TypeScript, com tipagem explícita em funções públicas e modelos de dados
- Comentários e nomes de variáveis/funções em **português**, de forma consistente em todo o projeto
- Organização de pastas sugerida:
  ```
  /app                  → rotas (App Router)
  /components           → componentes reutilizáveis (ui/ para shadcn)
  /lib                  → utilitários, clients (supabase, prisma), helpers
  /lib/validations       → schemas de validação (zod)
  /types                → tipos e interfaces compartilhadas
  /prisma (ou /supabase) → schema do banco, migrations, seed
  ```
- Toda tabela do banco deve ter `criado_em` e `atualizado_em`
- Toda ação relevante (criar OS, mudar status, baixar estoque, registrar pagamento) deve gerar um registro de auditoria simples (quem fez, o quê, quando)
- Use Server Components por padrão; só use Client Components (`"use client"`) quando houver interatividade real (formulários, drag-and-drop do Kanban, etc.)
- Valide todo input de formulário e de API com **zod**

---

## Modelagem de Dados (resumo)

Entidades principais — ver detalhamento completo no prompt de especificação do projeto (`docs/especificacao.md`, se existir, ou no histórico de instruções do usuário):

`users`, `roles`, `clientes`, `equipamentos`, `ordens_servico`, `itens_os`, `produtos` (estoque), `movimentacoes_estoque`, `fornecedores`, `financeiro_lancamentos`, `notificacoes`, `anexos`.

Não altere o schema do banco sem antes mostrar o diff do schema e esperar aprovação — mudanças de banco são sensíveis e podem quebrar dados existentes.

---

## Perfis de Usuário (Roles)

- **Administrador** — acesso total, incluindo configurações e gestão de usuários
- **Gerente** — tudo exceto configurações do sistema
- **Técnico/Mecânico** — vê apenas OS atribuídas a ele; atualiza status, adiciona itens e fotos
- **Financeiro** — acesso ao módulo financeiro e relatórios
- **Atendente** — cadastra clientes, abre OS; sem acesso ao financeiro

Sempre que implementar uma rota ou ação, verifique e aplique a regra de permissão correspondente ao perfil. Nunca exponha dados financeiros ou de outros técnicos para perfis sem acesso.

---

## Fluxo de Status da OS

```
Aberta → Em Diagnóstico → Aguardando Peça → Em Execução →
Aguardando Aprovação do Cliente → Concluída → Entregue
(Cancelada pode ocorrer a partir de qualquer status anterior a Concluída)
```

Toda transição de status deve ser registrada com timestamp e usuário responsável.

---

## Comandos do Projeto

> Ajuste estes comandos conforme forem definidos no `package.json` real do projeto.

- Instalar dependências: `npm install`
- Ambiente de desenvolvimento: `npm run dev`
- Build de produção: `npm run build`
- Lint: `npm run lint`
- Checagem de tipos: `npm run typecheck` (ou `tsc --noEmit`)
- Testes: `npm run test`
- Migrations do banco (Prisma): `npx prisma migrate dev`
- Seed do banco: `npm run seed`

**Antes de considerar qualquer tarefa concluída, rode lint, typecheck e testes (quando existirem) e corrija o que falhar.** Se algum comando não existir ainda no projeto, crie-o no `package.json` ao configurar o setup inicial.

---

## Definição de "Pronto" (Definition of Done)

Uma tarefa só está pronta quando:
1. O código compila sem erros de tipo (`typecheck` passa)
2. O lint passa sem warnings novos
3. A funcionalidade foi testada manualmente (descreva como testar, já que não há ambiente de preview automático)
4. Há tratamento de erro visível ao usuário (toasts/mensagens), não apenas `console.log`
5. Regras de permissão por perfil foram respeitadas
6. O `README.md` e o `.env.example` foram atualizados se novas variáveis de ambiente foram introduzidas

---

## Ordem de Desenvolvimento

Siga esta ordem ao construir o sistema do zero. **Não avance para o próximo item sem antes mostrar o que foi feito e esperar confirmação:**

1. Setup do projeto (Next.js + Tailwind + shadcn/ui + conexão com Supabase/Postgres)
2. Schema completo do banco de dados
3. Autenticação + gestão de usuários/perfis
4. CRUD de clientes
5. CRUD de equipamentos
6. Módulo de Ordens de Serviço (Kanban, itens, status, orçamento)
7. Módulo de estoque
8. Módulo financeiro
9. Notificações
10. Dashboard e relatórios
11. Configurações gerais
12. Polimento de UI, responsividade, geração de PDFs

---

## Regras Gerais de Comportamento do Agent

- **Pergunte antes de instalar** qualquer biblioteca que não esteja listada na stack acima
- **Pergunte antes de alterar o schema do banco** ou de remover/renomear campos existentes
- **Não implemente funcionalidades além do que foi pedido** numa determinada etapa — é melhor um módulo simples e funcional do que vários módulos incompletos
- **Gere dados de seed** (exemplos de clientes, equipamentos, OS) para facilitar testes manuais
- **Mantenha o `.env.example` e o `README.md` sempre atualizados**
- Ao terminar uma tarefa, **resuma o que foi alterado** (arquivos criados/modificados) e **como testar**
- Em caso de ambiguidade não coberta por este documento, escolha a opção mais simples e mais comum no ecossistema Next.js/TypeScript, e avise qual decisão foi tomada e por quê
