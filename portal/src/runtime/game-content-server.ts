import "server-only";

import { connection } from "next/server";
import { redirect } from "next/navigation";

import type { ContentSelection } from "@/application/game-content/policy";
import type { StoredGameContentManifest } from "@/application/game-content/ports";
import type { ContentManifestV1, SessionContentPolicyV1 } from "@/contracts/v2";
import {
  getContentModules,
  getSessionContentChips,
  type ContentModuleChip,
  type ContentModuleModel,
} from "@/components/portal/content-selection-model";
import { getAuthGateway } from "@/server/auth/gateway";
import { getGameContentService } from "@/server/services/game-content-container";
import { getPlayerAccessService } from "@/server/services/player-access-container";

export type ClassContentPageData = {
  manifest: ContentManifestV1 | null;
  manifestId: string | null;
  modules: ContentModuleModel[];
  defaultSelection: ContentSelection | null;
  activeSession: {
    id: string;
    contentManifestId: string;
    policy: SessionContentPolicyV1;
    chips: ContentModuleChip[];
  } | null;
};

export type GameManifestsPageData = {
  manifests: Pick<
    StoredGameContentManifest,
    | "id"
    | "contentVersion"
    | "buildId"
    | "sourceCommit"
    | "importedAt"
    | "isCurrent"
  >[];
};

async function profileId(): Promise<string> {
  await connection();
  const session = await getAuthGateway().getSession();
  if (!session) redirect("/entrar");
  return session.actor.profileId;
}

export async function getClassContentPageData(
  classGroupId: string,
): Promise<ClassContentPageData> {
  const id = await profileId();
  const data = await (
    await getPlayerAccessService()
  ).getClassContent(id, classGroupId);
  const manifest = data.manifest?.payload ?? null;
  return {
    manifest,
    manifestId: data.manifest?.id ?? null,
    modules: manifest ? getContentModules(manifest) : [],
    defaultSelection: data.defaultSelection,
    activeSession:
      data.activeSession && data.activeManifest
        ? {
            id: data.activeSession.id,
            contentManifestId: data.activeSession.contentManifestId,
            policy: data.activeSession.contentPolicy,
            chips: getSessionContentChips(
              data.activeManifest.payload,
              data.activeSession.contentPolicy,
            ),
          }
        : null,
  };
}

export async function getGameManifestsPageData(): Promise<GameManifestsPageData> {
  const id = await profileId();
  const manifests = await (await getGameContentService()).list(id);
  return {
    manifests: manifests.map((manifest) => ({
      id: manifest.id,
      contentVersion: manifest.contentVersion,
      buildId: manifest.buildId,
      sourceCommit: manifest.sourceCommit,
      importedAt: manifest.importedAt,
      isCurrent: manifest.isCurrent,
    })),
  };
}
