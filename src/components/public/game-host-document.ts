import type { PlayerBootstrapV2 } from "@/contracts/v2";
import type { HostPhase } from "./game-host-model";

export type GameHostDocument = {
  generation: number;
  bootstrapStarted: boolean;
  bootstrap: PlayerBootstrapV2 | null;
  branchReady: boolean;
  savedReplies: Map<string, unknown>;
  phase: HostPhase;
};

export type GameHostDocumentEvent =
  | { type: "ready" }
  | { type: "load" }
  | { type: "bootstrap-started" }
  | {
      type: "bootstrap-installed";
      bootstrap: PlayerBootstrapV2;
      generation: number;
    }
  | { type: "bootstrap-applied"; requestId: string };

export function initialGameHostDocument(): GameHostDocument {
  return {
    generation: 0,
    bootstrapStarted: false,
    bootstrap: null,
    branchReady: false,
    savedReplies: new Map(),
    phase: "connecting",
  };
}

export function transitionGameHostDocument(
  state: GameHostDocument,
  event: GameHostDocumentEvent,
): GameHostDocument {
  switch (event.type) {
    case "ready":
      // Ready is emitted once per document, possibly before its load event.
      return {
        ...initialGameHostDocument(),
        generation: state.generation + 1,
        phase: "waiting",
      };
    case "load":
      return state.phase === "connecting"
        ? { ...state, phase: "waiting" }
        : state;
    case "bootstrap-started":
      return { ...state, bootstrapStarted: true, phase: "bootstrapping" };
    case "bootstrap-installed":
      if (event.generation !== state.generation) return state;
      return {
        ...state,
        bootstrap: event.bootstrap,
        branchReady: false,
        phase: "applying",
      };
    case "bootstrap-applied":
      return event.requestId === state.bootstrap?.request_id
        ? { ...state, branchReady: true, phase: "playing" }
        : state;
  }
}
