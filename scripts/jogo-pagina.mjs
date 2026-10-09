// @ts-check

/**
 * Pagina institucional do jogo (/jogo/).
 *
 * O export HTML5 do Heroes_Trial sai do GameMaker como uma pagina crua
 * (apenas o canvas sobre um fundo branco). Este modulo transforma o
 * `index.html` do bundle durante `scripts/sync-bundles.mjs`, envolvendo o
 * canvas com o chrome institucional do PSE: cabecalho com volta ao site,
 * titulo, moldura do jogo, atalhos de controle e rodape.
 *
 * A transformacao e idempotente (marcador `data-jogo-pagina-pse`) e roda
 * sobre o export fresco a cada sincronizacao: basta recompilar o jogo e
 * rodar o sync para o visual novo valer para a versao nova do jogo.
 * O repositorio do jogo nunca e alterado.
 */

/**Marcador que identifica um index.html ja transformado. */
const MARCADOR = "data-jogo-pagina-pse";

/** Pontos de injecao do template HTML5 do GameMaker (estaveis entre exports). */
const MARCA_POSTSTYLE = "<!-- Custom PostStyle code is injected here -->";
const MARCA_POSTHEAD = "<!-- Custom PostHead code is injected here -->";
const MARCA_BODYSTART = "<!-- Custom BodyStart code is injected here -->";
const MARCA_BODYEND = "<!-- Custom BodyEnd code is injected here -->";

/* ------------------------------------------------------------------ */
/* CSS: tokens espelhados de src/styles/global.css (pagina autonoma)   */
/* ------------------------------------------------------------------ */

