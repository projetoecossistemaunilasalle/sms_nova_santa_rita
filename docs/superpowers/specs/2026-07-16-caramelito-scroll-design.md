# Caramelinho: animação de scroll ancorada na interface

## Objetivo

Revisar exclusivamente a jornada animada do Caramelinho, preservando a landing page, os textos, as seções e a identidade visual existentes. O sprite clássico deve nascer no hero e participar do primeiro deslocamento. Toda troca de pose deve estar visualmente associada a um card ou bloco real da página.

## Diagnóstico atual

A página renderiza um Caramelinho estático em `HeroSection.astro` e um segundo Caramelinho fixo em `MascotGuide.tsx`. O guia só aparece depois que a seção “O projeto” entra na rota e seleciona imediatamente o sprite de movimento. Por isso, o clássico não participa da jornada.

A rota atual usa progresso global da página, posições horizontais em porcentagem e uma faixa vertical fixa. A visibilidade é definida pelo destino de cada trecho. Como consequência, o mascote começa a desaparecer durante todo o deslocamento até a seção-cortina, em vez de ser ocultado pela geometria do card. As seções inteiras com `z-index` superior escondem o guia, mesmo quando ele ainda não alcançou um card.

## Arquitetura aprovada

### Componente único

`MascotGuide` será o único Caramelinho visual. No HTML inicial ele ocupará o espaço atual do mascote no hero, preservando imagem, texto alternativo, balão e layout. Após a hidratação, quando movimento reduzido não estiver ativo, o mesmo componente passará para a camada fixa e iniciará a jornada a partir do retângulo exato ocupado no hero.

O componente será hidratado no carregamento, não em idle, para que a passagem do estado estático ao estado controlado por scroll esteja pronta antes da primeira rolagem. Sem JavaScript ou com `prefers-reduced-motion`, ele permanece estático no hero.

### Motor de cenas

A rota será uma sequência de cenas. Cada cena terá:

- intervalo de scroll derivado das posições reais das seções;
- ponto inicial e final em coordenadas de viewport;
- pontos de controle de uma curva Bézier cúbica;
- pose de entrada e de saída;
- elemento-cortina opcional;
- estratégia de oclusão simples ou dupla;
- configuração própria para desktop, tablet e mobile.

A matemática de interpolação, Bézier, seleção de cena, pose e oclusão ficará separada do componente em funções puras. O componente cuidará apenas de medir o documento, receber scroll, suavizar o progresso e aplicar transforms.

### Marcadores no documento

Os elementos usados pela rota receberão atributos `data-mascot-*`, evitando dependência de seletores posicionais frágeis. A sequência será ancorada nos seguintes elementos reais:

1. Posição inicial do mascote no hero.
2. Bloco verde “Uma experiência educativa digital está sendo preparada”, usado para a primeira troca de clássico para movimento.
3. Card da arte conceitual e bloco “O que está previsto”, usados para entrada, cena e saída da pose de papel.
4. Card verde da seção Identidade, usado para retornar ao sprite clássico.
5. Ponto final na seção Contato, onde o mascote permanece visível no fundo da página sem invadir o rodapé.

Os cards-cortina terão camada opaca acima do mascote. A seção inteira não será usada como máscara quando isso fizer o personagem desaparecer no espaço vazio.

## Sequência de movimento

1. O Caramelinho clássico começa no hero com respiração discreta.
2. Ao rolar, o clássico percorre uma curva longa durante “O projeto”, com deslocamento lateral e vertical suave.
3. Ele entra atrás do bloco verde da seção. A troca para movimento ocorre dentro da área de oclusão, e o novo sprite sai pela outra borda.
4. O sprite de movimento acompanha Missões e o início da Experiência por curvas lentas.
5. Ele entra atrás do card da arte conceitual e reaparece em pose de papel.
6. Papel A e B alternam somente durante a cena de observação. A alternância é derivada do progresso da cena, sem temporizador autônomo.
7. O mascote entra atrás do bloco “O que está previsto” e reaparece em movimento.
8. Ele atravessa Público, Segurança e Identidade sem cobrir textos ou controles.
9. Atrás do card verde de Identidade, retorna ao sprite clássico.
10. O clássico segue até a seção Contato e permanece visível no fundo da página.

