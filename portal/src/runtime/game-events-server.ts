import "server-only";

import { connection } from "next/server";
import { redirect } from "next/navigation";

import { getAuthGateway } from "@/server/auth/gateway";
import { getGameEventReportService } from "@/server/services/game-event-container";
import type { PlayerHistoryPage } from "@/application/game-events/report-pagination";

async function profileId(): Promise<string> {
  await connection();
  const session = await getAuthGateway().getSession();
  if (!session) redirect("/entrar");
  return session.actor.profileId;
}

export async function getResultReportsPageData(moduleId?: string) {
  const id = await profileId();
  return (await getGameEventReportService()).listClassReports(id, moduleId);
}

export async function getClassResultsPageData(
  classGroupId: string,
  moduleId?: string,
) {
  const id = await profileId();
  return (await getGameEventReportService()).getClassReport(
    id,
    classGroupId,
    moduleId,
  );
}

export async function getPlayerResultsPageData(
  classGroupId: string,
  playerSlotId: string,
  page?: PlayerHistoryPage,
  moduleId?: string,
) {
  const id = await profileId();
  return (await getGameEventReportService()).getPlayerReport(
    id,
    classGroupId,
    playerSlotId,
    page,
    moduleId,
  );
}