const ESTILOS = /* css */ `
:root {
  --jp-verde: #3d9b4e;
  --jp-verde-escuro: #26713a;
  --jp-verde-claro: #e8f5e9;
  --jp-azul: #2e6fb7;
  --jp-azul-escuro: #1d4f8a;
  --jp-azul-claro: #e7f0fa;
  --jp-laranja: #f08c2e;
  --jp-laranja-escuro: #c96a10;
  --jp-laranja-claro: #fdeede;
  --jp-amarelo: #f7c948;
  --jp-tinta: #23402e;
  --jp-tinta-suave: #3d5747;
  --jp-papel: #fffdf6;
  --jp-nuvem: #ffffff;
  --jp-linha: #dce8d8;
  --jp-navy: #1d3d5f;
  --jp-navy-escuro: #16324f;
  --jp-jogo-largura: {JP_LARGURA};
  --jp-jogo-altura: {JP_ALTURA};
  --jp-fonte: "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif;
}

html {
  -webkit-text-size-adjust: 100%;
}

*, *::before, *::after {
  box-sizing: border-box;
}

[hidden] {
  display: none !important;
}

body {
  margin: 0;
  background: linear-gradient(180deg, #a9d9f4 0%, #d9eff9 30%, #e7f5fc 58%, var(--jp-papel) 100%);
  color: var(--jp-tinta);
  font-family: var(--jp-fonte);
  line-height: 1.6;
  min-height: 100vh;
}

a:focus-visible,
button:focus-visible {
  outline: 3px solid var(--jp-azul);
  outline-offset: 3px;
  border-radius: 6px;
}

/* --- Link pular direto para o jogo --- */
.jp-pular {
  position: absolute;
  left: 1rem;
  top: -4rem;
  z-index: 100;
  background: var(--jp-tinta);
  color: #fff;
  padding: 0.6rem 1.1rem;
  border-radius: 999px;
  font-weight: 700;
  text-decoration: none;
  transition: top 0.2s ease;
}

.jp-pular:focus-visible {
  top: 0.8rem;
}

/* --- Cabecalho --- */
.jp-topo {
  position: relative;
  z-index: 60;
  background: var(--jp-papel);
  border-bottom: 1.5px solid var(--jp-linha);
}

.jp-topo-inner {
  width: min(100% - 2.5rem, 76rem);
  margin-inline: auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-block: 0.65rem;
}

.jp-marca {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  color: var(--jp-tinta);
  text-decoration: none;
  font-weight: 800;
  font-size: 1rem;
  line-height: 1.25;
}

.jp-marca svg {
  flex: none;
  color: var(--jp-verde);
}

.jp-marca strong {
  font-weight: 800;
}

.jp-marca small {
  display: block;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--jp-tinta-suave);
}

.jp-voltar {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.42rem 1rem;
  border-radius: 999px;
  border: 2px solid var(--jp-azul);
  color: var(--jp-azul-escuro);
  background: var(--jp-nuvem);
  font-weight: 800;
  font-size: 0.9rem;
  text-decoration: none;
  transition:
    background 0.18s ease,
    transform 0.18s ease;
}

.jp-voltar:hover {
  background: var(--jp-azul-claro);
  transform: translateY(-1px);
}

/* --- Hero compacto --- */
.jp-conteudo {
  width: min(100% - 2.5rem, 76rem);
  margin-inline: auto;
}

.jp-hero {
  position: relative;
  text-align: center;
  padding-block: clamp(1.8rem, 4vw, 3rem) clamp(1.2rem, 2.5vw, 2rem);
}

.jp-nuvem {
  position: absolute;
  pointer-events: none;
}

.jp-nuvem-1 {
  top: 0.3rem;
  left: 4%;
  width: clamp(70px, 9vw, 130px);
  animation: jp-flutua 52s ease-in-out infinite alternate;
}

.jp-nuvem-2 {
  top: 2.4rem;
  right: 5%;
  width: clamp(60px, 7vw, 100px);
  opacity: 0.9;
  animation: jp-flutua 64s ease-in-out infinite alternate-reverse;
}

@keyframes jp-flutua {
  to {
    translate: 20px 0;
  }
}

.jp-kicker {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--jp-laranja-escuro);
  background: var(--jp-laranja-claro);
  border: 1px solid rgb(240 140 46 / 0.4);
  padding: 0.35rem 0.9rem;
  border-radius: 999px;
}

.jp-titulo {
  margin: 0.9rem 0 0;
  font-size: clamp(1.75rem, 4vw, 2.5rem);
  font-weight: 800;
  line-height: 1.12;
  letter-spacing: -0.01em;
  text-wrap: balance;
}

.jp-hero p {
  margin: 0.7rem auto 0;
  max-width: 44rem;
  color: var(--jp-tinta-suave);
  font-size: clamp(1rem, 1.5vw, 1.12rem);
}

/* --- Palco do jogo --- */
.jp-palco {
  position: relative;
  margin-inline: auto;
  scroll-margin-top: 6rem;
  min-width: 0;
}

.jp-moldura {
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--jp-navy);
  border-radius: 24px;
  padding: 10px;
  box-shadow: 0 18px 44px rgb(23 52 82 / 0.38);
}

.jp-barra {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.5rem 0.35rem 0.6rem 0.55rem;
}

.jp-barra-titulo {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--jp-amarelo);
  font-weight: 800;
  font-size: 0.95rem;
  min-width: 0;
}

.jp-tela-cheia {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  background: transparent;
  border: 1.5px solid rgb(247 201 72 / 0.55);
  color: var(--jp-amarelo);
  font: inherit;
  font-weight: 700;
  font-size: 0.85rem;
  padding: 0.32rem 0.85rem;
  border-radius: 999px;
  cursor: pointer;
  flex: none;
  min-width: 44px;
  min-height: 44px;
  transition: background 0.18s ease;
}

.jp-tela-cheia:hover {
  background: rgb(247 201 72 / 0.14);
}

.jp-area {
  height: clamp(22rem, 70vh, 45rem);
  height: clamp(22rem, 70dvh, 45rem);
  min-width: 0;
  overflow: hidden;
  border-radius: 15px;
  background: var(--jp-navy-escuro);
}

.jp-area iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
}

.jp-estado {
  color: var(--jp-laranja-escuro);
  text-align: center;
}

.jp-moldura canvas {
  display: block;
  width: 100% !important;
  height: auto !important;
  max-width: 100%;
  border-radius: 15px;
}

.jp-aviso {
  background: var(--jp-laranja-claro);
  border: 1.5px solid rgb(240 140 46 / 0.4);
  color: var(--jp-laranja-escuro);
  border-radius: 14px;
  padding: 0.8rem 1.1rem;
  font-weight: 700;
  text-align: center;
  margin: 0 0 0.8rem;
}

/* O runtime do GameMaker insere um canvas irmao (#loading_screen) com
   position:absolute e left/top em coordenadas de viewport. Dentro de um
   ancestral posicionado esse offset conta duas vezes e a tela de
   carregamento sai la pelo canto inferior direito. Os dois canvases passam a
   ocupar a mesma celula de grid, entao o retangulo de carregamento coincide
   exatamente com o do jogo em qualquer modo. */
#gm4html5_div_id {
  display: grid;
  grid-template: 1fr / 1fr;
}

#gm4html5_div_id > canvas {
  grid-area: 1 / 1;
}

#loading_screen {
  position: static !important;
  left: auto !important;
  top: auto !important;
}

/* Tela cheia: o palco ocupa a janela inteira e o jogo e ampliado ate la,
   mantendo a proporcao nativa e ficando centralizado na area abaixo da barra.
   O retangulo do elemento canvas tem que coincidir com o do bitmap, porque o
   runtime converte coordenadas de mouse por clientWidth / canvas.width; dai a
   largura explicita em vez de object-fit (que carteia o bitmap dentro de um
   elemento maior e desloca o clique). max-width/max-height so encolhem, nao
   ampliam, entao a conta de "conter" usa as unidades de container da area. */
.jp-palco:is(:fullscreen, .jp-em-tela-cheia) {
  background: var(--jp-navy-escuro);
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.jp-palco:is(:fullscreen, .jp-em-tela-cheia) .jp-moldura {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  border-radius: 0;
  box-shadow: none;
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  background: var(--jp-navy-escuro);
}

.jp-palco:is(:fullscreen, .jp-em-tela-cheia) .jp-barra {
  flex: none;
  padding: 0.5rem 0.9rem;
}

.jp-palco:is(:fullscreen, .jp-em-tela-cheia) .jp-area {
  flex: 1 1 0;
  min-height: 0;
  height: auto;
  border-radius: 0;
}

/* container-type: size so vale em tela cheia, onde a altura do palco ja vem
   do flex pai; fora daqui a altura viria dos proprios canvases. */
.jp-palco:is(:fullscreen, .jp-em-tela-cheia) #gm4html5_div_id {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  place-items: center;
  container-type: size;
}

.jp-palco:is(:fullscreen, .jp-em-tela-cheia) #gm4html5_div_id > canvas {
  width: min(
      100cqw,
      calc(100cqh * var(--jp-jogo-largura) / var(--jp-jogo-altura))
    )
    !important;
  height: auto !important;
  max-width: none;
  max-height: none;
  border-radius: 0;
}

/* --- Como jogar --- */
.jp-como {
  margin-top: clamp(1.2rem, 2.5vw, 1.8rem);
  text-align: center;
}

.jp-como h2 {
  margin: 0 0 0.7rem;
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--jp-verde-escuro);
}

.jp-controles {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.6rem;
}

.jp-controles li {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--jp-nuvem);
  border: 1.5px solid var(--jp-linha);
  border-radius: 999px;
  padding: 0.42rem 0.95rem;
  font-size: 0.88rem;
  color: var(--jp-tinta);
  box-shadow: 0 3px 12px rgb(35 64 46 / 0.07);
}

.jp-controles b {
  font-weight: 800;
}

.jp-controles kbd {
  display: inline-block;
  min-width: 1.55em;
  text-align: center;
  background: var(--jp-nuvem);
  border: 1.5px solid #c9d6e4;
  border-bottom-width: 3px;
  border-radius: 7px;
  padding: 0.02em 0.4em;
  font-family: inherit;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--jp-azul-escuro);
}

.jp-controles .jp-ou {
  color: var(--jp-tinta-suave);
  font-size: 0.8rem;
}

/* --- Rodape --- */
.jp-pe {
  border-top: 1.5px solid var(--jp-linha);
  margin-top: clamp(1.8rem, 4vw, 2.8rem);
  padding: 1.1rem 0 1.4rem;
  text-align: center;
  font-size: 0.88rem;
  color: var(--jp-tinta-suave);
}

.jp-pe p {
  margin: 0 0 0.25rem;
}

.jp-pe a {
  color: var(--jp-verde-escuro);
  font-weight: 700;
  text-decoration: none;
}

.jp-pe a:hover {
  text-decoration: underline;
}

/* --- Responsivo --- */
@media (max-width: 40rem) {
  .jp-marca small {
    display: none;
  }

  .jp-moldura {
    border-radius: 18px;
    padding: 8px;
  }

  .jp-barra-titulo {
    font-size: 0.85rem;
  }

  .jp-barra-btn-texto {
    display: none;
  }

  .jp-controles {
    gap: 0.45rem;
  }

  .jp-controles li {
    padding: 0.4rem 0.7rem;
    font-size: 0.82rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .jp-nuvem {
    animation: none;
  }

  .jp-voltar,
  .jp-tela-cheia,
  .jp-pular {
    transition: none;
  }
}
`;

