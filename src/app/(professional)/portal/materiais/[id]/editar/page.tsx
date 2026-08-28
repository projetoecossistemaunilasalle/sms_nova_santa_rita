import { notFound } from "next/navigation";

import { MaterialEditor } from "@/components/portal/material-editor";
import { PageHeader } from "@/components/portal/page-header";
import {
  getMaterial,
  listMaterials,
} from "@/server/services/portal-view-service";

export const metadata = { title: "Editar material" };

export function generateStaticParams() {
  return listMaterials().map((material) => ({
    id: material.id,
  }));
}

export default async function EditMaterialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const material = getMaterial(id);
  if (!material) notFound();

  return (
    <>
      <PageHeader
        eyebrow="Materiais / Edição"
        title="Editar material"
        description={`Última atualização: ${material.updated}, por ${material.editor}.`}
      />
      <MaterialEditor material={material} />
    </>
  );
}
