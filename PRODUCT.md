# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Profissionais usam o portal autenticado para gerenciar links de acesso, organizações,
  equipe, auditoria e resultados agregados.
- Administradores usam o portal para o trabalho administrativo suportado pelo produto.
- Participantes acessam o jogo somente por um link personalizado e opaco; o host nao exige conta ou perfil do participante.
- O jogo GameMaker existente e o unico cliente e runtime da experiencia. O portal nao cria um catalogo de minijogos nem varias experiencias de jogo.

## Product Purpose

Missoes do Caramelito combina um portal profissional/admin com uma entrada publica link-only para uma experiencia GameMaker existente. O portal atende o trabalho de profissionais e administradores; participantes chegam ao jogo somente por links personalizados e opacos. O produto nao tem landing page institucional ou de marketing.

## Positioning

O diferencial central e manter uma fronteira clara entre operacao profissional e participacao: o portal e uma superficie autenticada de trabalho, enquanto o jogo e acessado por um link direto e controlado. O produto integra um unico jogo GameMaker existente, em vez de criar atividades, modulos ou minijogos no portal.

## Operating Context

- O portal profissional/admin e uma superficie autenticada para o trabalho operacional do produto.
- A entrada publica de participante comeca somente em um link personalizado e opaco gerado pelo sistema de links.
- O portal nao inicia, incorpora ou descobre partidas para participantes; uma pessoa com o link deve abrir a rota publica diretamente.
- A rota publica resolve o identificador opaco e prepara a entrada ou o handoff para o jogo GameMaker existente.
- O destino do cliente GameMaker e configurado por `GAME_CLIENT_URL`; o formato exato do handoff deve permanecer no contrato de integracao do jogo.

## Capabilities and Constraints

- A V1 deve manter o portal autenticado para o trabalho profissional/admin e resolver links personalizados para a entrada publica do jogo.
- O host nao tem landing page e nao deve oferecer uma homepage de marketing como entrada alternativa.
- O portal nao e uma superficie de gameplay: nao deve iniciar partidas, listar links publicos para descoberta por participantes ou servir como catalogo de minijogos.
- Existe um unico jogo GameMaker e uma unica experiencia de runtime. O portal nao cria uma composicao de varios jogos, modulos ou minijogos.
- Links externos devem ser tratados como identificadores opacos. Acesso publico por indice, busca ou navegacao interna nao faz parte do produto.
- A integracao com o jogo usa contratos versionados e deve permanecer independente do ciclo de release do projeto GameMaker.
- `GAME_CLIENT_URL` identifica o destino implantado do cliente GameMaker e deve ser configurado por ambiente.
- A autenticacao do portal e separada do acesso publico por link; participantes nao precisam de conta para abrir o jogo.
- A especificacao `portal-v1-specification.md` e uma proposta anterior em partes. O portal autenticado permanece relevante, mas requisitos de landing, catalogos de jogos, composicao de minijogos e lancamento de gameplay pelo portal nao sao fonte de verdade.

## Brand Commitments

- Nome do produto: Missoes do Caramelito.
- Vinculo institucional: Programa Saude na Escola e rede municipal de Nova Santa Rita.
- Idioma principal: portugues do Brasil.
- A comunicacao deve tratar o jogo como meio para conversa, aprendizagem e cuidado coletivo, sem prometer resultados clinicos ou individualizados.

## Evidence on Hand

- O projeto GameMaker existente e a referencia para a experiencia e o comportamento do jogo.
- `contracts/schemas/` contem contratos JSON versionados que devem ser alinhados com a integracao real antes da producao.
- O portal autenticado e os fluxos de administracao existentes no projeto sao referencia para o trabalho profissional/admin, mas nao autorizam acesso publico ao jogo.
- `portal-v1-specification.md` registra uma proposta anterior; sua nota inicial identifica quais partes foram superadas pela fronteira atual.
- Nao ha neste repositorio depoimentos, estudos de caso, metricas reais, validacao clinica ou comprovacao formal de conformidade. Trabalhos futuros nao devem fabrica-los.

## Product Principles

- Separar o portal profissional/admin da experiencia de participante.
- Fazer do link personalizado o unico ponto de entrada publico para o jogo.
- Nao permitir que o portal lance ou ajude a descobrir partidas de participantes.
- Manter o jogo GameMaker existente como unica fonte de verdade para conteudo, regras e comportamento do jogo.
- Nao criar uma segunda fonte de verdade para catalogos de minijogos ou composicoes de atividades.
- Manter a fronteira de autenticacao do portal distinta da entrada publica por link.

## Accessibility & Inclusion

As telas do portal e a entrada publica devem funcionar em seus contextos previstos e respeitar preferencias de movimento reduzido. As responsabilidades de acessibilidade entre o portal, o host de link e o cliente GameMaker, assim como qualquer nivel formal de conformidade, ainda precisam de aprovacao e verificacao antes da producao.
