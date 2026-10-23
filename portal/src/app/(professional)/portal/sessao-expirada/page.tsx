import Link from "next/link";

import { PortalState } from "@/components/portal/portal-state";
import styles from "@/components/portal/portal.module.css";

export const metadata = { title: "Sessão expirada" };

export default function SessionExpiredPage() {
  return (
    <PortalState
      icon="clock"
      title="Sua sessão terminou."
      description="Entre novamente para continuar. O rascunho salvo antes do término da sessão permanece disponível."
      actions={
        <Link className={styles.button} href="/entrar">
          Entrar novamente
        </Link>
      }
    />
  );
}
