# Plano de demonstração visual do portal

> **Status: documento histórico.** Este plano descreve a geração anterior do portal
> (rotas de atividades/materiais, links de acesso e serviços como `portal-view-service.ts`)
> que foi removida do produto. Não é orientação de implementação atual; consulte
> `docs/current-architecture.md` e `docs/refactor-dossier/IMPLEMENTATION-READY.md`.

Este documento **não substitui** `PRODUCT.md` nem `docs/current-architecture.md`. O objetivo aqui era organizar uma camada de demonstração rápida, reaproveitável e coerente com o portal profissional da época, priorizando navegação, telas e percepção do produto antes da implementação completa de persistência e regras de produção.

## Objetivo

Preparar uma demonstração do portal que permita apresentar, em poucos minutos, o fluxo e a amplitude do produto para profissionais e gestores.

A demonstração deve deixar visualmente claro que o portal permite:

1. acompanhar uma visão geral da operação;
2. criar e administrar links de acesso ao jogo;
3. visualizar resultados agregados;
4. organizar escolas/unidades e turmas;
5. consultar e editar materiais pedagógicos e conteúdos de apoio;
6. administrar equipe e visualizar auditoria.

A prioridade é **visual e navegacional**. Para esta etapa, dados demonstrativos são aceitáveis desde que permaneçam claramente separados da implementação de produção.

## Princípios da demo

- Reutilizar o design system e os componentes já existentes no portal.
- Não criar uma segunda aplicação ou um protótipo descartável fora do Next.js atual.
- Usar dados demonstrativos tipados no modo de desenvolvimento, seguindo o padrão já existente em `portal-view-service.ts`.
- Não realizar migrações de banco apenas para sustentar a demo visual.
- Não apresentar ações incompletas como se estivessem persistindo em produção.
- Fazer as novas telas com estrutura reaproveitável para a implementação real posterior.
- Manter o jogo fora do portal; a demo continua tratando o GameMaker como runtime separado.
- Não cadastrar crianças nem criar histórico individual infantil.

## Navegação proposta

### Trabalho cotidiano

A navegação principal do portal deve ficar, para a demo, nesta ordem:

1. **Visão geral** — `/portal`
2. **Links de acesso** — `/portal/atividades`
3. **Resultados** — manter a rota atual de resultados durante a demo
4. **Turmas** — `/portal/turmas`
5. **Materiais** — `/portal/materiais`

### Administração

1. **Organizações** — `/portal/admin/organizacoes`
2. **Equipe** — `/portal/admin/equipe`
3. **Auditoria** — `/portal/admin/auditoria`

`Turmas` deve ficar fora do bloco de administração porque é uma entidade operacional usada com frequência por profissionais. `Materiais` também deve ficar na navegação principal porque a consulta e edição de conteúdos faz parte do uso recorrente do portal.

## 1. Materiais

A nova área deve funcionar visualmente como um mini CMS para materiais pedagógicos, comunicados, guias e conteúdos de apoio.

### Rotas da demo

- `/portal/materiais`
- `/portal/materiais/novo`
- `/portal/materiais/[id]/editar`

### Tela de listagem

Mostrar uma visão editorial com:

- título;
- tipo;
- tema;
- público;
- status (`Publicado`, `Rascunho`, `Arquivado`);
- data da última atualização;
- autor/editor;
- ação de editar;
- botão `Novo material`.

A listagem pode usar tabela no desktop e cards no mobile, seguindo o padrão visual já existente no portal.

### Dados demonstrativos sugeridos

Criar entre 5 e 7 materiais para tornar a tela convincente, por exemplo:

- `Guia de conversa: convivência no recreio` — Guia — Professores — Publicado;
- `Alimentação saudável em sala` — Material pedagógico — Professores — Publicado;
- `Vacinação: perguntas para conversar em família` — Artigo — Famílias — Publicado;
- `Semana de combate à dengue` — Comunicado — Todos — Rascunho;
- `Cultura de paz: roteiro para roda de conversa` — Atividade — Professores — Publicado;
- `Saúde emocional: sinais para acolher e conversar` — Guia — Professores — Rascunho.

### Editor visual

A tela de edição deve priorizar a sensação de um editor real, mesmo que a demo inicialmente não persista no banco.

Campos:

- título;
- resumo;
- tipo;
- tema;
- público;
- status;
- imagem/capa como área de upload visual;
- corpo do conteúdo;
- anexos como área visual para PDF/arquivo;
- botão `Salvar rascunho`;
- botão `Publicar`;
- ação `Visualizar`.

