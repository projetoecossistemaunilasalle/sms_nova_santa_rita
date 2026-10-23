import type { StoredGameContentManifest } from "@/application/game-content/ports";
import {
  hashManifest,
  validateManifest,
} from "@/application/game-content/manifest";
import fixture from "./fixtures/content-manifest.json";

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
