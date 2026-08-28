import Link from "next/link";

import styles from "@/components/public/public.module.css";
import { Icon } from "@/components/shared/icon";
import { PublicState } from "@/components/public/public-state";
import { PrismaAccessLinkStore } from "@/server/db/prisma-access-link-store";
import { resolvePublicLink } from "@/server/services/public-link-service";

export const dynamic = "force-dynamic";

export default async function PublicActivityPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const resolution = await resolvePublicLink(token, {
    store: new PrismaAccessLinkStore(),
    clock: { now: () => new Date() },
  });

  if (resolution.status === "invalid") {
    return (
      <PublicState
        icon="search"
        title="Não encontramos esta missão."
        description="Confira se o link foi aberto por inteiro ou peça um novo acesso ao profissional responsável."
      />
    );
  }

  if (resolution.status === "paused") {
    return (
      <PublicState
        icon="pause"
        title="Esta missão está pausada."
        description="O acesso foi pausado temporariamente pela escola. Volte a abrir este mesmo link mais tarde."
      />
    );
  }

  if (resolution.status === "expired") {
    return (
      <PublicState
        icon="clock"
        title="Este link expirou."
        description="A missão não aceita novos acessos por este link. Peça um novo QR code ou link ao profissional responsável."
      />
    );
  }

  if (resolution.status === "revoked") {
    return (
      <PublicState
        icon="link"
        title="Este link não está mais ativo."
        description="O acesso foi substituído ou revogado. Use o link mais recente enviado pela escola."
      />
    );
  }

  return (
    <div>
      <article className={styles.missionCard}>
        <div className={styles.missionArt}>
          <span className={styles.dogMark} aria-hidden="true">
            <Icon name="gamepad" />
          </span>
        </div>
        <div className={styles.missionCopy}>
          <span className={styles.status}>Atividade liberada</span>
          <h1>Missões do Caramelito</h1>
          <p>
            A atividade interativa está pronta para você. Abra o jogo para
            começar.
          </p>
          <Link className={styles.primary} href={`/atividade/${token}/jogar`}>
            Abrir jogo <Icon name="arrow" />
          </Link>
        </div>
      </article>
      <p className={styles.contextLine}>
        <Icon name="shield" /> Você não precisa informar nome, e-mail ou criar
        uma conta.
      </p>
    </div>
  );
}
