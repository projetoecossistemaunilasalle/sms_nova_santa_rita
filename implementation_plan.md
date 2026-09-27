# Plano de Implementação: Mock Visual Estático & Deploy no GitHub Pages

> **Status: documento histórico.** Este plano registrou a adaptação original do
> repositório para um mock estático no GitHub Pages. Ele foi superado por
> [docs/refactor-dossier/IMPLEMENTATION-READY.md](docs/refactor-dossier/IMPLEMENTATION-READY.md)
> e [docs/current-architecture.md](docs/current-architecture.md); o conteúdo
> abaixo permanece apenas como registro histórico dessa fase e não deve ser
> seguido como orientação atual.

Este plano adapta o **SMS_Portal** para funcionar como um **mock 100% visual e estático** no **GitHub Pages**, desvinculando todas as dependências de banco de dados (Prisma/Neon), removendo travas de autenticação, adicionando suporte a exportação estática (`output: 'export'`) e realizando o deploy direto no repositório `niciniV/SMS_Portal`.

---

## 1. Configuração do Next.js para GitHub Pages

- **`next.config.ts`**:
  - Configurar `output: "export"`.
  - Configurar `basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? (process.env.NODE_ENV === "production" ? "/SMS_Portal" : "")`.
  - Configurar `images: { unoptimized: true }`.
  - Remover redirecionamentos do servidor (`redirects()`) incompatíveis com export estático.

---

## 2. Desvinculação do Banco de Dados e Travas de Servidor

- **Fixtures de Demonstração (`src/server/services/portal-view-service.ts`)**:
  - Remover a checagem `process.env.NODE_ENV === "production" ? [] : fixtures` para que todos os dados de turmas, materiais, organizações e links apareçam no build estático.
- **Autenticação e Sessão Mockada (`src/server/auth/gateway.ts` e `layout.tsx`)**:
  - Fazer o `getAuthGateway()` retornar sempre a sessão mockada do profissional (`DEV_BYPASS_ACTOR`), permitindo navegação irrestrita no portal.
  - Remover `force-dynamic`, `cookies()` e `headers()`.
- **Rotas de Atividades Públicas (`src/app/(public-play)/atividade/`)**:
  - Substituir a chamada a `PrismaAccessLinkStore` por consulta direta às fixtures mockadas.
  - No launcher do jogo (`/jogar`), incluir um visualizador/placeholder interativo seguro caso nenhuma URL externa de jogo esteja configurada.
- **Remoção de Rotas de API Backend**:
  - Remover `src/app/health/` (rotas de API não são suportadas em static export).
  - Remover `src/proxy.ts` (middleware não roda em static export).

---

## 3. Navegação e Interatividade no Cliente (Sem Server Actions)

- **Tela de Login (`src/app/(professional)/entrar/page.tsx` e `/recuperar`)**:
  - Transformar o formulário de login em uma transição suave para `/portal`.
  - Incluir atalho direto "Acessar Demonstração".
- **Controles de Link (`src/components/portal/activity-controls.tsx`)**:
  - Transformar ações de pausar, retomar, rotacionar e encerrar em interações com estado local do React e toasts de aviso visual.
- **Criador e Editor de Links (`src/components/portal/activity-builder.tsx`)**:
  - Substituir `useActionState` de Server Actions por estado local `useState`, gerando o token de demonstração e abrindo o QR code visualmente ao clicar em "Criar link".
- **Editor de Materiais (`src/components/portal/material-editor.tsx`)**:
  - Manter a experiência de edição e troca de status (`Rascunho` / `Publicado`) no cliente.

---

## 4. Geração de Parâmetros Estáticos (`generateStaticParams`)

Adicionar `generateStaticParams()` em todas as rotas dinâmicas:

- `/portal/admin/organizacoes/[id]`
- `/portal/atividades/[id]`
- `/portal/atividades/[id]/compartilhar`
- `/portal/atividades/[id]/conflito`
- `/portal/atividades/[id]/editar`
- `/portal/atividades/[id]/resultados`
- `/portal/materiais/[id]/editar`
- `/portal/turmas/[id]`
- `/atividade/[token]`
- `/atividade/[token]/[state]`
- `/atividade/[token]/jogar`
- `/atividade/[token]/jogar/[state]`

---

## 5. Deploy no GitHub Pages

1. Criar workflow do GitHub Actions (`.github/workflows/deploy.yml`) para build e deploy contínuo via GitHub Pages.
2. Executar `npm run build` para validar a exportação estática na pasta `out/`.
3. Configurar e habilitar o GitHub Pages no repositório `niciniV/SMS_Portal` via GitHub CLI (`gh`).
4. Realizar o commit e push para disparar o deploy e publicar.
