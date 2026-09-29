/**
 * Configuracao central do site PSE Nova Santa Rita.
 *
 * TODOS os caminhos de assets e textos institucionais ficam aqui.
 * Para substituir textos, links, logotipos ou imagens, edite este arquivo;
 * nao e necessario procurar strings espalhadas pelos componentes.
 *
 * Itens marcados com [PLACEHOLDER] ainda nao possuem informacao oficial
 * confirmada e devem ser preenchidos antes da publicacao final.
 */

/* ------------------------------------------------------------------ */
/* Base path do GitHub Pages                                           */
/* ------------------------------------------------------------------ */

/**
 * Caminho base do site de projeto no GitHub Pages (ex.:
 * "/sms_nova_santa_rita"). O Astro define BASE_URL a partir de
 * `base` em astro.config.mjs; todo caminho absoluto do site precisa
 * passar por withBase() para funcionar sob o prefixo do Pages.
 */
export const BASE_PATH = (import.meta.env.BASE_URL ?? "").replace(/\/+$/, "");

/** Prefixa um caminho absoluto com o base path do GitHub Pages. */
export function withBase(path: string): string {
  return `${BASE_PATH}${path}`;
}

/* ------------------------------------------------------------------ */
/* Apps integrados (gerados a partir dos projetos irmaos)               */
/* ------------------------------------------------------------------ */

/**
 * Entradas dos apps publicados junto com a landing page pelo mesmo
 * deploy do GitHub Pages. As pastas sao montadas por
 * scripts/sync-bundles.mjs a partir dos builds de cada projeto:
 *   - /portal/: export estatico do SMS_Portal (npm run build:demo,
 *     DEMO_BASE_PATH=sms_nova_santa_rita/portal);
 *   - /jogo/: export web do Heroes_Trial (tools/export_web.ps1).
 */
export const APPS = {
  // "index.html" explicito: o servidor de dev do Astro nao resolve a barra
  // final de pastas em public/ (so o Pages resolve). Assim o link funciona
  // tanto no dev quanto no deploy.
  jogo: "/jogo/index.html",
  portal: "/portal/",
} as const;

/* ------------------------------------------------------------------ */
/* Assets                                                              */
/* ------------------------------------------------------------------ */

export const ASSETS = {
  mascot: {
    /** Pose principal de apresentacao (acenando). */
    classico: withBase("/assets/mascot/caramelito-classico.webp"),
    /** Pose de deslocamento/caminhada. */
    movimento: withBase("/assets/mascot/caramelito-movimento.webp"),
    /** Quadro A da cena "observando uma folha". */
    papelA: withBase("/assets/mascot/caramelito-papel-a.webp"),
    /** Quadro B da cena "observando uma folha" (rabo abanando). */
    papelB: withBase("/assets/mascot/caramelito-papel-b.webp"),
    /** Largura/altura naturais dos sprites (quadrados, com margem interna). */
    width: 640,
    height: 640,
  },
  /**
   * Capturas reais do jogo (Heroes_Trial), tiradas do proprio jogo rodando
   * no navegador. As dimensoes correspondem ao recorte do canvas.
   */
  jogo: {
    /** Mundo: explorando o patio da escola com o Caramelito. */
    patio: withBase("/assets/jogo/explorando-patio.webp"),
    /** Tela de escolha da missao "Futebol no patio". */
    escolha: withBase("/assets/jogo/escolha-acolher.webp"),
    /** Cutscene ilustrada da missao "Futebol no patio". */
    cutscene: withBase("/assets/jogo/historia-patio.webp"),
    /** Minigame de defesas (vertical). */
    minigame: withBase("/assets/jogo/minigame-defesas.webp"),
  },
  /**
   * [PLACEHOLDER] Logotipo oficial do PSE e brasao da Prefeitura.
   * Quando os arquivos oficiais estiverem disponiveis, coloque-os em
   * public/assets/marca/ e aponte os caminhos aqui. Enquanto estiverem
   * vazios, o site usa a versao tipografica da marca.
   */
  marca: {
    logoPseOficial: "",
    brasaoPrefeitura: "",
  },
} as const;

/* ------------------------------------------------------------------ */
/* Institucional                                                       */
/* ------------------------------------------------------------------ */

