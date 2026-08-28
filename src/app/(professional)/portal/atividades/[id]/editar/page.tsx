import { notFound } from "next/navigation";

import { AccessLinkBuilder } from "@/components/portal/activity-builder";
import { PageHeader } from "@/components/portal/page-header";
import {
  getDevBypassAccessLink,
  listAccessLinks,
} from "@/server/services/portal-view-service";

export const metadata = { title: "Editar link" };

export function generateStaticParams() {
  return listAccessLinks().map((link) => ({
    id: link.id,
  }));
}

/** Formats a date as YYYY-MM-DD in the school's timezone (avoids off-by-one). */
function expiresAtInputValue(expiresAt: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(expiresAt);
}

export default async function EditActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dbLink = getDevBypassAccessLink(id);

  if (!dbLink) {
    notFound();
  }

  const initialLabel = dbLink.label;
  const initialAudience = dbLink.audience;
  const initialExpiration = dbLink.expiresAt !== null ? "date" : "never";
  const initialExpiresAt =
    dbLink.expiresAt !== null
      ? expiresAtInputValue(dbLink.expiresAt)
      : undefined;

  return (
    <>
      <PageHeader
        eyebrow="Configurações do link"
        title="Editar link de acesso"
        description="Atualize o nome, o grupo e a validade do acesso sem alterar o jogo ou os resultados já recebidos."
      />
      <AccessLinkBuilder
        editing
        linkId={id}
        initialLabel={initialLabel}
        initialAudience={initialAudience}
        initialExpiration={initialExpiration}
        initialExpiresAt={initialExpiresAt}
      />
    </>
  );
}
