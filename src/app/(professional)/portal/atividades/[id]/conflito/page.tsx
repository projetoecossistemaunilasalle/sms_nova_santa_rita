import Link from "next/link";

import { PortalState } from "@/components/portal/portal-state";
import styles from "@/components/portal/portal.module.css";
import { listAccessLinks } from "@/server/services/portal-view-service";

export const metadata = { title: "Link atualizado" };

export function generateStaticParams() {
  return listAccessLinks().map((link) => ({
    id: link.id,
  }));
}

export default async function StaleDraftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <PortalState
      icon="history"
      title="Este link mudou em outra sessão."
      description="Recarregue as configurações mais recentes antes de continuar. Suas alterações locais não sobrescreveram o acesso salvo."
      actions={
        <>
          <Link
            className={styles.button}
            href={`/portal/atividades/${id}/editar`}
          >
            Recarregar link
          </Link>
          <Link
            className={styles.buttonGhost}
            href={`/portal/atividades/${id}`}
          >
            Voltar ao link
          </Link>
        </>
      }
    />
  );
}
