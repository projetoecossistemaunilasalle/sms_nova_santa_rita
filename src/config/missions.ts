export interface Missao {
  id: string;
  titulo: string;
  texto: string;
  lugar: string;
  atividade: string;
  atividadeId: string | null;
  cor: "verde" | "azul" | "roxo" | "amarelo" | "coral" | "agua";
  icone: "sorriso" | "maos" | "mente" | "respeito" | "alunos" | "coracao";
}

// Catalogo Phaser conferido em Heroes_Trial@84e44ca, em 2026-10-11.
// IDs e titulos seguem as definicoes; lugares seguem os nomes visiveis no jogo.
export const MISSOES: Missao[] = [
  {
    id: "lia_memory",
    titulo: "Atitudes positivas",
    texto:
      "Converse com Lia sobre ouvir, incluir e respeitar. Depois, encontre os pares de atitudes acolhedoras no jogo da memória.",
    lugar: "Pátio central",
    atividade: "Jogo da memória",
    atividadeId: "lia_memory",
    cor: "verde",
    icone: "respeito",
  },
  {
    id: "pingpong_soccer",
    titulo: "Futebol no pátio",
    texto:
      "Um colega ficou de fora do futebol. Escolha como acolhê-lo e participe do treino de defesa de bolas, movendo o tênis com o toque ou as setas.",
    lugar: "Parquinho",
    atividade: "Defesa de bolas",
    atividadeId: "pingpong_defense",
    cor: "amarelo",
    icone: "alunos",
  },
  {
    id: "respect_also_cares",
    titulo: "Respeitar também é cuidar",
    texto:
      "Com Caio, Leo e Bia, reconheça sentimentos e limites. No Semáforo do Conforto, pratique o respeito e descubra quando procurar ajuda.",
    lugar: "Corredor",
    atividade: "Semáforo do Conforto",
    atividadeId: "comfort_traffic_light",
    cor: "coral",
    icone: "coracao",
  },
  {
    id: "when_play_stops_being_play",
    titulo: "Quando a brincadeira deixa de ser brincadeira?",
    texto:
      "Comece no pátio, escute quem fez o comentário na sala de aula e a testemunha no refeitório. Volte para acolher o colega e pensar em um adulto de confiança.",
    lugar: "Pátio, sala e refeitório",
    atividade: "Exploração, diálogo e escolhas",
    atividadeId: null,
    cor: "roxo",
    icone: "mente",
  },
  {
    id: "brushing_teeth",
    titulo: "Escovando com Nico",
    texto:
      "Encontre Nico no lavatório do banheiro e ajude-o a cuidar do sorriso. Arraste a escova sobre as manchinhas dos dentes e comemore a escovação.",
    lugar: "Banheiro",
    atividade: "Escovação interativa",
    atividadeId: "brushing_teeth_practice",
    cor: "azul",
    icone: "sorriso",
  },
  {
    id: "smile_kit",
    titulo: "Kit do Sorriso",
    texto:
      "Encontre Cauã no refeitório e monte seu Kit do Sorriso. Escolha os três objetos usados no cuidado diário dos dentes para completar o desafio.",
    lugar: "Refeitório",
    atividade: "Seleção de objetos",
    atividadeId: "smile_kit_selection",
    cor: "agua",
    icone: "maos",
  },
];

export const TOTAL_MINIGAMES = MISSOES.filter((missao) => missao.atividadeId !== null).length;