export const SITE = {
  nome: "PSE Nova Santa Rita",
  programa: "Programa Saúde na Escola",
  municipio: "Nova Santa Rita",
  slogan: "Aprender, cuidar e crescer juntos!",
  descricao:
    "Uma iniciativa do Programa Saúde na Escola de Nova Santa Rita que une educação e saúde para cuidar das nossas crianças, na escola, em casa e em todos os caminhos.",
  /** Frase institucional do rodape do material oficial. */
  frasePrefeitura: "Cuidando de pessoas, construindo o futuro.",
  /** Selo do material oficial. */
  selo: "Escola, família e saúde juntas por nossas crianças!",
} as const;

/** Fala do mascote no material oficial. */
export const FALA_CARAMELITO =
  "Sou o Caramelito, seu amigo na missão por uma vida mais saudável!";

/* ------------------------------------------------------------------ */
/* Contato [PLACEHOLDER]                                               */
/* ------------------------------------------------------------------ */

/**
 * [PLACEHOLDER] Canais oficiais. Nenhum contato foi confirmado nos
 * materiais de referencia; preencha antes da publicacao ou mantenha
 * o cartao informativo generico exibido hoje.
 */
export const CONTATO = {
  orgaoResponsavel: "", // ex.: "Secretaria Municipal de Saúde"
  email: "",
  telefone: "",
  endereco: "",
  sitePrefeitura: "", // ex.: "https://www.novasantarita.rs.gov.br"
} as const;

/* ------------------------------------------------------------------ */
/* Navegacao                                                           */
/* ------------------------------------------------------------------ */

export const NAV = [
  { href: "#projeto", label: "O projeto" },
  { href: "#missoes", label: "Missões" },
  { href: "#jogo", label: "O jogo" },
  { href: "#para-quem", label: "Para quem" },
  { href: "#seguranca", label: "Segurança" },
  { href: "#contato", label: "Contato" },
] as const;

/* ------------------------------------------------------------------ */
/* Missoes (conforme o material oficial)                               */
/* ------------------------------------------------------------------ */

export interface Missao {
  titulo: string;
  texto: string;
  /** Onde a missao acontece no jogo. */
  lugar: string;
  /** Chave de cor definida em global.css (--missao-*). */
  cor:
    | "verde"
    | "azul"
    | "roxo"
    | "amarelo"
    | "coral"
    | "agua"
    | "laranja";
  /** Chave do icone em components/Icon.astro. */
  icone:
    | "sorriso"
    | "maos"
    | "mente"
    | "respeito"
    | "alunos"
    | "coracao";
}

/** Missoes reais do jogo Heroes_Trial (conteudo ja implementado). */
export const MISSOES: Missao[] = [
  {
    titulo: "Escovando com Nico",
    texto: "O Nico está aprendendo a cuidar dos dentes: ajude-o a escovar direitinho, arrastando a escova sobre cada manchinha.",
    lugar: "Enfermaria",
    cor: "azul",
    icone: "sorriso",
  },
  {
    titulo: "Kit do Sorriso",
    texto: "Monte com o Cauã o Kit do Sorriso escolhendo os três objetos que cuidam dos dentes todos os dias.",
    lugar: "Cantina",
    cor: "agua",
    icone: "maos",
  },
  {
    titulo: "Quando a brincadeira deixa de ser brincadeira?",
    texto: "Perceba quando uma brincadeira magoa, ouça quem esteve ali e ajude a procurar um adulto de confiança.",
    lugar: "Pátio",
    cor: "roxo",
    icone: "mente",
  },
  {
    titulo: "Atitudes positivas",
    texto: "Com a Lia, lembre as atitudes que acolhem, que são ouvir, incluir e respeitar, e encontre os pares no jogo da memória.",
    lugar: "Pátio",
    cor: "verde",
    icone: "respeito",
  },
  {
    titulo: "Futebol no pátio",
    texto: "Um colega ficou de fora da partida: escolha como acolhê-lo e depois defenda o treino de chutes e bolas na quadra.",
    lugar: "Pátio",
    cor: "amarelo",
    icone: "alunos",
  },
  {
    titulo: "Respeitar também é cuidar",
    texto: "Com Caio, Leo e Bia, perceba o que cada um sente e respeite os limites no desafio do Semáforo do Conforto.",
    lugar: "Corredor",
    cor: "coral",
    icone: "coracao",
  },
];

/* ------------------------------------------------------------------ */
/* Como o jogo funciona (fluxo real das missoes)                        */
/* ------------------------------------------------------------------ */

