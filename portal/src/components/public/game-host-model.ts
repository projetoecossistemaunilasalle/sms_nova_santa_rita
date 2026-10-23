import {
  PROTOCOL_VERSION,
  playerBootstrapV2Schema,
  type GameStateV2,
  type PlayerBootstrapV2,
} from "@/contracts/v2";
import type { PlayerEntryActionResult } from "@/application/player-access/types";
import { createBridgeRequestId } from "./game-bridge";
import type { DemoSnapshotRead } from "./demo-game-state";

export type HostPhase =
  | "connecting"
  | "updating"
  | "waiting"
  | "bootstrapping"
  | "applying"
  | "playing"
  | "saving"
  | "conflict"
  | "error";
export type HostAlert = { tone: "warning" | "error"; message: string } | null;
export type HostSyncState = "synced" | "pending" | "blocked";

export const DEMO_CONTENT_VERSION = "demo-v2";

export function contentErrorRecovery(code: string, alreadyRetried: boolean) {
  if (code === "CONTENT_UPGRADE_REQUIRED") {
    return {
      reload: !alreadyRetried,
      message: alreadyRetried
        ? "Não foi possível atualizar o jogo. Chame o professor para continuar."
        : "Atualizando o jogo. Aguarde um momento.",
    };
  }
  if (code === "POLICY_EMPTY") {
    return {
      reload: false,
      message:
        "O conteúdo escolhido não está disponível nesta versão do jogo. Avise o professor.",
    };
  }
  return null;
}

export function demoStorageKey(playerId: string): string {
  return `caramelito.demo.game-state.v2:${playerId}`;
}

export function newBootstrap(
  playerId: string,
  sessionId: string,
  snapshot: DemoSnapshotRead,
): PlayerBootstrapV2 {
  const saved = snapshot.status === "valid" ? snapshot.snapshot : null;
  return playerBootstrapV2Schema.parse({
    type: "portal.bootstrap.v2",
    request_id: createBridgeRequestId(),
    protocol_version: PROTOCOL_VERSION,
    player_id: playerId,
    class_session_id: sessionId,
    revision: saved?.revision ?? 0,
    new_player: saved === null,
    state: saved?.state ?? null,
    stored_content_version: saved ? DEMO_CONTENT_VERSION : null,
    content_policy: {
      policy_version: 1,
      authored_content_version: DEMO_CONTENT_VERSION,
      enabled_module_ids: ["demo"],
      enabled_mission_ids: ["demo_steps"],
    },
  });
}

export async function readResponseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function errorMessageForEntry(result: PlayerEntryActionResult): string {
  switch (result.state) {
    case "ended":
      return "A sessão da turma foi encerrada. Peça ao profissional para iniciar uma nova sessão.";
    case "expired":
      return "O acesso temporário terminou. Escaneie o QR novamente com a orientação do profissional.";
    case "waiting":
      return "A turma ainda não está jogando. Aguarde a orientação do profissional.";
    default:
      return "Este acesso não está mais disponível. Peça ao profissional um QR atualizado.";
  }
}

export function applyProgressToBootstrap(
  current: PlayerBootstrapV2,
  revision: number,
  state: GameStateV2,
  contentVersion: string,
): PlayerBootstrapV2 {
  return playerBootstrapV2Schema.parse({
    ...current,
    revision,
    new_player: false,
    state,
    stored_content_version: contentVersion,
  });
}
