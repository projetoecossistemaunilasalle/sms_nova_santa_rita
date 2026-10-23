import { redirect } from "next/navigation";

import { AdultPortalError } from "@/application/adult-portal/errors";
import { GameVersionsScreen } from "@/components/portal/game-versions-screen";
import { getGameManifestsPageData } from "@/runtime/readers";

export const metadata = { title: "Versões do jogo" };

export default async function GameVersionsPage() {
  let data;
  try {
    data = await getGameManifestsPageData();
  } catch (error) {
    // The reader enforces platform-admin access; everyone else is sent away.
    if (error instanceof AdultPortalError && error.code === "FORBIDDEN") {
      redirect("/portal/sem-acesso");
    }
    throw error;
  }
  return <GameVersionsScreen manifests={data.manifests} />;
}
