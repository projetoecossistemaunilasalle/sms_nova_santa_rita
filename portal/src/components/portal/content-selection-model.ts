import type { ContentSelection } from "@/application/game-content/policy";
import type { ContentManifestV1, SessionContentPolicyV1 } from "@/contracts/v2";

type Activity = ContentManifestV1["activities"][number];
type Mission = ContentManifestV1["missions"][number];
type Module = ContentManifestV1["modules"][number];

export type ContentModuleModel = Module & {
  missionCount: number;
  missions: (Mission & { activities: Activity[] })[];
};

export type ContentModuleChip = {
  id: string;
  label: string;
  missionCount: number;
};

export type ContentAdjustments = {
  activities: Activity[];
  options: ContentManifestV1["session_options"];
};

export function getContentModules(
  manifest: ContentManifestV1,
): ContentModuleModel[] {
  const missions = new Map(
    manifest.missions.map((item) => [item.mission_id, item]),
  );
  const activities = new Map(
    manifest.activities.map((item) => [item.activity_id, item]),
  );
  return [...manifest.modules]
    .sort((left, right) => left.order - right.order)
    .map((module) => ({
      ...module,
      missionCount: module.mission_ids.length,
      missions: module.mission_ids.flatMap((id) => {
        const mission = missions.get(id);
        return mission
          ? [
              {
                ...mission,
                activities: mission.activity_ids.flatMap((activityId) => {
                  const activity = activities.get(activityId);
                  return activity ? [activity] : [];
                }),
              },
            ]
          : [];
      }),
    }));
}

function selectedMissions(
  manifest: ContentManifestV1,
  selection: ContentSelection | null,
): Mission[] {
  if (selection === null) return manifest.missions;
  const ids = new Set(selection.enabled_mission_ids ?? []);
  for (const contentModule of manifest.modules) {
    if (selection.enabled_module_ids?.includes(contentModule.module_id)) {
      for (const id of contentModule.mission_ids) ids.add(id);
    }
  }
  return manifest.missions.filter((mission) => ids.has(mission.mission_id));
}

function missionText(count: number) {
  return `${count} ${count === 1 ? "missão" : "missões"}`;
}

export function getModuleSelectionState(
  manifest: ContentManifestV1,
  moduleId: string,
  selection: ContentSelection | null,
): "none" | "partial" | "all" {
  const contentModule = manifest.modules.find(
    (item) => item.module_id === moduleId,
  );
  if (!contentModule || contentModule.mission_ids.length === 0) return "none";
  const selected = new Set(
    selectedMissions(manifest, selection).map((item) => item.mission_id),
  );
  const count = contentModule.mission_ids.filter((id) =>
    selected.has(id),
  ).length;
  return count === 0
    ? "none"
    : count === contentModule.mission_ids.length
      ? "all"
      : "partial";
}

export function getContentSelectionSummary(
  manifest: ContentManifestV1 | null,
  selection: ContentSelection | null,
): string {
  if (!manifest) return "Conteúdo indisponível";
  const missions = selectedMissions(manifest, selection);
  if (missions.length === 0) return "Nenhuma missão selecionada";
  if (missions.length === manifest.missions.length) return "Todo o conteúdo";
  const moduleIds = new Set(missions.map((item) => item.module_id));
  const titles = getContentModules(manifest)
    .filter((module) => moduleIds.has(module.module_id))
    .map((module) => module.title);
  return `${titles.join(", ")} · ${missionText(missions.length)}`;
}

export function getContentSelectionLiveSummary(
  manifest: ContentManifestV1,
  selection: ContentSelection | null,
): string {
  const missions = selectedMissions(manifest, selection);
  const activityIds = new Set(missions.flatMap((item) => item.activity_ids));
  return `${missionText(missions.length)} · ${activityIds.size} ${
    activityIds.size === 1 ? "atividade" : "atividades"
  }`;
}

// Always pass the session's frozen manifest, not the currently imported version.
export function getSessionContentChips(
  manifest: ContentManifestV1,
  policy: SessionContentPolicyV1,
): ContentModuleChip[] {
  const missions = selectedMissions(manifest, policy);
  if (missions.length > 0 && missions.length === manifest.missions.length) {
    return [
      { id: "all", label: "Todo o conteúdo", missionCount: missions.length },
    ];
  }
  return getContentModules(manifest).flatMap((module) => {
    const count = missions.filter(
      (item) => item.module_id === module.module_id,
    ).length;
    return count
      ? [{ id: module.module_id, label: module.title, missionCount: count }]
      : [];
  });
}

export function getContentAdjustments(
  manifest: ContentManifestV1,
  selection: ContentSelection | null,
): ContentAdjustments {
  const ids = new Set(
    selectedMissions(manifest, selection).map((item) => item.mission_id),
  );
  return {
    activities: manifest.activities.filter(
      (item) => ids.has(item.mission_id) && item.presets.length > 1,
    ),
    options: manifest.session_options,
  };
}

export function hasContentAdjustments(
  manifest: ContentManifestV1,
  selection: ContentSelection | null,
): boolean {
  const adjustments = getContentAdjustments(manifest, selection);
  return adjustments.activities.length > 0 || adjustments.options.length > 0;
}

export function getSelectedMissionIds(
  manifest: ContentManifestV1,
  selection: ContentSelection | null,
): string[] {
  return selectedMissions(manifest, selection).map((item) => item.mission_id);
}

export type ContentDraft = {
  missionIds: ReadonlySet<string>;
  presets?: Readonly<Record<string, string>>;
  options?: Readonly<Record<string, boolean | string>>;
};

/**
 * Turns the picker state into the selection the actions accept. Returns null
 * ("everything") when all missions are ticked and nothing is adjusted, so a
 * saved class default keeps following the full manifest.
 */
export function buildContentSelection(
  manifest: ContentManifestV1,
  draft: ContentDraft,
): ContentSelection | null {
  const modules = getContentModules(manifest);
  const moduleIds: string[] = [];
  const missionIds: string[] = [];
  for (const contentModule of modules) {
    const ids = contentModule.mission_ids;
    const count = ids.filter((id) => draft.missionIds.has(id)).length;
    if (count === 0) continue;
    if (count === ids.length) moduleIds.push(contentModule.module_id);
    else missionIds.push(...ids.filter((id) => draft.missionIds.has(id)));
  }
  const presets = draft.presets ?? {};
  const options = draft.options ?? {};
  const adjusted =
    Object.keys(presets).length > 0 || Object.keys(options).length > 0;
  const everything =
    manifest.missions.length > 0 &&
    manifest.missions.every((item) => draft.missionIds.has(item.mission_id));
  if (everything && !adjusted) return null;
  return {
    ...(moduleIds.length ? { enabled_module_ids: moduleIds } : {}),
    ...(missionIds.length ? { enabled_mission_ids: missionIds } : {}),
    ...(Object.keys(presets).length
      ? { activity_presets: { ...presets } }
      : {}),
    ...(Object.keys(options).length ? { options: { ...options } } : {}),
  };
}