Todas as cenas são reversíveis. Rolar para cima desfaz posição, direção, pose, oclusão e quadros de papel sem teletransporte.

## Oclusão e troca de sprites

### Oclusão simples

Em cards amplos, a troca ocorre quando o retângulo completo do mascote, incluindo margem de segurança para orelhas, cauda e mochila, estiver contido na área útil do card. O sprite seguinte começa a sair pela borda oposta antes de deixar a zona do card.

### Passagem dupla

Em mobile, quando o card não comportar o mascote inteiro, será usada uma passagem dupla controlada pelo scroll. O sprite antigo entra por uma borda enquanto o novo começa a sair pela borda oposta. Ambos podem aparecer parcialmente durante uma janela curta de progresso, mas as partes sobre o card permanecem realmente atrás dele.

A passagem dupla deve manter escala, orientação e continuidade de trajetória. Ela não usa animação temporizada nem fade no espaço vazio. Se não houver espaço para coexistência sem cobrir texto ou botão, a travessia será simplificada e deslocada para a margem.

## Movimento e desempenho

O listener de scroll será passivo e atualizará apenas um progresso-alvo. Um loop `requestAnimationFrame` aproximará o estado visual do alvo com amortecimento. Transformações usarão `translate3d`, rotação mínima e escala apenas quando necessária para espelhamento.

Cada travessia ocupará uma parte relevante ou a totalidade de uma seção. O bounce terá pequena amplitude, ritmo lento e intensidade proporcional ao deslocamento. Quando o scroll parar, o bounce será reduzido até cessar. Não serão animadas propriedades que provoquem layout contínuo.

As medições serão refeitas após carregamento, mudança de viewport, mudança de breakpoint e alterações observadas por `ResizeObserver`. Imagens que alterem o layout também provocarão reconstrução segura da rota.

## Responsividade

- Desktop usa travessias amplas e curvas em “S”, com mascote no tamanho atual aproximado.
- Tablet mantém a sequência, comprime os pontos de controle e usa tamanho intermediário.
- Mobile reduz tamanho e amplitude, privilegia margens e usa passagem dupla em cortinas estreitas.
- Pontos de entrada e saída são calculados por breakpoint e pelo retângulo real de cada cortina.
- Nenhuma posição pode cobrir títulos, parágrafos, links ou botões. Cenas secundárias podem ser simplificadas no mobile.

## Movimento reduzido e falhas seguras

Com `prefers-reduced-motion: reduce`, o Caramelinho permanece estático no hero. Não haverá grandes travessias, bounce, alternância contínua ou troca dupla.

Se um marcador obrigatório estiver ausente, tiver geometria inválida ou a página não tiver scroll suficiente, o componente mantém o estado estático do hero. A animação não deve tentar construir uma rota parcial que produza saltos.

## Verificação

Testes automatizados cobrirão:

- interpolação Bézier e limites de progresso;
- seleção reversível de cenas e poses;
- primeira travessia inteira usando o sprite clássico;
- alternância A/B somente dentro da cena de papel;
- oclusão simples quando o card comporta o sprite;
- passagem dupla quando o card é estreito;
- fallback estático para marcadores inválidos e movimento reduzido.

A verificação no navegador usará checkpoints de scroll em pelo menos 1440 × 900 e 390 × 844. Para cada cortina serão inspecionados entrada, janela de troca e saída, nos dois sentidos. Também serão verificados console, sobreposição com textos e botões, estado final no contato e comportamento com movimento reduzido.

Antes da conclusão serão executados testes automatizados, verificação de formatação, `astro check` e build de produção.

## Fora de escopo

Não serão alterados textos institucionais, conteúdo das seções, paleta, tipografia, navegação, links, assets fornecidos ou estrutura visual que não seja necessária para criar marcadores, camadas e espaço seguro para a animação.
