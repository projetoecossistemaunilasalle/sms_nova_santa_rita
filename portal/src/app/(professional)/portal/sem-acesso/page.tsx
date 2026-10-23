import Link from "next/link";

import { PortalState } from "@/components/portal/portal-state";
import styles from "@/components/portal/portal.module.css";

export const metadata = { title: "Acesso não permitido" };

export default function ForbiddenPage() {
  return (
    <PortalState
      icon="lock"
      title="Seu acesso não inclui esta área."
      description="A organização e as permissões da sua conta não permitem abrir este conteúdo. Volte ao portal ou fale com um administrador."
      actions={
        <Link className={styles.button} href="/portal">
          Voltar à visão geral
        </Link>
      }
    />
  );
}
