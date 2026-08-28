import { PublicState } from "@/components/public/public-state";
import type { IconName } from "@/components/shared/icon";

const gameStates: Record<
  string,
  { icon: IconName; title: string; description: string }
> = {
  offline: {
    icon: "alert",
    title: "A conexão caiu antes do jogo começar.",
    description:
      "Verifique a internet e tente novamente. Nenhum resultado foi perdido.",
  },
  bloqueado: {
    icon: "shield",
    title: "Este jogo ficou indisponível.",
    description: "Volte à missão para escolher outro jogo liberado.",
  },
  expirado: {
    icon: "clock",
    title: "O tempo desta sessão terminou.",
    description:
      "Abra novamente o link da atividade para iniciar uma nova sessão.",
  },
  versao: {
    icon: "settings",
    title: "Este jogo precisa ser atualizado.",
    description:
      "A versão disponível neste dispositivo não é compatível com a missão.",
  },
  reenvio: {
    icon: "history",
    title: "Estamos enviando o resultado.",
    description:
      "Mantenha esta tela aberta. O envio será repetido automaticamente quando a conexão voltar.",
  },
};

export function generateStaticParams() {
  const tokens = ["7FQ-29M", "2KF-81P", "habitos-saudaveis", "turma-5b"];
  const stateKeys = Object.keys(gameStates);
  const params: Array<{ token: string; state: string }> = [];

  for (const token of tokens) {
    for (const state of stateKeys) {
      params.push({ token, state });
    }
  }

  return params;
}

export default async function GameStatePage({
  params,
}: {
  params: Promise<{ token: string; state: string }>;
}) {
  const { token, state } = await params;
  const current = gameStates[state] ?? gameStates.offline!;
  return <PublicState {...current} retryHref={`/atividade/${token}/jogar`} />;
}
