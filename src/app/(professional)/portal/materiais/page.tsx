import Link from "next/link";

import { MaterialsExplorer } from "@/components/portal/materials-explorer";
import { PageHeader } from "@/components/portal/page-header";
import styles from "@/components/portal/portal.module.css";
import { PortalState } from "@/components/portal/portal-state";
import { Icon } from "@/components/shared/icon";
import { listMaterials } from "@/server/services/portal-view-service";

export const metadata = { title: "Materiais" };

export default function MaterialsPage() {
  const materials = listMaterials();

  return (
    <>
      <PageHeader
        eyebrow="Biblioteca de apoio"
        title="Materiais"
        description="Organize guias, atividades e comunicados para apoiar o trabalho com escolas e famílias."
        actions={
          <Link className={styles.button} href="/portal/materiais/novo">
            <Icon name="plus" /> Novo material
          </Link>
        }
      />
      {materials.length > 0 ? (
        <MaterialsExplorer materials={materials} />
      ) : (
        <PortalState
          icon="book"
          title="A demonstração de materiais está desativada"
          description="Os conteúdos de exemplo ficam disponíveis somente no ambiente de desenvolvimento."
        />
      )}
    </>
  );
}
