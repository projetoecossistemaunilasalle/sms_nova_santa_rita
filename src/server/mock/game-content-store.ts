import { randomUUID } from "node:crypto";

import type {
  GameContentStore,
  GameContentTransaction,
  NewGameContentManifest,
  StoredGameContentManifest,
} from "@/application/game-content/ports";
import {
  hashManifest,
  validateManifest,
} from "@/application/game-content/manifest";
import fixture from "./fixtures/content-manifest.json";
import { DemoAdultPortalStore, type DemoAdultPortalState } from "./seed-store";

export function demoGameContentSeed(): StoredGameContentManifest[] {
  const payload = validateManifest(fixture);
  return [
    {
      id: "00000000-0000-4000-8000-000000000001",
      contentVersion: payload.content_version,
      buildId: "demo-v2-fixture",
      sourceCommit: null,
      manifestHash: hashManifest(payload),
      payload,
      importedAt: new Date("2026-10-23T00:00:00Z"),
      importedById: null,
      isCurrent: true,
    },
  ];
}

export class DemoGameContentStore
  implements GameContentStore, GameContentTransaction
{
  private pending: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly state: DemoAdultPortalState,
    private readonly manifests: StoredGameContentManifest[] = demoGameContentSeed(),
    private readonly runTransaction?: <T>(
      work: (state: DemoAdultPortalState) => Promise<T>,
    ) => Promise<T>,
  ) {}

  getActor(profileId: string) {
    return new DemoAdultPortalStore(this.state).getActor(profileId);
  }

  async findByBuildId(buildId: string) {
    return structuredClone(
      this.manifests.find((item) => item.buildId === buildId) ?? null,
    );
  }

  async current() {
    return structuredClone(
      this.manifests.find((item) => item.isCurrent) ?? null,
    );
  }

  async list() {
    return structuredClone(
      [...this.manifests].sort(
        (left, right) =>
          right.importedAt.getTime() - left.importedAt.getTime() ||
          right.id.localeCompare(left.id),
      ),
    );
  }

  async importManifest(input: NewGameContentManifest) {
    const existing = await this.findByBuildId(input.buildId);
    if (existing) return existing;
    const row = {
      ...structuredClone(input),
      id: randomUUID(),
      importedAt: new Date(),
      isCurrent: false,
    };
    this.manifests.push(row);
    return structuredClone(row);
  }

  async setCurrent(manifestId: string) {
    const target = this.manifests.find((item) => item.id === manifestId);
    if (!target) return null;
    for (const row of this.manifests) row.isCurrent = row === target;
    return structuredClone(target);
  }

  transaction<T>(
    work: (transaction: GameContentTransaction) => Promise<T>,
  ): Promise<T> {
    const execute = async (state: DemoAdultPortalState) => {
      const draft = structuredClone(this.manifests);
      const result = await work(new DemoGameContentStore(state, draft));
      this.manifests.splice(0, this.manifests.length, ...draft);
      return result;
    };
    if (this.runTransaction) return this.runTransaction(execute);
    const operation = this.pending.then(() => execute(this.state));
    this.pending = operation.catch(() => undefined);
    return operation;
  }

  async reset(): Promise<void> {
    await this.transaction(async (transaction) => {
      const draft = transaction as DemoGameContentStore;
      draft.manifests.splice(
        0,
        draft.manifests.length,
        ...demoGameContentSeed(),
      );
    });
  }
}
