import { z } from "zod";

import { AdultPortalError } from "@/application/adult-portal/errors";
import { toAuthorizationActor } from "@/application/authorization/authorization-actor";
import { canManageOrganizations } from "@/server/authorization/v1-policy";
import {
  CONTENT_MANIFEST_MAX_UTF8_BYTES,
  type ContentManifestV1,
  type SessionContentPolicyV1,
} from "@/contracts/v2";

import { hashManifest, validateManifest } from "./manifest";
import { resolvePolicy, type ContentSelection } from "./policy";
import type {
  GameContentReader,
  GameContentStore,
  StoredGameContentManifest,
} from "./ports";
export { resolvePolicy } from "./policy";
export type { ContentSelection } from "./policy";

const buildSchema = z.object({ buildId: z.string().trim().min(1).max(100) });
const releaseSchema = z.object({
  sourceCommit: z.string().trim().min(1).max(64).optional(),
});

export class GameContentService {
  constructor(
    private readonly store: GameContentStore,
    private readonly clientUrl: () => string | null,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  private async requireAdmin(
    profileId: string,
    reader: GameContentReader = this.store,
  ): Promise<void> {
    const actor = await reader.getActor(profileId);
    if (!actor || !canManageOrganizations(toAuthorizationActor(actor))) {
      throw new AdultPortalError(
        "Somente administradores da plataforma podem gerenciar conteudo.",
        "FORBIDDEN",
      );
    }
  }

  private async readJson(url: URL, optional = false): Promise<unknown> {
    try {
      const response = await this.fetcher(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      if (optional && response.status === 404) return null;
      if (!response.ok) throw new Error("HTTP failure");
      const body = await response.text();
      if (Buffer.byteLength(body, "utf8") > CONTENT_MANIFEST_MAX_UTF8_BYTES) {
        throw new Error("Response too large");
      }
      return JSON.parse(body) as unknown;
    } catch {
      throw new AdultPortalError(
        "Nao foi possivel ler os metadados do jogo.",
        "VALIDATION",
      );
    }
  }

  async importFromGameClient(
    profileId: string,
  ): Promise<StoredGameContentManifest> {
    await this.requireAdmin(profileId);
    const configured = this.clientUrl();
    let base: URL;
    try {
      if (!configured) throw new Error("Missing URL");
      base = new URL(configured);
      if (
        !["http:", "https:"].includes(base.protocol) ||
        base.username ||
        base.password
      )
        throw new Error("Invalid URL");
      base.search = "";
      base.hash = "";
      if (/\/[^/]+\.html?$/.test(base.pathname)) base = new URL("./", base);
      else if (!base.pathname.endsWith("/")) base.pathname += "/";
    } catch {
      throw new AdultPortalError(
        "GAME_CLIENT_URL nao configurada ou invalida.",
        "CONFLICT",
      );
    }
    const build = buildSchema.safeParse(
      await this.readJson(new URL("offline-shell.json", base)),
    );
    if (!build.success)
      throw new AdultPortalError("Build do jogo invalida.", "VALIDATION");
    const existing = await this.store.findByBuildId(build.data.buildId);
    if (existing) return existing;
    const payload = validateManifest(
      await this.readJson(new URL("content-manifest.json", base)),
    );
    const release = releaseSchema.safeParse(
      (await this.readJson(new URL("release.json", base), true)) ?? {},
    );
    if (!release.success)
      throw new AdultPortalError("Release do jogo invalida.", "VALIDATION");
    const latestBuild = buildSchema.safeParse(
      await this.readJson(new URL("offline-shell.json", base)),
    );
    if (
      !latestBuild.success ||
      latestBuild.data.buildId !== build.data.buildId
    ) {
      throw new AdultPortalError(
        "A build mudou durante a importacao. Tente novamente.",
        "CONFLICT",
      );
    }
    // Network I/O stays outside the transaction; recheck access before writing.
    return this.store.transaction(async (transaction) => {
      await this.requireAdmin(profileId, transaction);
      return transaction.importManifest({
        contentVersion: payload.content_version,
        buildId: build.data.buildId,
        sourceCommit: release.data.sourceCommit ?? null,
        manifestHash: hashManifest(payload),
        payload,
        importedById: profileId,
      });
    });
  }

  async setCurrent(
    profileId: string,
    manifestId: string,
  ): Promise<StoredGameContentManifest> {
    return this.store.transaction(async (transaction) => {
      await this.requireAdmin(profileId, transaction);
      const manifest = await transaction.setCurrent(manifestId);
      if (!manifest)
        throw new AdultPortalError("Manifesto nao encontrado.", "NOT_FOUND");
      return manifest;
    });
  }

  async current(profileId: string): Promise<StoredGameContentManifest | null> {
    await this.requireAdmin(profileId);
    return this.store.current();
  }

  async list(profileId: string): Promise<StoredGameContentManifest[]> {
    await this.requireAdmin(profileId);
    return this.store.list();
  }

  resolvePolicy(
    selection: ContentSelection | null,
    manifest: ContentManifestV1,
  ): SessionContentPolicyV1 {
    return resolvePolicy(selection, manifest);
  }
}
