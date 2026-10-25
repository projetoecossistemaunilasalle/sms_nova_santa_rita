# PSE Nova Santa Rita: Landing

Site institucional do Programa Saúde na Escola de Nova Santa Rita, publicado
no GitHub Pages e servindo de porta de entrada única para os três projetos
do ecossistema:

| Rota       | Conteúdo                                                        |
| ---------- | --------------------------------------------------------------- |
| `/`        | Landing page institucional (Astro + ilhas SolidJS)              |
| `/portal/` | Demonstração estática do portal do professor (SMS_Portal, Next) |
| `/jogo/`   | Jogo mantido em Phaser (Heroes_Trial/web-poc)                   |

URL pública: `https://projetoecossistemaunilasalle.github.io/sms_nova_santa_rita/`

## Scripts

- `npm run dev`: servidor de desenvolvimento do Astro
- `npm run build`: build estático em `dist/` (inclui os bundles em `public/`)
- `npm test`: testes (`node --test`)
- `npm run test:landing:browser`: após o build, verifica seis tamanhos de tela,
  navegação por teclado, menu, galeria, movimento reduzido e acessibilidade da
  landing. Usa Playwright de `Heroes_Trial/web-poc`, axe-core de `SMS_Portal`
  e Edge; grava capturas em `../.preview/landing/`.
- `npm run verify:dist`: valida o artefato montado (entradas, base path,
  resíduos de caminhos antigos)
- `npm run sync:bundles`: sincroniza `public/portal/` e `public/jogo/`
  a partir dos builds dos projetos irmãos

## Como a integração funciona

Cada projeto permanece **independente** (build, repositório e branch
próprios). Nenhum código-fonte é compartilhado; este repositório recebe
apenas o **output** de cada um:

1. **Landing**: build normal do Astro. O base path do GitHub Pages vem de
   `base` em `astro.config.mjs` (padrão `/sms_nova_santa_rita`,
   sobrescrevível por `PAGES_BASE_PATH`). Todos os caminhos absolutos do
   site passam por `withBase()` (`src/config/site.ts`).
2. **Portal**: no repositório `SMS_Portal`, branch `demo/meeting-prep`:
   ```bash
   DEMO_BASE_PATH=sms_nova_santa_rita/portal npm run build:demo
   ```
   O export estático sai em `SMS_Portal/out/`. Depois:
   ```bash
   node scripts/sync-bundles.mjs --portal
   ```
3. **Jogo**: no repositório `Heroes_Trial`:
   ```powershell
   git pull --ff-only
   cd web-poc
   npm ci
   ```
   Depois, aqui na landing (build com base relativa para hospedagem aninhada):
   ```bash
   npm run build:jogo
   node scripts/sync-bundles.mjs --jogo
   npm test
   npm run build
   npm run verify:dist
   npm run test:jogo:browser
   ```

Os bundles sincronizados ficam versionados em `public/portal/` e
`public/jogo/` porque os repositórios irmãos são **privados**, então o workflow
de deploy não consegue acessá-los para buildar em CI. Rebuildar o projeto
de origem + `sync:bundles` + commit mantém tudo atualizado.

O sync valida os hashes do build antes de substituir o bundle anterior.
`public/jogo/index.html` mantém a página institucional; `public/jogo/runtime/`
recebe o build intacto do Phaser. Um iframe em modo explícito
`catalog-local-v3` mantém as seis missões e o progresso local, sem assumir um
novo contrato de portal. O CSS/input do jogo fica isolado da rolagem da página.
A tela cheia dimensiona o iframe pela área disponível abaixo da barra,
incluindo telas verticais, mudanças de orientação e áreas seguras.

`test:jogo:browser` usa o Playwright instalado em `Heroes_Trial/web-poc` e
o Edge, testa o artefato montado no base path do Pages e registra capturas
locais em `../.preview/game-page/`. O GameMaker permanece no repositório de
origem como referência, mas seu runner antigo não é mais publicado no site.
O harness legado de testes e seu código também não são publicados; a validação
do bundle recusa builds que ainda os incluam.

## Deploy

`.github/workflows/deploy.yml` builda a landing, valida o artefato com
`scripts/verify-dist.mjs` e publica `dist/` via GitHub Actions
(`actions/deploy-pages`).

> **Requisito de configuração (uma vez):** em _Settings → Pages → Build and
> deployment_, a fonte precisa estar em **GitHub Actions** (em vez do build
> clássico por branch). Sem isso, o job de deploy falha.
