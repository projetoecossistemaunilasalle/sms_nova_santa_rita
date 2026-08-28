import { AccessLinkBuilder } from "@/components/portal/activity-builder";
import { PageHeader } from "@/components/portal/page-header";

export const metadata = { title: "Novo link" };

export default function NewActivityPage() {
  return (
    <>
      <PageHeader
        eyebrow="Novo link"
        title="Crie um acesso para a turma."
        description="Defina quem receberá o link. A experiência GameMaker já está pronta e não precisa ser configurada aqui."
      />
      <AccessLinkBuilder />
    </>
  );
}