Para a primeira demo, o corpo pode ser um `textarea` estilizado ou um editor simples. Não adicionar uma dependência grande de rich text apenas para a demonstração.

### O que deve ser reaproveitável depois

- layout da listagem;
- formulário e componentes dos campos;
- badges de status;
- tipos TypeScript da view;
- estrutura das rotas;
- estados vazio, carregando e edição.

Persistência, uploads e publicação real ficam para a etapa posterior.

## 2. Turmas

A demo precisa tornar explícito que a plataforma conhece grupos/turmas sem precisar identificar crianças individualmente.

### Rotas da demo

- `/portal/turmas`
- `/portal/turmas/[id]`

### Tela de listagem

Mostrar:

- nome da turma;
- escola/organização;
- ano/série;
- turno;
- ano letivo;
- quantidade de links ativos;
- quantidade de sessões agregadas;
- status;
- botão `Nova turma`.

Filtros visuais:

- escola;
- ano letivo;
- turno;
- status.

### Dados demonstrativos sugeridos

- 3º A — EMEF Victor Aggens — manhã;
- 4º A — EMEF Victor Aggens — manhã;
- 5º B — EMEF Victor Aggens — tarde;
- 5º A — outra escola demonstrativa — manhã.

Não criar lista de alunos.

### Detalhe da turma

A tela `/portal/turmas/[id]` deve apresentar um cabeçalho com os dados da turma e três blocos principais:

1. **Resumo** — sessões, conclusão média e links ativos;
2. **Links de acesso** — links criados para a turma;
3. **Resultados recentes** — visualização agregada e resumida.

Pode haver ações visuais `Criar link para esta turma` e `Editar turma`.

### Relação futura esperada

A implementação real deverá evoluir para uma entidade de turma relacionada à organização/escola e opcionalmente aos links de acesso. Para a demo, essa relação deve existir apenas na camada de view/mock, sem exigir alteração imediata do Prisma.

## 3. Organizações

A tela atual de organizações já existe, mas ainda parece uma tabela administrativa isolada. Para a demo, ela deve comunicar melhor a estrutura da rede.

### Melhorias visuais

Na listagem existente:

- manter nome, tipo, estado e membros;
- adicionar quantidade de turmas;
- adicionar quantidade de links ativos;
- permitir clicar na organização.

### Nova rota de detalhe

- `/portal/admin/organizacoes/[id]`

O detalhe deve conter:

- nome e tipo da organização;
- status;
- profissionais vinculados;
- turmas;
- links ativos;
- resumo de participação;
- ações `Editar organização` e `Nova turma`.

Para a demo, organizações podem continuar vindo de fixtures.

## 4. Dashboard

A visão geral atual deve ser ajustada para conectar visualmente as novas áreas.

### Indicadores sugeridos

Manter o foco nos dados coletivos e substituir/expandir o resumo para mostrar:

- links ativos;
- turmas ativas;
- sessões no período;
- conclusão média;
- materiais publicados.

### Blocos adicionais

Adicionar, sem sobrecarregar:

- `Turmas recentes` ou `Turmas com atividade recente`;
- `Materiais recentes` com 2 ou 3 itens;
- atalhos para `Nova turma`, `Novo link` e `Novo material`.

O objetivo é fazer o dashboard parecer a porta de entrada de um sistema mais completo sem virar uma tela administrativa pesada.

## 5. Resultados

A tela atual de resultados deve permanecer agregada.

Para a demo visual, ela pode ganhar contexto de turma e organização nos cabeçalhos e filtros, mesmo antes de existir ingestão real completa.

Exemplo:

- Escola: EMEF Victor Aggens;
- Turma: 5º B;
- Link: Missão de agosto;
- Período: todo o período.

Os dados demonstrativos devem estar isolados no modo de demo/desenvolvimento e nunca aparecer como métricas reais em produção.

## Dados de demonstração

Preferir uma camada de view única e explícita.

Sugestão inicial:

- continuar usando `src/server/services/portal-view-service.ts` para os dados existentes;
- adicionar tipos e fixtures para `ClassGroupSummary` e `MaterialSummary`;
- se o arquivo crescer demais, separar em `src/server/demo/portal-fixtures.ts` sem alterar os contratos de produção.

Volume suficiente para a demo:

- 2 organizações/escolas;
- 4 a 6 turmas;
- 4 links de acesso;
- 5 a 7 materiais;
- 4 profissionais;
- 5 eventos de auditoria;
- resultados agregados de demonstração apenas no modo de desenvolvimento.

## Interações da demo

