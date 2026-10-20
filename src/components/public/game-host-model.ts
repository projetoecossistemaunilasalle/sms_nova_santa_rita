import {
  PROTOCOL_VERSION,
  playerBootstrapV1Schema,
  type GameStateV1,
  type PlayerBootstrapV1,
} from "@/contracts/v1";
import type { PlayerEntryActionResult } from "@/application/player-access/types";
import { createBridgeRequestId } from "./game-bridge";
import type { DemoSnapshotRead } from "./demo-game-state";

export type HostPhase =
  | "connecting"
  | "waiting"
  | "bootstrapping"
  | "applying"
  | "playing"
  | "saving"
  | "conflict"
  | "error";
export type HostAlert = { tone: "warning" | "error"; message: string } | null;
export type HostSyncState = "synced" | "pending" | "blocked";

export function demoStorageKey(playerId: string): string {
  return `caramelito.demo.game-state.v1:${playerId}`;
}

export function newBootstrap(
  playerId: string,
  sessionId: string,
  snapshot: DemoSnapshotRead,
): PlayerBootstrapV1 {
  const saved = snapshot.status === "valid" ? snapshot.snapshot : null;
  return playerBootstrapV1Schema.parse({
    type: "portal.bootstrap.v1",
    request_id: createBridgeRequestId(),
    protocol_version: PROTOCOL_VERSION,
    player_id: playerId,
    class_session_id: sessionId,
    revision: saved?.revision ?? 0,
    new_player: saved === null,
    state: saved?.state ?? null,
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
  current: PlayerBootstrapV1,
  revision: number,
  state: GameStateV1,
): PlayerBootstrapV1 {
  return playerBootstrapV1Schema.parse({
    ...current,
    revision,
    new_player: false,
    state,
  });
}