/** Passos do fluxo de jogo, conforme as missoes implementadas. */
export const COMO_FUNCIONA = [
  {
    titulo: "Explore a escola",
    texto: "Caminhe pelo pátio, corredor, cantina, sala de aula e enfermaria. O ponto de exclamação mostra quem precisa de ajuda.",
  },
  {
    titulo: "Converse e escute",
    texto: "Cada missão começa com uma história em cenas ilustradas e diálogos com os colegas, cada um com o seu jeito de falar e sentir.",
  },
  {
    titulo: "Escolha com atenção",
    texto: "Nas decisões não existe resposta errada: cada escolha vem com uma reflexão guiada, sempre com tom positivo.",
  },
  {
    titulo: "Jogue minigames",
    texto: "Defenda chutes na quadra, encontre pares no jogo da memória, escove os dentinhos e monte o Kit do Sorriso.",
  },
  {
    titulo: "Comemore",
    texto: "Ao concluir cada missão, o Caramelito ganha ossinhos e biscoitos, e a escola fica um lugar melhor para todos.",
  },
] as const;

/** O que a demonstracao disponivel no navegador ja oferece. */
export const DESTAQUES = [
  "Jogue direto no navegador, sem instalar nada",
  "Seis missões com histórias, escolhas e minigames",
  "Ossinhos e biscoitos ao concluir cada desafio",
  "Personagens diversos, como são de verdade as nossas salas de aula",
  "Conteúdo alinhado às competências socioemocionais da BNCC",
  "Sem anúncios e sem coleta de dados das crianças",
] as const;

/* ------------------------------------------------------------------ */
/* Publico                                                             */
/* ------------------------------------------------------------------ */

export const PUBLICO = [
  {
    titulo: "Alunos",
    texto: "Crianças de 6 a 10 anos aprendendo brincando e cuidando da saúde e das amizades.",
    icone: "alunos" as const,
    cor: "verde" as const,
  },
  {
    titulo: "Professores",
    texto: "Apoio pedagógico e materiais pensados para a sala de aula e as lousas digitais.",
    icone: "professores" as const,
    cor: "azul" as const,
  },
  {
    titulo: "Famílias e responsáveis",
    texto: "Dicas e orientações para continuar o cuidado no dia a dia, em casa.",
    icone: "familias" as const,
    cor: "laranja" as const,
  },
];

/* ------------------------------------------------------------------ */
/* Seguranca e cuidado                                                 */
/* ------------------------------------------------------------------ */

export const SEGURANCA = [
  {
    titulo: "Sem anúncios",
    texto: "Ambiente fechado, sem publicidade e sem links que tirem a criança da atividade.",
    icone: "escudo" as const,
  },
  {
    titulo: "Dados protegidos",
    texto: "Nenhum dado pessoal é solicitado às crianças. Qualquer cadastro é exclusivo do adulto responsável, conforme a LGPD.",
    icone: "cadeado" as const,
  },
  {
    titulo: "Mediação de adultos",
    texto: "O uso acontece com professores ou familiares por perto, transformando o jogo em conversa e aprendizado.",
    icone: "maos" as const,
  },
  {
    titulo: "Conteúdo revisado",
    texto: "Temas sensíveis validados por pedagogos e psicólogos infantis, com tom positivo e acolhedor.",
    icone: "coracao" as const,
  },
  {
    titulo: "Acessível",
    texto: "Narração em áudio, botões grandes e navegação simples, pensados para quem ainda está aprendendo a ler.",
    icone: "acesso" as const,
  },
  {
    titulo: "Educação e saúde juntas",
    texto: "Uma iniciativa pública que integra escola, família e os profissionais de saúde do município.",
    icone: "ponte" as const,
  },
];

/* ------------------------------------------------------------------ */
/* Identidade                                                          */
/* ------------------------------------------------------------------ */

export const CORES_IDENTIDADE = [
  { nome: "Verde", significado: "Saúde e natureza", classe: "verde" },
  { nome: "Azul", significado: "Confiança e educação", classe: "azul" },
  { nome: "Amarelo", significado: "Alegria e energia", classe: "amarelo" },
  { nome: "Laranja", significado: "Cuidado e acolhimento", classe: "laranja" },
  { nome: "Roxo", significado: "Respeito e empatia", classe: "roxo" },
] as const;

/** Palavras da faixa de valores do material oficial. */
export const VALORES = ["Cuidar", "Respeitar", "Aprender", "Conviver", "Crescer"] as const;

/** Itens "Juntos por" do material oficial. */
export const JUNTOS_POR = [
  "Mais saúde",
  "Mais aprendizado",
  "Mais cuidado",
  "Mais respeito",
  "Mais futuro",
] as const;
