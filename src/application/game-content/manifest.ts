import { createHash } from "node:crypto";

import { AdultPortalError } from "@/application/adult-portal/errors";
import {
  contentManifestV1Schema,
  type ContentManifestV1,
} from "@/contracts/v2";

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
    .join(",")}}`;
}

export function hashManifest(manifest: ContentManifestV1): string {
  return createHash("sha256").update(canonicalJson(manifest)).digest("hex");
}

export function validateManifest(input: unknown): ContentManifestV1 {
  const parsed = contentManifestV1Schema.safeParse(input);
  if (!parsed.success) {
    throw new AdultPortalError("Manifesto de conteudo invalido.", "VALIDATION");
  }
  const manifest = parsed.data;
  const unique = (ids: string[]) => new Set(ids).size === ids.length;
  const modules = new Map(
    manifest.modules.map((item) => [item.module_id, item]),
  );
  const missions = new Map(
    manifest.missions.map((item) => [item.mission_id, item]),
  );
  const activities = new Map(
    manifest.activities.map((item) => [item.activity_id, item]),
  );
  if (
    modules.size !== manifest.modules.length ||
    missions.size !== manifest.missions.length ||
    activities.size !== manifest.activities.length ||
    !unique(manifest.session_options.map((item) => item.option_id)) ||
    manifest.modules.some(
      (item) =>
        !unique(item.mission_ids) ||
        item.mission_ids.some(
          (id) => missions.get(id)?.module_id !== item.module_id,
        ),
    ) ||
    manifest.missions.some(
      (item) =>
        !modules.get(item.module_id)?.mission_ids.includes(item.mission_id) ||
        !unique(item.activity_ids) ||
        item.activity_ids.some(
          (id) => activities.get(id)?.mission_id !== item.mission_id,
        ),
    ) ||
    manifest.activities.some(
      (item) =>
        !missions
          .get(item.mission_id)
          ?.activity_ids.includes(item.activity_id) ||
        !unique(item.presets.map((preset) => preset.preset_id)) ||
        (item.presets.length > 0 &&
          item.presets.filter((preset) => preset.default).length !== 1),
    )
  ) {
    throw new AdultPortalError(
      "Referencias ou padroes do manifesto invalidos.",
      "VALIDATION",
    );
  }
  return manifest;
}