/* ------------------------------------------------------------------ */
/* HTML: pedacos injetados ao redor do canvas do GameMaker             */
/* ------------------------------------------------------------------ */

const SVG_PATINHA =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="{TAM}" height="{TAM}" fill="currentColor" aria-hidden="true"><ellipse cx="12" cy="15.2" rx="5.4" ry="4.4"/><circle cx="5.4" cy="9.6" r="1.9"/><circle cx="9.3" cy="6.7" r="1.9"/><circle cx="14.7" cy="6.7" r="1.9"/><circle cx="18.6" cy="9.6" r="1.9"/></svg>';

const SVG_NUVEM =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 92" aria-hidden="true"><g fill="#ffffff"><circle cx="60" cy="55" r="30"/><circle cx="108" cy="40" r="38"/><circle cx="152" cy="56" r="28"/><rect x="30" y="52" width="152" height="34" rx="17"/></g></svg>';

const SVG_SETA_ESQUERDA =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12H4m6-6-6 6 6 6"/></svg>';

const SVG_TELA_CHEIA =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"/></svg>';

const ABRE_CORPO = `
<a class="jp-pular" href="#jp-palco">Pular para o jogo</a>

<header class="jp-topo">
  <div class="jp-topo-inner">
    <a class="jp-marca" href="../" aria-label="PSE Nova Santa Rita, voltar ao início do site">
      ${SVG_PATINHA.replaceAll("{TAM}", "26")}
      <span>PSE <strong>Nova Santa Rita</strong><small>Programa Saúde na Escola</small></span>
    </a>
    <a class="jp-voltar" href="../">${SVG_SETA_ESQUERDA} Voltar ao site</a>
  </div>
</header>

<main class="jp-conteudo">
  <div class="jp-hero">
    ${SVG_NUVEM.replace("<svg ", '<svg class="jp-nuvem jp-nuvem-1" ')}
    ${SVG_NUVEM.replace("<svg ", '<svg class="jp-nuvem jp-nuvem-2" ')}
    <span class="jp-kicker">${SVG_PATINHA.replaceAll("{TAM}", "15")} O jogo</span>
    <h1 class="jp-titulo">Missões do Caramelito</h1>
    <p>Explore a Escola Amizade com o Caramelito, ajude os colegas nas seis missões e divirta-se, direto no navegador, sem instalar nada.</p>
  </div>

  <div class="jp-palco" id="jp-palco">
    <div class="jp-moldura">
      <div class="jp-barra">
        <span class="jp-barra-titulo">${SVG_PATINHA.replaceAll("{TAM}", "14")} Missões do Caramelito</span>
        <button class="jp-tela-cheia" type="button" aria-label="Tela cheia" aria-pressed="false">${SVG_TELA_CHEIA}<span class="jp-barra-btn-texto">Tela cheia</span></button>
      </div>
      <noscript>
        <p class="jp-aviso">Para jogar, ative o JavaScript no navegador.</p>
      </noscript>
`;

