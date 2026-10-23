// Demo-only game events for the seeded participation. The module of each event
// is derived from its mission through the committed fixture manifest, never
// stored, so the demo cannot drift from the content manifest.
export type DemoActiveTimeEvent = {
  participationId: string;
  missionId: string;
  activeMs: number;
};

export type DemoResultEvent = {
  id: string;
  participationId: string;
  activityId: string;
  missionId: string;
  attemptId: string;
  state: string;
  durationMs: number;
  receivedAt: string;
};

export type DemoGameEvents = {
  activeTimeEvents: readonly DemoActiveTimeEvent[];
  resultEvents: readonly DemoResultEvent[];
};

const PARTICIPATION_ID = "demo-participation-third-a-01-ended";

export const demoGameEvents: DemoGameEvents = {
  activeTimeEvents: [
    {
      participationId: PARTICIPATION_ID,
      missionId: "lia_memory",
      activeMs: 120_000,
    },
    {
      participationId: PARTICIPATION_ID,
      missionId: "pingpong_soccer",
      activeMs: 90_000,
    },
    {
      participationId: PARTICIPATION_ID,
      missionId: "brushing_teeth",
      activeMs: 60_000,
    },
  ],
  resultEvents: [
    {
      id: "demo-result-third-a-01-lia",
      participationId: PARTICIPATION_ID,
      activityId: "lia_memory",
      missionId: "lia_memory",
      attemptId: "demo-attempt-lia-1",
      state: "completed",
      durationMs: 110_000,
      receivedAt: "2026-09-18T13:10:00.000Z",
    },
    {
      id: "demo-result-third-a-01-brushing",
      participationId: PARTICIPATION_ID,
      activityId: "brushing_teeth_practice",
      missionId: "brushing_teeth",
      attemptId: "demo-attempt-brushing-1",
      state: "completed",
      durationMs: 55_000,
      receivedAt: "2026-09-18T13:20:00.000Z",
    },
  ],
};
