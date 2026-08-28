import { PublicState } from "@/components/public/public-state";
import type { IconName } from "@/components/shared/icon";

const states: Record<
  string,
  { icon: IconName; title: string; description: string }
> = {
  invalida: {
    icon: "search",
    title: "Não encontramos esta missão.",
    description:
      "Confira se o link foi aberto por inteiro ou peça um novo acesso ao profissional responsável.",
  },
  expirada: {
    icon: "clock",
    title: "Este link expirou.",
    description:
      "A missão não aceita novos acessos por este link. Peça um novo QR code ou link ao profissional responsável.",
  },
  pausada: {
    icon: "pause",
    title: "A missão está em pausa.",
    description:
      "O profissional responsável interrompeu novos acessos por enquanto. Tente novamente mais tarde.",
  },
  encerrada: {
    icon: "archive",
    title: "Esta missão foi encerrada.",
    description:
      "O período de participação terminou e não é possível iniciar uma nova sessão.",
  },
  revogada: {
    icon: "link",
    title: "Este link não está mais ativo.",
    description:
      "O acesso foi substituído ou revogado. Use o link mais recente enviado pela escola.",
  },
  bloqueada: {
    icon: "shield",
    title: "A missão está indisponível.",
    description:
      "Um conteúdo necessário foi bloqueado temporariamente. Nenhuma ação é necessária no seu dispositivo.",
  },
};

export function generateStaticParams() {
  const tokens = ["7FQ-29M", "2KF-81P", "habitos-saudaveis", "turma-5b"];
  const stateKeys = Object.keys(states);
  const params: Array<{ token: string; state: string }> = [];

  for (const token of tokens) {
    for (const state of stateKeys) {
      params.push({ token, state });
    }
  }

  return params;
}

export default async function PublicActivityStatePage({
  params,
}: {
  params: Promise<{ token: string; state: string }>;
}) {
  const { token, state } = await params;
  const current = states[state] ?? states.invalida!;
  return (
    <PublicState
      {...current}
      retryHref={state === "pausada" ? `/atividade/${token}` : undefined}
    />
  );
}