As interações precisam parecer completas, mas não devem exigir backend definitivo.

### Devem funcionar

- navegação entre todas as novas telas;
- filtros locais nas listas;
- abertura de detalhe de turma;
- abertura de detalhe de organização;
- abertura do editor de material;
- preenchimento de formulário;
- troca visual entre `Rascunho` e `Publicado` no editor durante a sessão;
- estados vazios e badges;
- layout responsivo.

### Podem ser demonstrativas nesta fase

- `Salvar` sem persistência após reload;
- upload de capa/anexo apenas como componente visual;
- criação de turma apenas com confirmação visual/local;
- edição de organização apenas como fluxo navegável.

Toda ação demonstrativa deve evitar mensagens que afirmem persistência definitiva quando ela não existir.

## Sequência de implementação recomendada

### Passo 1 — Navegação e dados de view

1. adicionar `Turmas` e `Materiais` à navegação;
2. criar os tipos e fixtures de demonstração;
3. adicionar ícones necessários ao componente compartilhado, se não existirem;
4. garantir que desktop e mobile continuem legíveis.

### Passo 2 — Materiais

1. criar listagem;
2. criar editor `novo/editar`;
3. criar cards/badges/estados;
4. adicionar atalho no dashboard.

Este é o bloco com maior ganho visual imediato porque mostra uma capacidade nova do portal.

### Passo 3 — Turmas

1. criar listagem e filtros;
2. criar detalhe da turma;
3. relacionar visualmente links e resultados às turmas;
4. adicionar indicador no dashboard.

### Passo 4 — Organizações

1. enriquecer a tabela existente;
2. criar detalhe da organização;
3. mostrar turmas e profissionais vinculados;
4. criar atalhos entre organização e turma.

### Passo 5 — Polimento da apresentação

1. revisar textos e consistência de nomenclatura;
2. revisar responsividade;
3. revisar estados vazios/loading/error;
4. garantir dados de demo coerentes entre dashboard, turma, organização, links e resultados;
5. executar `npm run check` e `npm run build`.

## Arquivos e áreas que provavelmente serão tocados

```text
src/components/portal/portal-navigation.tsx
src/components/portal/portal.module.css
src/components/shared/icon.tsx
src/server/services/portal-view-service.ts
src/app/(professional)/portal/page.tsx

src/app/(professional)/portal/materiais/page.tsx
src/app/(professional)/portal/materiais/novo/page.tsx
src/app/(professional)/portal/materiais/[id]/editar/page.tsx

src/app/(professional)/portal/turmas/page.tsx
src/app/(professional)/portal/turmas/[id]/page.tsx

src/app/(professional)/portal/admin/organizacoes/page.tsx
src/app/(professional)/portal/admin/organizacoes/[id]/page.tsx
```

A lista acima é uma previsão; componentes específicos podem ser extraídos conforme a implementação crescer.

## Fora do escopo desta demo

Não bloquear a apresentação tentando concluir agora:

- CMS persistido completo;
- armazenamento de arquivos;
- migrations para materiais;
- migrations para turmas;
- importação de alunos;
- contas infantis;
- histórico individual de crianças;
- hierarquia completa da rede;
- regras finais de autorização por turma;
- ingestão final dos resultados do GameMaker;
- landing page pública;
- mudança do framework da landing;
- refatoração grande das rotas atuais de links.

Esses itens podem ser implementados depois usando as telas e componentes da demo como base.

## Critério de pronto para apresentação

A demo está pronta quando uma pessoa consegue navegar, sem explicação técnica, por este roteiro:

1. entrar no portal;
2. ver o panorama geral;
3. abrir `Turmas` e escolher a `5º B`;
4. ver os links e resultados agregados daquela turma;
5. abrir `Materiais`;
6. editar um guia pedagógico e visualizar os controles de publicação;
7. abrir `Organizações` e entrar em uma escola;
8. visualizar turmas e equipe vinculadas;
9. voltar a um link de acesso e à tela de resultados.

A sensação esperada é de um produto integrado, mesmo que parte das ações ainda esteja sustentada por dados demonstrativos.

## Depois da demonstração

A ordem sugerida para transformar a demo em produto real é:

1. definir modelo real de `ClassGroup`/turma e relação com `Organization`;
2. persistir turmas e CRUD de organizações;
3. definir modelo de `Material` e `MaterialAttachment`;
4. persistir o CMS e uploads;
5. relacionar links a turmas de forma estruturada;
6. substituir métricas demonstrativas por ingestão e agregações reais;
7. fechar autorização e escopos para as novas entidades.
