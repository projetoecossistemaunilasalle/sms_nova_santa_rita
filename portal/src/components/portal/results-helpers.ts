import type { PlayerClassReport } from "@/application/game-events/ports";
import { matchesPlayerNumber } from "./portal-filters";

export type ParticipationFilter = "all" | "recorded" | "none";

export function filterReportPlayers(
  players: PlayerClassReport[],
  query: string,
  participation: ParticipationFilter,
) {
  return players.filter((player) => {
    const hasParticipation = player.participationCount > 0;
    return (
      matchesPlayerNumber(player.playerNumber, query) &&
      (participation === "all" ||
        (participation === "recorded" ? hasParticipation : !hasParticipation))
    );
  });
}

export function formatActiveTime(milliseconds: number) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours} h ${minutes} min`;
  if (minutes > 0) return `${minutes} min ${seconds} s`;
  return `${seconds} s`;
}

export const MODULE_PARAM = "modulo";
export const UNATTRIBUTED_MODULE_LABEL = "Sem módulo (jogo livre)";

const MODULE_ID_PATTERN = /^[a-z0-9_]{1,64}$/;

/** Reads the `modulo` search param; anything that is not a stable id means "all". */
export function parseModuleParam(
  value: string | string[] | null | undefined,
): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  return first && MODULE_ID_PATTERN.test(first) ? first : undefined;
}

export type ResultsModuleOption = { id: string; label: string };

/**
 * Filter options: every manifest module in manifest order, then any module
 * that only appears in the totals (older manifest versions), labelled by id.
 */
export function buildModuleOptions(
  manifestModules: readonly { id: string; label: string }[],
  totals: readonly { moduleId: string | null }[],
  selectedModuleId?: string,
): ResultsModuleOption[] {
  const options = new Map(manifestModules.map((item) => [item.id, item.label]));
  for (const total of totals) {
    if (total.moduleId && !options.has(total.moduleId)) {
      options.set(total.moduleId, total.moduleId);
    }
  }
  if (selectedModuleId && !options.has(selectedModuleId)) {
    options.set(selectedModuleId, selectedModuleId);
  }
  return [...options].map(([id, label]) => ({ id, label }));
}

export type ModuleTotalRow = {
  key: string;
  label: string;
  totalActiveMs: number;
  resultCount: number;
};

export function mapModuleTotals(
  totals: readonly {
    moduleId: string | null;
    totalActiveMs: number;
    resultCount: number;
  }[],
  options: readonly ResultsModuleOption[],
): ModuleTotalRow[] {
  const labels = new Map(options.map((item) => [item.id, item.label]));
  const order = new Map(options.map((item, index) => [item.id, index]));
  const rank = (moduleId: string | null) =>
    moduleId ? (order.get(moduleId) ?? options.length) : options.length + 1;
  return [...totals]
    .sort((left, right) => rank(left.moduleId) - rank(right.moduleId))
    .map((total) => ({
      key: total.moduleId ?? "sem-modulo",
      label: total.moduleId
        ? (labels.get(total.moduleId) ?? total.moduleId)
        : UNATTRIBUTED_MODULE_LABEL,
      totalActiveMs: total.totalActiveMs,
      resultCount: total.resultCount,
    }));
}

export function resultsHref(path: string, moduleId?: string) {
  return moduleId ? `${path}?${MODULE_PARAM}=${moduleId}` : path;
}

const METRIC_NOTES: Record<string, string> = {
  situacoes_classificadas:
    "Conta as cartas que o jogador posicionou; não indica se a classificação estava correta.",
};

export function metricLabel(key: string, labels: Record<string, string>) {
  return labels[key] ?? key.replaceAll("_", " ");
}

export function metricNote(key: string) {
  return METRIC_NOTES[key];
}