const FECHA_CORPO = `
    </div>
  </div>

  <section class="jp-como" aria-labelledby="jp-como-titulo">
    <h2 id="jp-como-titulo">Como jogar</h2>
    <ul class="jp-controles">
      <li><b>Andar</b> <kbd>Setas</kbd><span class="jp-ou">ou</span><kbd>WASD</kbd></li>
      <li><b>Conversar</b> <kbd>E</kbd><span class="jp-ou">ou</span><kbd>Enter</kbd></li>
      <li><b>Minigames</b> mouse ou toque</li>
      <li><b>Pausar</b> <kbd>Esc</kbd></li>
    </ul>
  </section>
</main>

<footer class="jp-pe">
  <p><strong>PSE Nova Santa Rita</strong> · Programa Saúde na Escola</p>
  <p><a href="../">Conheça o projeto no site</a></p>
</footer>

<p class="jp-estado" role="status" hidden></p>

<script>
  (function () {
    var botao = document.querySelector(".jp-tela-cheia");
    var palco = document.querySelector(".jp-palco");
    var frame = document.querySelector(".jp-area iframe");
    var estado = document.querySelector(".jp-estado");
    if (!botao || !palco) return;
    var pedidoTelaCheia =
      palco.requestFullscreen || palco.webkitRequestFullscreen || null;
    if (!pedidoTelaCheia) {
      botao.hidden = true;
      return;
    }
    function atualizarTelaCheia() {
      var ativo = (document.fullscreenElement || document.webkitFullscreenElement) === palco;
      palco.classList.toggle("jp-em-tela-cheia", ativo);
      botao.setAttribute("aria-pressed", String(ativo));
      botao.setAttribute("aria-label", ativo ? "Sair da tela cheia" : "Tela cheia");
      botao.querySelector(".jp-barra-btn-texto").textContent = ativo ? "Sair da tela cheia" : "Tela cheia";
      if (frame) frame.focus({ preventScroll: true });
    }
    async function alternarTelaCheia() {
      try {
        if (estado) estado.hidden = true;
        if (document.fullscreenElement || document.webkitFullscreenElement) {
          await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        } else {
          await pedidoTelaCheia.call(palco);
        }
      } catch (erro) {
        if (estado) {
          estado.textContent = "O navegador não permitiu a tela cheia. Você pode continuar jogando nesta página.";
          estado.hidden = false;
        }
      }
    }
    document.addEventListener("fullscreenchange", atualizarTelaCheia);
    document.addEventListener("webkitfullscreenchange", atualizarTelaCheia);
    botao.addEventListener("click", alternarTelaCheia);
  })();
</script>
`;

