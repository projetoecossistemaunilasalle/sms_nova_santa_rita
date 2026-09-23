---
name: "Missões do Caramelito"
description: "Um caderno digital de missões para aprendizagem, saúde e cuidado coletivo."
colors:
  green: "#3d9b4e"
  green-action: "#2f8541"
  green-dark: "#26713a"
  green-light: "#e8f5e9"
  blue: "#2e6fb7"
  blue-dark: "#1d4f8a"
  blue-light: "#e7f0fa"
  yellow: "#f7c948"
  yellow-dark: "#7a5c05"
  yellow-light: "#fdf3d7"
  orange: "#f08c2e"
  orange-dark: "#aa560b"
  orange-light: "#fdeede"
  purple: "#8a63b8"
  purple-dark: "#6a4794"
  purple-light: "#f1eaf9"
  coral: "#e05b4b"
  coral-dark: "#b23a2c"
  coral-light: "#fbe9e6"
  aqua: "#2ba8a0"
  aqua-dark: "#16706b"
  aqua-light: "#e2f4f3"
  text: "#23402e"
  text-muted: "#4c6656"
  text-on-dark-muted: "#9bb3a1"
  background: "#fffdf6"
  surface: "#ffffff"
  border: "#dce8d8"
  sky: "#d9eff9"
  grass: "#eef7e4"
  yellow-shadow: "#9f7b10"
  surface-sky: "#eef8fc"
  surface-game: "#15271c"
typography:
  scale:
    compact: "0.6875rem"
    small: "0.75rem"
    navigation: "0.8125rem"
    body-small: "0.875rem"
    body: "1rem"
    subtitle: "1.125rem"
    title: "1.25rem"
    display-small: "1.5rem"
    feature: "2rem"
  display:
    fontFamily: '"Arial Rounded MT Bold", "Trebuchet MS", sans-serif'
    fontSize: "clamp(3.5rem, 7vw, 6rem)"
    fontWeight: 700
    lineHeight: 0.91
    letterSpacing: "-0.04em"
  headline:
    fontFamily: '"Arial Rounded MT Bold", "Trebuchet MS", sans-serif'
    fontSize: "clamp(2rem, 4vw, 3.35rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.04em"
  title:
    fontFamily: '"Arial Rounded MT Bold", "Trebuchet MS", sans-serif'
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "normal"
  body:
    fontFamily: 'Bahnschrift, Candara, "Trebuchet MS", sans-serif'
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  action:
    fontFamily: 'Bahnschrift, Candara, "Trebuchet MS", sans-serif'
    fontSize: "0.75rem"
    fontWeight: 850
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: 'Consolas, "Courier New", monospace'
    fontSize: "0.6875rem"
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: "0.13em"
  status:
    fontFamily: 'Bahnschrift, Candara, "Trebuchet MS", sans-serif'
    fontSize: "0.6875rem"
    fontWeight: 850
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  micro: "1px"
  compact: "10px"
  field: "11px"
  control: "12px"
  action: "13px"
  mark: "5px"
  large: "15px"
  panel: "18px"
  brand: "15px 15px 15px 5px"
  card: "21px 21px 21px 10px"
  feature: "26px 26px 26px 10px"
  arch: "50% 50% 0 0"
  pill: "999px"
  circle: "50%"
spacing:
  xs: "6px"
  sm: "8px"
  md: "10px"
  lg: "12px"
  xl: "16px"
  2xl: "20px"
  3xl: "24px"
  4xl: "32px"
  workspace: "52px"
  section: "90px"
components:
  button-primary:
    backgroundColor: "{colors.green-action}"
    textColor: "{colors.surface}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "10px 17px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.blue-dark}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "10px 17px"
    height: "44px"
  button-danger:
    backgroundColor: "{colors.coral-light}"
    textColor: "{colors.coral-dark}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "10px 17px"
    height: "44px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    padding: "9px 12px"
    height: "44px"
  status-positive:
    backgroundColor: "{colors.green-light}"
    textColor: "{colors.green-dark}"
    typography: "{typography.status}"
    rounded: "{rounded.pill}"
    padding: "5px 9px"
  navigation-active:
    backgroundColor: "{colors.yellow}"
    textColor: "{colors.text}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "9px 12px 9px 22px"
    height: "44px"
  card-standard:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.card}"
    padding: "22px"
