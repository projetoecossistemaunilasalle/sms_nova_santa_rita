import type { ActivityStatus } from "@/server/services/portal-view-service";

import styles from "./portal.module.css";

type Status =
  | ActivityStatus
  | "Ativa"
  | "Ativo"
  | "Arquivado"
  | "Convite pendente"
  | "Lançamentos bloqueados"
  | "Novas atividades bloqueadas";

export function StatusBadge({ status }: { status: Status }) {
  const tone =
    status === "Aberta" || status === "Ativa" || status === "Ativo"
      ? styles.statusPositive
      : status === "Rascunho" || status === "Convite pendente"
        ? styles.statusWarning
        : status === "Pausada" ||
            status.includes("bloquead") ||
            status.includes("Bloquead")
          ? styles.statusDanger
          : styles.statusNeutral;

  return <span className={`${styles.statusBadge} ${tone}`}>{status}</span>;
}
