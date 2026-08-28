import Link from "next/link";

import { PortalState } from "@/components/portal/portal-state";
import styles from "@/components/portal/portal.module.css";
import { Icon } from "@/components/shared/icon";

export const metadata = { title: "Nenhum link" };

export default function EmptyActivitiesPage() {
  return (
    <PortalState
      icon="flag"
      title="Crie o primeiro link de acesso."
      description="A experiência Missões do Caramelito já está pronta. Gere um link personalizado para compartilhar com a turma."
      actions={
        <Link className={styles.button} href="/portal/atividades/nova">
          <Icon name="link" /> Novo link
        </Link>
      }
    />
  );
}
