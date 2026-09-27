# PSE Nova Santa Rita — Landing

Site institucional do Programa Saúde na Escola de Nova Santa Rita, publicado
no GitHub Pages e servindo de porta de entrada única para os três projetos
do ecossistema:

| Rota       | Conteúdo                                                        |
| ---------- | --------------------------------------------------------------- |
| `/`        | Landing page institucional (Astro + ilhas SolidJS)              |
| `/portal/` | Demonstração estática do portal do professor (SMS_Portal, Next) |
| `/jogo/`   | Versão web do jogo (Heroes_Trial, GameMaker)                    |

URL pública: `https://projetoecossistemaunilasalle.github.io/sms_nova_santa_rita/`

## Scripts

- `npm run dev` — servidor de desenvolvimento do Astro
- `npm run build` — build estático em `dist/` (inclui os bundles em `public/`)
- `npm test` — testes (`node --test`)
- `npm run verify:dist` — valida o artefato montado (entradas, base path,
  resíduos de caminhos antigos)
- `npm run sync:bundles` — sincroniza `public/portal/` e `public/jogo/`
  a partir dos builds dos projetos irmãos

## Como a integração funciona

Cada projeto permanece **independente** (build, repositório e branch
próprios). Nenhum código-fonte é compartilhado — este repositório recebe
apenas o **output** de cada um:

1. **Landing** — build normal do Astro. O base path do GitHub Pages vem de
   `base` em `astro.config.mjs` (padrão `/sms_nova_santa_rita`,
   sobrescrevível por `PAGES_BASE_PATH`). Todos os caminhos absolutos do
   site passam por `withBase()` (`src/config/site.ts`).
2. **Portal** — no repositório `SMS_Portal`, branch `demo/meeting-prep`:
   ```bash
   DEMO_BASE_PATH=sms_nova_santa_rita/portal npm run build:demo
   ```
   O export estático sai em `SMS_Portal/out/`. Depois:
   ```bash
   node scripts/sync-bundles.mjs --portal
   ```
3. **Jogo** — no repositório `Heroes_Trial`:
   ```powershell
   tools/export_web.ps1       # exporta HTML5/GX.games para output/web/
   ```
   Depois, aqui na landing:
   ```bash
   node scripts/sync-bundles.mjs --jogo
   ```

Os bundles sincronizados ficam versionados em `public/portal/` e
`public/jogo/` porque os repositórios irmãos são **privados** — o workflow
de deploy não consegue acessá-los para buildar em CI. Rebuildar o projeto
de origem + `sync:bundles` + commit mantém tudo atualizado.

Enquanto o export web do jogo não for publicado, `public/jogo/` contém uma
página provisória ("em preparação") que é substituída pelo export real.

## Deploy

`.github/workflows/deploy.yml` builda a landing, valida o artefato com
`scripts/verify-dist.mjs` e publica `dist/` via GitHub Actions
(`actions/deploy-pages`).

> **Requisito de configuração (uma vez):** em *Settings → Pages → Build and
> deployment*, a fonte precisa estar em **GitHub Actions** (em vez do build
> clássico por branch). Sem isso, o job de deploy falha.
