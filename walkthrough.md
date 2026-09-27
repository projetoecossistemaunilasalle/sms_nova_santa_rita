# Resumo das Alterações: Mock Visual & Deploy no GitHub Pages

O projeto começou como um **mock visual estático e independente de backend** hospedado no **GitHub Pages** e hoje mantém dois alvos de execução: o **export estático do GitHub Pages** (demonstração semeada no navegador) e o **servidor standalone** (Prisma + Neon Postgres + Neon Auth). A publicação no GitHub Pages faz parte do CI.

---

## 🔗 Link da Demonstração Online

- **URL do GitHub Pages:** [https://niciniv.github.io/SMS_Portal/](https://niciniv.github.io/SMS_Portal/)
- **Painel do Profissional:** [https://niciniv.github.io/SMS_Portal/portal/](https://niciniv.github.io/SMS_Portal/portal/)

---

## 🛠️ O que foi feito

### 1. Configuração de Exportação Estática (`output: 'export'`)

- Configurado `next.config.ts` com `output: "export"`, `basePath: "/SMS_Portal"`, `trailingSlash: true` e `images: { unoptimized: true }`.
- Adicionado `.nojekyll` na pasta `public/` para compatibilidade com os assets do Next.js no GitHub Pages.

### 2. Desvinculação do Banco de Dados e Remoção de Bloqueios

- **Dados sempre presentes na demo:** Organizações, equipe, turmas e jogadores são
  semeados no estado do navegador (chave `missoes-caramelito:adult-portal:v2`);
  o servidor continua usando Prisma e Neon Postgres no alvo `server`.
- **Remoção do endpoint de health:** As rotas `src/app/health/` foram removidas e
  não foram reintroduzidas; nenhuma rota pública chama o Prisma.

### 3. Interatividade por Alvo de Execução

- **Demo (`APP_RUNTIME_MODE=demo`):** O portal renderiza no cliente a partir do
  estado semeado (com seletor de perfil e botão **Restaurar demo**), e o login
  (`/entrar`) usa o botão "Entrar na demonstração" que leva a `/portal`.
- **Server (`APP_RUNTIME_MODE=server`):** O mesmo portal usa Server Actions,
  Prisma e Neon Auth; `/entrar` autentica via `signInAction`.
- **Jogadores:** A entrada pública (`/jogar`) resolve a credencial `?cred=` do QR
  impresso e entrega o contexto ao cliente GameMaker; offline, o jogo usa a fila
  IndexedDB em `src/runtime/offline/`.

### 4. Geração de Rotas Estáticas (`generateStaticParams`)

Adicionado `generateStaticParams()` em todas as rotas dinâmicas do App Router:

- `/portal/admin/organizacoes/[id]`
- `/portal/turmas/[id]`
- `/portal/resultados/[classGroupId]`
- `/portal/resultados/[classGroupId]/players/[playerSlotId]`

### 5. Deploy no GitHub Pages

- O workflow `.github/workflows/ci.yml` concentra tudo: o job `gate` roda as
  checagens em pull requests e pushes para `main`, e nos pushes para `main` o
  export de `build:demo` (`out/`) é publicado no GitHub Pages pelo job `deploy`
  do mesmo workflow.
- Não existe workflow de deploy separado; a publicação do Pages faz parte do CI.

---

## 🧪 Validação Realizada

- `npm run format:check` — 100% formatado com Prettier.
- `npm run lint` — 0 erros e 0 warnings.
- `npm run typecheck` — TypeScript validado para os alvos `server` e `demo`.
- `npm test` — Suíte unitária (Vitest) aprovada.
- `npm run build:demo` — Export estático gerado em `out/` com base `/SMS_Portal`.
- `npm run build:server` — Build standalone do servidor gerado em `.next/`.
- O job `gate` do CI roda essas mesmas etapas a cada push e pull request.
