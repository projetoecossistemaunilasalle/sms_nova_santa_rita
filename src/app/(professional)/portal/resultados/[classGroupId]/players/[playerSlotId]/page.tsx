import { notFound, redirect } from "next/navigation";

import { AdultPortalError } from "@/application/adult-portal/errors";
import { PlayerResultsScreen } from "@/components/portal/results-screen";
import { getPlayerResultsPageData } from "@/runtime/readers";
import { reportPage } from "@/application/game-events/report-pagination";

export const metadata = { title: "Resultados do jogador" };

export default async function PlayerResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ classGroupId: string; playerSlotId: string }>;
  searchParams: Promise<{
    sessionPage?: string | string[];
    resultPage?: string | string[];
  }>;
}) {
  const { classGroupId, playerSlotId } = await params;
  const query = await searchParams;
  let report;
  try {
    report = await getPlayerResultsPageData(classGroupId, playerSlotId, {
      sessionPage: reportPage(query.sessionPage),
      resultPage: reportPage(query.resultPage),
    });
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