---

# Design System: Missões do Caramelito

## Overview

**Creative North Star: "O Caderno de Missões"**

O sistema parece um caderno de campo contemporâneo usado para organizar uma missao de aprendizagem e seguir seu proximo passo. A linguagem e acolhedora, ludica, confiavel e municipal: titulos arredondados, pequenos marcadores de percurso, superficies de papel e cores que lembram anotacoes, sinais e materiais escolares.

O ludico aparece na geometria, na cor e nos detalhes de rota, nao em excesso de ornamentos. O portal profissional/admin permanece disciplinado e escaneavel, enquanto a entrada publica pode ampliar ilustracao, escala e movimento. O jogo GameMaker e uma superficie separada e responsavel por sua propria interface. O resultado deve ser amigavel para participantes e profissionais sem parecer corporativo frio nem infantilizado.

**Key Characteristics:**

- Papel creme como campo principal, com branco reservado a cartões e controles.
- Verde profundo como tinta estrutural e verde vivo para ação positiva.
- Títulos arredondados, densos e expressivos; texto de trabalho compacto e legível.
- Cantos assimétricos que lembram páginas marcadas e caminhos de missão.
- Ações táteis, superfícies leves e pequenos sinais gráficos de percurso.

## Colors

A paleta combina natureza, escola e sinalização: bases quentes e calmas recebem acentos saturados, sempre ligados a significado ou orientação.

### Primary

- **Verde Caminho:** identifica a marca e os sinais positivos da jornada.
- **Verde Caminho Ação:** variação de ação com contraste suficiente para texto claro em controles primários.
- **Verde Caminho Profundo:** sustenta contraste, navegação estrutural e sombras táteis.
- **Verde Caminho Suave:** comunica sucesso e disponibilidade sem competir com o conteúdo.

### Secondary

- **Azul Céu:** identifica informação, links, organização e ações secundárias.
- **Amarelo Marco:** marca seleção, progresso, navegação ativa e pontos importantes da jornada.
- **Laranja Percurso:** acrescenta energia e diferencia etapas, estados e alertas moderados.

### Tertiary

- **Aqua Cuidado:** diferencia conteúdos ligados a água, bem-estar e variações informativas.
- **Violeta Descoberta:** amplia a diferenciação entre contextos sem disputar a hierarquia primária.
- **Coral Atenção:** fica reservado a bloqueios, perigos e ações destrutivas.

### Neutral

- **Tinta Floresta:** texto principal, sidebar e âncoras de alto contraste.
- **Tinta Floresta Suave:** texto secundário, explicações e metadados.
- **Papel Creme:** fundo contínuo da aplicação e atmosfera de caderno.
- **Folha Branca:** controles, cartões e áreas que precisam de nitidez.
- **Linha de Caderno:** bordas discretas, divisores e estrutura de listas.
- **Céu Suave e Grama Suave:** grandes campos tonais, gráficos e destaques ambientais.

**The Cor com Função Rule.** Cada cor saturada deve orientar uma ação, estado, categoria ou ponto da jornada; nunca espalhar a paleta inteira apenas como decoração.

**The Papel Primeiro Rule.** Papel Creme é o campo padrão. Folha Branca cria recortes funcionais, não páginas inteiras sem contraste.

## Typography

**Display Font:** Arial Rounded MT Bold (com Trebuchet MS e sans-serif como fallback)  
**Body Font:** Bahnschrift (com Candara, Trebuchet MS e sans-serif como fallback)  
**Label/Mono Font:** Consolas (com Courier New e monospace como fallback)

**Character:** A fonte arredondada faz os títulos parecerem convites e marcos de uma missão. A fonte de corpo mantém a operação direta, enquanto o mono transforma sobrancelhas, datas e categorias em pequenas etiquetas de caderno.

### Hierarchy

- **Display:** peso forte, escala fluida ampla, linha compacta e tracking negativo; reservado a entradas e estados públicos de atividade.
- **Headline:** peso forte, escala fluida média e linha fechada; usado em títulos de página, detalhes e chamadas principais.
- **Title:** arredondado e compacto; usado em cartões, painéis e seções.
- **Body:** peso regular, linha confortável; descrições devem permanecer curtas e, quando longas, limitar-se aproximadamente a 65–75 caracteres por linha.
- **Action:** corpo pequeno e muito forte; botões e controles precisam parecer firmes mesmo em layouts densos.
- **Label:** mono, caixa alta e tracking aberto; usado para contexto, datas, grupos de navegação e marcadores, nunca para parágrafos.

