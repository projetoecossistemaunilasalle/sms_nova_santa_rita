import { notFound, redirect } from "next/navigation";

import { AdultPortalError } from "@/application/adult-portal/errors";
import { OrganizationDetailScreen } from "@/components/portal/organization-detail-screen";
import { getRuntimeMode } from "@/runtime/mode";
import { getOrganizationPageData } from "@/runtime/readers";

export const metadata = { title: "Detalhe da organização" };

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let organization;
  try {
    organization = await getOrganizationPageData(id);
  } catch (error) {
    if (error instanceof AdultPortalError) {
      if (error.code === "NOT_FOUND") notFound();
      redirect("/portal/sem-acesso");
    }
    throw error;
  }
  return (
    <OrganizationDetailScreen
      initialOrganization={organization}
      runtimeMode={getRuntimeMode()}
    />
  );
}