/** Isolate the game's viewport/input styles from the scrollable institutional page. */
export function criarPaginaJogoPhaser() {
  const estilos = ESTILOS.replaceAll("{JP_LARGURA}", "1280").replaceAll("{JP_ALTURA}", "720");
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="description" content="Explore a escola com o Caramelito e ajude os colegas nas seis missões do PSE Nova Santa Rita.">
  <title>Missões do Caramelito | Jogo do PSE Nova Santa Rita</title>
  <style ${MARCADOR}>${estilos}</style>
</head>
<body>
${ABRE_CORPO}
      <div class="jp-area">
        <iframe src="./runtime/index.html?integration=catalog-local-v3" title="Jogo Missões do Caramelito" allow="autoplay; fullscreen" allowfullscreen></iframe>
      </div>
${FECHA_CORPO}
</body>
</html>
`;
}

/**
 * Aplica o chrome institucional ao index.html do export do jogo.
 * @param {string} html conteudo original do index.html do export
 * @returns {{ html: string, aplicado: boolean, motivo?: string }}
 */
export function aplicarPaginaJogo(html) {
  if (html.includes(MARCADOR)) {
    return { html, aplicado: false, motivo: "chrome já presente" };
  }

  let resultado = html;
  let salvo = true;

  // A proporcao nativa do jogo vem dos proprios atributos do canvas do export,
  // assim a conta de tela cheia continua certa se o tamanho da janela mudar.
  const canvas = /<canvas[^>]*\bid="canvas"[^>]*>/.exec(resultado);
  const largura = canvas && /width="(\d+)"/.exec(canvas[0])?.[1];
  const altura = canvas && /height="(\d+)"/.exec(canvas[0])?.[1];
  const estilos = ESTILOS.replaceAll("{JP_LARGURA}", largura || "1280").replaceAll(
    "{JP_ALTURA}",
    altura || "720",
  );

  resultado = resultado.replace(/<html lang="en">/, '<html lang="pt-BR">');
  resultado = resultado.replace(
    /(<script[^>]*\bsrc=")(html5game\/[^"?]+\.js(?:\?[^"]*)?)(")/,
    (_, inicio, src, fim) => `${inicio}${src}${src.includes("?") ? "&amp;" : "?"}pse-input=1${fim}`,
  );
  resultado = resultado.replace(
    /<title>[\s\S]*?<\/title>/,
    "<title>Missões do Caramelito | Jogo do PSE Nova Santa Rita</title>",
  );

  if (resultado.includes(MARCA_POSTHEAD)) {
    resultado = resultado.replace(
      MARCA_POSTHEAD,
      `${MARCA_POSTHEAD}
    <meta name="description" content="Jogue Missões do Caramelito, o jogo do PSE Nova Santa Rita: explore a escola, ajude os colegas e complete as seis missões direto no navegador."/>`,
    );
  }

  if (resultado.includes(MARCA_POSTSTYLE)) {
    resultado = resultado.replace(
      MARCA_POSTSTYLE,
      `${MARCA_POSTSTYLE}

        <style ${MARCADOR}>
${estilos}
        </style>`,
    );
  } else {
    salvo = false;
  }

  if (resultado.includes(MARCA_BODYSTART)) {
    resultado = resultado.replace(
      MARCA_BODYSTART,
      `${MARCA_BODYSTART}
${ABRE_CORPO}`,
    );
  } else {
    salvo = false;
  }

  if (resultado.includes(MARCA_BODYEND)) {
    resultado = resultado.replace(
      MARCA_BODYEND,
      `${MARCA_BODYEND}
${FECHA_CORPO}`,
    );
  } else {
    salvo = false;
  }

  if (!salvo) {
    return {
      html,
      aplicado: false,
      motivo:
        "pontos de injecao do template HTML5 nao encontrados; index.html copiado sem alteracoes",
    };
  }

  return { html: resultado, aplicado: true };
}
