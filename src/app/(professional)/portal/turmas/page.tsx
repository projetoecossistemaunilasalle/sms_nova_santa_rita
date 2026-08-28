import { ClassGroupsExplorer } from "@/components/portal/class-groups-explorer";
import { PageHeader } from "@/components/portal/page-header";
import { PortalState } from "@/components/portal/portal-state";
import { listClassGroups } from "@/server/services/portal-view-service";

export const metadata = { title: "Turmas" };

export default function ClassGroupsPage() {
  const classGroups = listClassGroups();

  return (
    <>
      <PageHeader
        eyebrow="Grupos de trabalho"
        title="Turmas"
        description="Acompanhe grupos e resultados coletivos sem cadastrar ou identificar estudantes."
      />
      {classGroups.length > 0 ? (
        <ClassGroupsExplorer classGroups={classGroups} />
      ) : (
        <PortalState
          icon="school"
          title="A demonstração de turmas está desativada"
          description="Os grupos de exemplo ficam disponíveis somente no ambiente de desenvolvimento."
        />
      )}
    </>
  );
}
