import { AdultPortalError } from "@/application/adult-portal/errors";
import {
  sessionContentPolicyV1Schema,
  type ContentManifestV1,
  type SessionContentPolicyV1,
} from "@/contracts/v2";

import { validateManifest } from "./manifest";

export type ContentSelection = {
  enabled_module_ids?: string[];
  enabled_mission_ids?: string[];
  activity_presets?: Record<string, string> | null;
  options?: Record<string, boolean | string> | null;
};

function invalid(message: string): never {
  throw new AdultPortalError(message, "VALIDATION");
}

export function resolvePolicy(
  selection: ContentSelection | null,
  manifest: ContentManifestV1,
): SessionContentPolicyV1 {
  const catalog = validateManifest(manifest);
  const parsed = sessionContentPolicyV1Schema.safeParse({
    ...selection,
    policy_version: 1,
    authored_content_version: catalog.content_version,
    enabled_module_ids:
      selection === null
        ? catalog.modules.map((item) => item.module_id)
        : (selection.enabled_module_ids ?? []),
    enabled_mission_ids:
      selection === null
        ? catalog.missions.map((item) => item.mission_id)
        : (selection.enabled_mission_ids ?? []),
  });
  if (!parsed.success) invalid("Selecao de conteudo invalida.");
  const requested = parsed.data;
  const modules = new Set(requested.enabled_module_ids);
  const missions = new Set(requested.enabled_mission_ids);
  if (
    [...modules].some(
      (id) => !catalog.modules.some((item) => item.module_id === id),
    ) ||
    [...missions].some(
      (id) => !catalog.missions.some((item) => item.mission_id === id),
    )
  )
    invalid("Modulo ou missao desconhecido.");
  for (const entry of catalog.modules) {
    if (modules.has(entry.module_id)) {
      for (const id of entry.mission_ids) missions.add(id);
    }
  }
  if (missions.size === 0) invalid("Selecione ao menos uma missao.");

  const presets = new Map<string, string>();
  for (const activity of catalog.activities) {
    if (!missions.has(activity.mission_id)) continue;
    const preset = activity.presets.find((item) => item.default);
    if (preset) presets.set(activity.activity_id, preset.preset_id);
  }
  for (const [id, preset] of Object.entries(requested.activity_presets ?? {})) {
    const activity = catalog.activities.find((item) => item.activity_id === id);
    if (
      !activity ||
      !missions.has(activity.mission_id) ||
      !activity.presets.some((item) => item.preset_id === preset)
    ) {
      invalid("Atividade ou preset desconhecido para a selecao.");
    }
    presets.set(id, preset);
  }
  const options = new Map(
    catalog.session_options.map((item) => [item.option_id, item.default]),
  );
  for (const [id, value] of Object.entries(requested.options ?? {})) {
    if (!options.has(id) || typeof value !== "boolean")
      invalid("Opcao de sessao desconhecida ou invalida.");
    options.set(id, value);
  }
  return sessionContentPolicyV1Schema.parse({
    policy_version: 1,
    authored_content_version: catalog.content_version,
    // Keep only explicitly selected modules. Inferring a parent for one mission
    // would expand it to every mission in that module on the game side.
    enabled_module_ids: catalog.modules
      .filter((item) => modules.has(item.module_id))
      .map((item) => item.module_id),
    enabled_mission_ids: catalog.missions
      .filter((item) => missions.has(item.mission_id))
      .map((item) => item.mission_id),
    activity_presets: Object.fromEntries(presets),
    options: Object.fromEntries(options),
  });
}
