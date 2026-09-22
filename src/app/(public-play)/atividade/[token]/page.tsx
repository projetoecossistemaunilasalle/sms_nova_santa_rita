import Link from "next/link";

import styles from "@/components/public/public.module.css";
import { Icon } from "@/components/shared/icon";
import { listAccessLinks } from "@/server/services/portal-view-service";
import { isDemoRuntime } from "@/runtime/mode";

export const metadata = { title: "Atividade liberada" };

export function generateStaticParams() {
  if (!isDemoRuntime()) return [];
  const tokens = ["7FQ-29M", "2KF-81P", "habitos-saudaveis", "turma-5b"];
  listAccessLinks().forEach((l) => {
    if (!tokens.includes(l.id)) tokens.push(l.id);
  });
  return tokens.map((token) => ({ token }));
}

export default async function PublicActivityPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

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
