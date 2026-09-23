import {
  gameStateV1Schema,
  type GameStateV1,
  type StateSaveRequestV1,
} from "@/contracts/v1";

export type DemoGameSnapshot = {
  revision: number;
  state: GameStateV1;
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

    const state = gameStateV1Schema.safeParse(value.state);
    if (!state.success) return { status: "invalid" };

    return {
      status: "valid",
      snapshot: { revision: value.revision, state: state.data },
    };
  } catch {
    return { status: "invalid" };
  }
}

export function initialDemoGameState(): GameStateV1 {
  const missions = {
    when_play_stops_being_play: "available",
    lia_memory: "available",
    pingpong_soccer: "available",
    respect_also_cares: "available",
  } as const;

  return {
    schema_version: 1,
    content_version: "heroes_trial_school_v1",
    missions: {
      when_play_stops_being_play: {
        status: missions.when_play_stops_being_play,
        stage_id: "demo_entry",
        checkpoints: {},
        data: { demo_steps: 0 },
      },
      lia_memory: {
        status: missions.lia_memory,
        stage_id: "demo_entry",
        checkpoints: {},
        data: {},
      },
      pingpong_soccer: {
        status: missions.pingpong_soccer,
        stage_id: "demo_entry",
        checkpoints: {},
        data: {},
      },
      respect_also_cares: {
        status: missions.respect_also_cares,
        stage_id: "demo_entry",
        checkpoints: {},
        data: {},
      },
    },
    progression: {
      coins: 0,
      stars: 0,
      challenges: {},
      rewards: {},
    },
  };
}

export function advanceDemoGameState(state: GameStateV1): GameStateV1 {
  const current = state.missions.when_play_stops_being_play.data.demo_steps;
  const steps = typeof current === "number" ? current : 0;

  return gameStateV1Schema.parse({
    ...state,
    missions: {
      ...state.missions,
      when_play_stops_being_play: {
        ...state.missions.when_play_stops_being_play,
        data: {
          ...state.missions.when_play_stops_being_play.data,
          demo_steps: steps + 1,
        },
      },
    },
  });
}

export function saveDemoGameState(
  current: DemoGameSnapshot | null,
  request: StateSaveRequestV1,
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
    state: gameStateV1Schema.parse(request.state),
  };

  return { status: "saved", snapshot };
}
