import { notFound, redirect } from "next/navigation";

import { AdultPortalError } from "@/application/adult-portal/errors";
import { PlayerResultsScreen } from "@/components/portal/results-screen";
import {
  getClassContentPageData,
  getPlayerResultsPageData,
} from "@/runtime/readers";
import { reportPage } from "@/application/game-events/report-pagination";
import {
  buildModuleOptions,
  parseModuleParam,
} from "@/components/portal/results-helpers";

export const metadata = { title: "Resultados do jogador" };

export default async function PlayerResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ classGroupId: string; playerSlotId: string }>;
  searchParams: Promise<{
    sessionPage?: string | string[];
    resultPage?: string | string[];
    modulo?: string | string[];
  }>;
}) {
  const { classGroupId, playerSlotId } = await params;
  const query = await searchParams;
  const moduleId = parseModuleParam(query.modulo);
  let report;
  try {
    report = await getPlayerResultsPageData(
      classGroupId,
      playerSlotId,
      {
        sessionPage: reportPage(query.sessionPage),
        resultPage: reportPage(query.resultPage),
      },
      moduleId,
    );
  } catch (error) {
    if (error instanceof AdultPortalError) {
      if (error.code === "NOT_FOUND") notFound();
      redirect("/portal/sem-acesso");
    }
    throw error;
  }
  if (!report) notFound();
  const content = await getClassContentPageData(classGroupId).catch(() => null);
  const moduleOptions = buildModuleOptions(
    (content?.modules ?? []).map((item) => ({
      id: item.module_id,
      label: item.title,
    })),
    report.moduleTotals,
    moduleId,
  );
  return (
    <PlayerResultsScreen
      report={report}
      moduleOptions={moduleOptions}
      moduleId={moduleId}
    />
  );
}