**The Marco Tipográfico Rule.** Cada região começa com uma etiqueta pequena e um título arredondado dominante; não crie três níveis de títulos com o mesmo peso visual.

**The Mono com Propósito Rule.** Use a fonte utilitária apenas para metadados e sinalização curta. Texto narrativo ou instrucional permanece na fonte de corpo.

## Layout

Nao existe landing page ou homepage de marketing. O portal profissional/admin usa
sidebar fixa de 248px, topbar aderente de 76px e conteudo com padding fluido ate 52px.
As grades privilegiam a tarefa principal e mantem paineis de resumo mais estreitos;
listas operacionais podem usar uma linha por link de acesso sem se tornarem um catalogo de
jogos ou uma entrada para participantes.

A superficie publica comeca somente na rota alcancada pelo link personalizado e opaco.
Ela usa um contenedor central de ate 760px, margens laterais de 20px e uma composicao
que prioriza o titulo da atividade, o estado e o proximo passo para o jogo GameMaker.
Nao ha navegacao publica para descobrir atividades e o portal nao deve iniciar o jogo.

Em ate 1120px, grades do portal simplificam colunas secundarias. Em ate 900px, a
sidebar vira navegacao inferior com cinco destinos e o conteudo passa a uma coluna. Em
ate 760px, a entrada publica permanece em uma coluna; em ate 680px, cabecalhos
empilham e metadados secundarios podem ser ocultados. A ausencia de landing page nao
deve ser substituida por uma lista publica de atividades.

**The Tarefa Primeiro Rule.** Quando a largura diminui, preserve ação, título, estado e próximo passo; remova métricas e contexto secundário antes de reduzir a legibilidade.

## Elevation & Depth

O sistema é híbrido: ações são táteis e superfícies são leves. Botões principais, marca e item ativo recebem uma sombra curta e sólida que sugere pressão. Cartões comuns dependem de borda e cor tonal; sombras ambientais aparecem apenas em destaques, hover de cartões e experiências públicas.

### Shadow Vocabulary

- **Pressão verde** (`0 5px 0 var(--green-dark)`): botões principais e controles de maior compromisso.
- **Pressão amarela** (`0 4px 0 #9f7b10`): navegação ativa do portal e seleções locais que funcionam como marcos físicos.
- **Elevação discreta** (`0 10px 24px rgb(35 64 46 / 7%)`): resposta de hover em linhas e cartões operacionais.
- **Elevação de catálogo** (`0 14px 35px rgb(35 64 46 / 9%)`): nao usada para listas ou descoberta de atividades; fica reservada a destaques da entrada quando necessario.
- **Elevação de missão** (`0 28px 65px rgb(35 64 46 / 16%)`): arte ou cartao de entrada da atividade e estados publicos excepcionais.

**The Leve em Repouso Rule.** Cartões de trabalho permanecem planos por padrão. Sombras amplas indicam destaque, interação ou uma experiência pública, nunca apenas separação básica.

**The Pressão é Ação Rule.** Sombras sólidas e curtas pertencem a elementos clicáveis ou à marca; não as aplique em recipientes passivos.

## Shapes

O vocabulário mistura círculos, pílulas e retângulos de cantos generosos com uma assinatura assimétrica: um canto reduzido funciona como dobra, marcador ou ponto de partida de uma rota. Controles usam curvas moderadas; cartões e painéis recebem curvas maiores; avatares, estados e pontos de percurso usam círculos completos.

Ícones vivem em traço simples e consistente. Linhas pontilhadas, barras curtas e pontos coloridos podem sugerir caminho e progresso. Grandes formas de fundo devem ser cortadas pela borda da composição, com baixa opacidade.

**The Canto Marcado Rule.** Em cartões de identidade ou missão, reduza apenas um canto. Não combine múltiplos cortes, bolhas aleatórias ou raios diferentes sem uma leitura clara de percurso.

## Components

Os componentes sao tateis e amigaveis, mas disciplinados. A operacao profissional/admin
deve permanecer clara mesmo quando a marca aparece em detalhes expressivos; a entrada
publica usa a mesma linguagem sem se tornar um atalho para outras atividades.

