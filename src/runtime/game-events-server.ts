import "server-only";

import { connection } from "next/server";

import { getAuthGateway } from "@/server/auth/gateway";
import { getGameEventReportService } from "@/server/services/game-event-container";

async function profileId(): Promise<string> {
  await connection();
  const session = await getAuthGateway().getSession();
  if (!session) throw new Error("Authenticated portal session required.");
  return session.actor.profileId;
}

export async function getResultReportsPageData() {
  return getGameEventReportService().listClassReports(await profileId());
}

export async function getClassResultsPageData(classGroupId: string) {
  return getGameEventReportService().getClassReport(
    await profileId(),
    classGroupId,
  );
}

export async function getPlayerResultsPageData(
  classGroupId: string,
  playerSlotId: string,
) {
  return getGameEventReportService().getPlayerReport(
    await profileId(),
    classGroupId,
    playerSlotId,
  );
}

export function listStaticResultClassIds(): string[] {
  return [];
}

export function listStaticResultPlayerParams(): {
  classGroupId: string;
  playerSlotId: string;
}[] {
  return [];
}
