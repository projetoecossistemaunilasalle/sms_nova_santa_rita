import { MaterialEditor } from "@/components/portal/material-editor";
import { PageHeader } from "@/components/portal/page-header";

export const metadata = { title: "Novo material" };

export default function NewMaterialPage() {
  return (
    <>
      <PageHeader
        eyebrow="Materiais / Novo"
        title="Novo material"
        description="Prepare o conteúdo e revise como ele será apresentado antes de publicar."
      />
      <MaterialEditor />
    </>
  );
}
