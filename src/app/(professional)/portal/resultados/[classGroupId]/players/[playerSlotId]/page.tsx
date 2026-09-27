import { notFound, redirect } from "next/navigation";

import { AdultPortalError } from "@/application/adult-portal/errors";
import { PlayerResultsScreen } from "@/components/portal/results-screen";
import {
  getPlayerResultsPageData,
  listStaticResultPlayerParams,
} from "@/runtime/readers";

export const metadata = { title: "Resultados do jogador" };

export function generateStaticParams() {
  return listStaticResultPlayerParams();
}

export default async function PlayerResultsPage({
  params,
}: {
  params: Promise<{ classGroupId: string; playerSlotId: string }>;
}) {
  const { classGroupId, playerSlotId } = await params;
  let report;
  try {
    report = await getPlayerResultsPageData(classGroupId, playerSlotId);
  } catch (error) {
    if (error instanceof AdultPortalError) {
      if (error.code === "NOT_FOUND") notFound();
      redirect("/portal/sem-acesso");
    }
    throw error;
  }
  if (!report) notFound();
  return <PlayerResultsScreen report={report} />;
}
