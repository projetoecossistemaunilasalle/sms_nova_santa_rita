import type { ActorSnapshot } from "@/application/adult-portal/types";
import type { ContentManifestV1 } from "@/contracts/v2";

export type StoredGameContentManifest = {
  id: string;
  contentVersion: string;
  buildId: string;
  sourceCommit: string | null;
  manifestHash: string;
  payload: ContentManifestV1;
  importedAt: Date;
  importedById: string | null;
  isCurrent: boolean;
};

export type NewGameContentManifest = Omit<
  StoredGameContentManifest,
  "id" | "importedAt" | "isCurrent"
>;

export interface GameContentReader {
  getActor(profileId: string): Promise<ActorSnapshot | null>;
  findByBuildId(buildId: string): Promise<StoredGameContentManifest | null>;
  current(): Promise<StoredGameContentManifest | null>;
  list(): Promise<StoredGameContentManifest[]>;
}

export interface GameContentTransaction extends GameContentReader {
  // A concurrent import of the same build returns the original immutable row.
  importManifest(
    input: NewGameContentManifest,
  ): Promise<StoredGameContentManifest>;
  setCurrent(manifestId: string): Promise<StoredGameContentManifest | null>;
}

export interface GameContentStore extends GameContentReader {
  transaction<T>(
    work: (transaction: GameContentTransaction) => Promise<T>,
  ): Promise<T>;
}