### Buttons

- **Shape:** controle curvo e compacto, normalmente com 12–13px de raio.
- **Primary:** Verde Caminho Ação sobre branco, peso alto, altura mínima de 44px e sombra de pressão verde.
- **Hover / Focus:** sobe 2px em 150ms; foco por teclado usa um único contorno de 2px, afastado 2px, em Verde Caminho Profundo nas superfícies claras e Amarelo Marco na navegação escura.
- **Secondary:** folha branca, contorno Azul Céu e sombra azul muito leve.
- **Ghost:** folha branca com Linha de Caderno; sem sombra em repouso.
- **Danger:** Coral Atenção sobre fundo coral suave, com borda translúcida.

### Chips

- **Style:** pílula compacta com ponto circular antes do texto; fundo tonal e texto na versão profunda da mesma família.
- **State:** verde para ativo, laranja para pendencia, coral para indisponibilidade ou erro e neutro para contexto sem acao.

### Cards / Containers

- **Corner Style:** cantos grandes com um canto marcado, de 15px em listas a 26px em destaques.
- **Background:** Folha Branca para trabalho; tons suaves da paleta para resumo, categoria ou contexto.
- **Shadow Strategy:** borda e tom em repouso; elevação discreta apenas em hover; sombra ampla apenas para missões públicas e destaques.
- **Border:** Linha de Caderno ou uma versão translúcida da cor temática.
- **Internal Padding:** 14–18px em linhas e resumos, 22–26px em cartões, até 38px em destaques.

### Inputs / Fields

- **Style:** folha branca, borda Linha de Caderno, raio de 11–12px e altura mínima de 44px.
- **Focus:** o foco global precisa permanecer visível e não pode depender apenas de mudança de cor.
- **Error / Disabled:** erros usam Coral Atenção com fundo suave; estados bloqueados preservam contraste e explicam a causa.

### Navigation

No portal, a navegacao desktop usa Tinta Floresta como painel, links claros e uma
trilha vertical pontilhada. O destino ativo vira uma aba Amarelo Marco com sombra curta.
No mobile, a navegacao desce para uma barra fixa de cinco destinos. Essa navegacao e
exclusiva do trabalho profissional/admin e nao deve abrir o jogo para participantes.

Na superficie publica nao ha navegacao persistente. A atividade e alcancada pelo link
personalizado e opaco; controles locais devem limitar-se ao estado atual e ao handoff
para o cliente GameMaker. Nao criar links para homepage, catalogo publico ou outras
atividades.

### Mission Card

O cartao de entrada da atividade e a expressao mais ampla do sistema: composicao em
duas colunas, arte tonal, borda branca espessa, canto marcado e titulo de grande escala.
Em telas estreitas, arte e conteudo empilham sem perder o primeiro proximo passo para o
jogo GameMaker.

## Do's and Don'ts

### Do:

- **Do** usar Papel Creme como atmosfera contínua e Folha Branca para recortes funcionais.
- **Do** reservar Verde Caminho para ação positiva, disponibilidade e marca.
- **Do** combinar etiqueta mono curta com um título arredondado claramente dominante.
- **Do** usar um único canto marcado para dar assinatura a cartões e marcos de missão.
- **Do** manter transições operacionais entre 150–170ms e desativar movimento não essencial quando `prefers-reduced-motion` estiver ativo.
- **Do** preservar tarefa, estado e proximo passo antes de qualquer metadado secundario.
- **Do** manter a navegacao do portal separada da entrada publica por link.

### Don't:

- **Don't** transformar a paleta completa em decoração sem função semântica.
- **Don't** usar sombras amplas em todos os cartões ou recipientes passivos.
- **Don't** aplicar fonte mono em parágrafos, instruções longas ou conteúdo infantil.
- **Don't** usar cantos genéricos idênticos em toda parte nem misturar vários cortes no mesmo componente.
- **Don't** reduzir controles interativos abaixo de 42–44px nas experiências de trabalho e participação.
- **Don't** tornar a entrada fria ou infantilizada; o ludico deve vir de percurso, forma e cor controlada.
- **Don't** adicionar landing page ou homepage de marketing.
- **Don't** permitir que a navegacao do portal lance ou descubra gameplay para participantes.
