import {
  gameStateV2Schema,
  type GameStateV2,
  type StateSaveRequestV2,
} from "@/contracts/v2";

export type DemoGameSnapshot = {
  revision: number;
  state: GameStateV2;
};

export type DemoSnapshotRead =
  | { status: "empty" }
  | { status: "invalid" }
  | { status: "valid"; snapshot: DemoGameSnapshot };

export function readDemoGameSnapshot(raw: string | null): DemoSnapshotRead {
  if (raw === null) return { status: "empty" };

  try {
    const value: unknown = JSON.parse(raw);
    if (
      typeof value !== "object" ||
      value === null ||
      !("revision" in value) ||
      typeof value.revision !== "number" ||
      !Number.isSafeInteger(value.revision) ||
      value.revision < 1 ||
      !("state" in value)
    ) {
      return { status: "invalid" };
    }

    const state = gameStateV2Schema.safeParse(value.state);
    if (!state.success) return { status: "invalid" };

    return {
      status: "valid",
      snapshot: { revision: value.revision, state: state.data },
    };
  } catch {
    return { status: "invalid" };
  }
}

export function initialDemoGameState(): GameStateV2 {
  return { schema_version: 3, demo_steps: 0 };
}

export function advanceDemoGameState(state: GameStateV2): GameStateV2 {
  const steps = typeof state.demo_steps === "number" ? state.demo_steps : 0;
  return gameStateV2Schema.parse({ ...state, demo_steps: steps + 1 });
}

export function saveDemoGameState(
  current: DemoGameSnapshot | null,
  request: StateSaveRequestV2,
):
  | { status: "saved"; snapshot: DemoGameSnapshot }
  | { status: "conflict"; snapshot: DemoGameSnapshot } {
  const currentRevision = current?.revision ?? 0;
  const currentState = current?.state ?? initialDemoGameState();

  if (request.expected_revision !== currentRevision) {
    return {
      status: "conflict",
      snapshot: { revision: currentRevision, state: currentState },
    };
  }

  const snapshot = {
    revision: currentRevision + 1,
    state: gameStateV2Schema.parse(request.state),
  };

  return { status: "saved", snapshot };
}
