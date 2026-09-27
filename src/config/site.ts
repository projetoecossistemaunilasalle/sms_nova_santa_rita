/**
 * Configuracao central do site PSE Nova Santa Rita.
 *
 * TODOS os caminhos de assets e textos institucionais ficam aqui.
 * Para substituir textos, links, logotipos ou imagens, edite este arquivo —
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
  jogo: "/jogo/",
  portal: "/portal/",
} as const;

/* ------------------------------------------------------------------ */
/* Assets                                                              */
/* ------------------------------------------------------------------ */

export const ASSETS = {
  mascot: {
    /** Pose principal de apresentacao (acenando). */
    classico: withBase("/assets/mascot/caramelinho-classico.webp"),
    /** Pose de deslocamento/caminhada. */
    movimento: withBase("/assets/mascot/caramelinho-movimento.webp"),
    /** Quadro A da cena "observando uma folha". */
    papelA: withBase("/assets/mascot/caramelinho-papel-a.webp"),
    /** Quadro B da cena "observando uma folha" (rabo abanando). */
    papelB: withBase("/assets/mascot/caramelinho-papel-b.webp"),
    /** Largura/altura naturais dos sprites (quadrados, com margem interna). */
    width: 640,
    height: 640,
  },
  /** Arte conceitual do jogo de tabuleiro (fornecida pelo projeto). */
  arteConceitual: withBase("/assets/conceito/jogo-tabuleiro-conceito.webp"),
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
    "Uma iniciativa do Programa Saúde na Escola de Nova Santa Rita que une educação e saúde para cuidar das nossas crianças — na escola, em casa e em todos os caminhos.",
  /** Frase institucional do rodape do material oficial. */
  frasePrefeitura: "Cuidando de pessoas, construindo o futuro.",
  /** Selo do material oficial. */
  selo: "Escola, família e saúde juntas por nossas crianças!",
} as const;

/** Fala do mascote no material oficial. */
export const FALA_CARAMELINHO =
  "Sou o Caramelinho, seu amigo na missão por uma vida mais saudável!";

/* ------------------------------------------------------------------ */
/* Contato — [PLACEHOLDER]                                             */
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
  { href: "#experiencia", label: "A experiência" },
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
    | "alimentacao"
    | "sorriso"
    | "mente"
    | "vacina"
    | "dengue"
    | "respeito"
    | "paz";
}

export const MISSOES: Missao[] = [
  {
    titulo: "Alimentação Saudável",
    texto: "Escolhas gostosas e coloridas que dão energia para brincar e aprender.",
    cor: "verde",
    icone: "alimentacao",
  },
  {
    titulo: "Sorriso Saudável",
    texto: "Cuidados diários com os dentes para sorrir com confiança.",
    cor: "azul",
    icone: "sorriso",
  },
  {
    titulo: "Saúde Emocional",
    texto: "Reconhecer sentimentos, pedir ajuda e cuidar de si e dos amigos.",
    cor: "roxo",
    icone: "mente",
  },
  {
    titulo: "Vacina em Dia",
    texto: "Proteção que cuida de cada criança e de toda a comunidade escolar.",
    cor: "amarelo",
    icone: "vacina",
  },
  {
    titulo: "Sem Dengue",
    texto: "Pequenas atitudes que afastam o mosquito e protegem a turma.",
    cor: "coral",
    icone: "dengue",
  },
  {
    titulo: "Respeito e Convivência",
    texto: "Amizade, cooperação e acolhimento das diferenças todos os dias.",
    cor: "agua",
    icone: "respeito",
  },
  {
    titulo: "Cultura de Paz",
    texto: "Prevenção das violências com diálogo, empatia e adultos de confiança.",
    cor: "laranja",
    icone: "paz",
  },
];

/* ------------------------------------------------------------------ */
/* A experiencia educativa (em desenvolvimento)                        */
/* ------------------------------------------------------------------ */

/** Trechos do percurso do jogo em preparacao, conforme o documento de concepcao. */
export const TRILHA = [
  {
    titulo: "Saída de casa",
    texto: "Organizar a rotina da manhã e se despedir da família com carinho.",
  },
  {
    titulo: "Ônibus escolar",
    texto: "Convivência e segurança no transporte: respeito ao motorista e aos colegas.",
  },
  {
    titulo: "Travessia da rua",
    texto: "Atravessar com atenção, observando sinais, faixas e a orientação dos adultos.",
  },
  {
    titulo: "Chegada à escola",
    texto: "Respeito aos colegas e profissionais, cuidado com os espaços e os materiais.",
  },
  {
    titulo: "Hora do recreio",
    texto: "Partilha, brincadeiras coletivas e resolução pacífica dos pequenos conflitos.",
  },
  {
    titulo: "Volta para casa",
    texto: "Fim de um dia de aprendizados, com o coração cheio de boas escolhas.",
  },
] as const;

/** Caracteristicas previstas da experiencia digital (nunca afirmar que ja existem). */
export const PREVISTO = [
  "Jogo de tabuleiro digital para jogar no navegador, sem instalação",
  "Para jogar em grupo no mesmo dispositivo ou individualmente",
  "Personagens diversos, como são de verdade as nossas salas de aula",
  "Roleta, estrelinhas de incentivo e desafios do dia a dia",
  "Conteúdo alinhado às competências socioemocionais da BNCC",
  "Roteiros revisados por pedagogos e psicólogos infantis",
] as const;

/* ------------------------------------------------------------------ */
/* Publico                                                             */
/* ------------------------------------------------------------------ */

export const PUBLICO = [
  {
    titulo: "Alunos",
    texto: "Crianças de 6 a 10 anos aprendendo brincando — e cuidando da saúde e das amizades.",
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
