import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  GameStateService,
  type GameStateTransaction,
  type StoredGameState,
} from "@/application/game-state/service";
import { GameEventService } from "@/application/game-events/service";
import type { GameEventTransaction } from "@/application/game-events/ports";
import {
  parsePlayerBootstrapV2,
  parseStateSaveRequestV2,
  parseStateSaveConflictV2,
  parseResultEventV2,
  parseActiveTimeBatchV2,
  parseContentManifestV1,
} from "@/contracts/v2";
import {
  GameSessionStatus,
  PlayerCredentialStatus,
  RecordStatus,
} from "@/generated/prisma/enums";
import {
  createLaunchToken,
  verifyLaunchToken,
} from "@/server/security/launch-token";
import { HttpError } from "@/server/http/errors";

const mocks = vi.hoisted(() => ({
  state: vi.fn(),
  events: vi.fn(),
  limit: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/server/services/game-state-container", () => ({
  getGameStateService: mocks.state,
}));
vi.mock("@/server/services/game-event-container", () => ({
  getGameEventService: mocks.events,
}));
vi.mock("@/server/security/rate-limit", () => ({
  enforcePlayerRateLimit: mocks.limit,
}));
vi.mock("@/server/observability/logger", () => ({
  logger: {
    child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
    warn: vi.fn(),
  },
}));

import { POST as bootstrap } from "@/app/api/v2/player/bootstrap/route";
import { POST as save } from "@/app/api/v2/player/state/route";
import { POST as result } from "@/app/api/v2/player/results/route";
import { POST as activeTime } from "@/app/api/v2/player/active-time/route";

const fixture = (name: string) =>
  JSON.parse(
    readFileSync(
      resolve("contracts/fixtures/v2/valid", `${name}.json`),
      "utf8",
    ),
  );
const returning = parsePlayerBootstrapV2(fixture("returning-player-bootstrap"));
const fresh = parsePlayerBootstrapV2(fixture("new-player-bootstrap"));
const requestSave = parseStateSaveRequestV2(fixture("state-save-request"));
const conflict = parseStateSaveConflictV2(fixture("stale-revision-conflict"));
const context = {
  credentialId: "fixture-credential",
  participationId: "fixture-participation",
  playerSlotId: returning.player_id,
  gameSessionId: returning.class_session_id,
};
const secret = "route-test-only-placeholder-secret-not-for-production";
const token = createLaunchToken(context, secret);
let current: StoredGameState | null;
let stateTransaction: GameStateTransaction;
let eventTransaction: GameEventTransaction;

function request(
  path: string,
  body: unknown,
  authorization = `Bearer ${token}`,
) {
  return new NextRequest(`http://localhost/api/v2/player/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authorization,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.limit.mockReset();
  current = null;
  const scope = {
    ...context,
    credentialStatus: PlayerCredentialStatus.ACTIVE,
    playerStatus: RecordStatus.ACTIVE,
    classStatus: RecordStatus.ACTIVE,
    organizationStatus: RecordStatus.ACTIVE,
    sessionStatus: GameSessionStatus.ACTIVE,
  };
  stateTransaction = {
    getLaunchScope: async () => ({
      ...scope,
      contentPolicy: returning.content_policy,
    }),
    getState: async () => current,
    createState: async (_id, state, contentVersion) => {
      current = { revision: 1, state, contentVersion };
      return true;
    },
    updateState: async (_id, revision, state, contentVersion) => {
      if (current?.revision !== revision) return false;
      current = { revision: revision + 1, state, contentVersion };
      return true;
    },
  };
  eventTransaction = {
    getLaunchScope: async () => ({
      ...scope,
      contentManifest: parseContentManifestV1(fixture("content-manifest")),
    }),
    acceptResult: vi.fn(),
    acceptActiveTime: vi.fn(),
  };
  const verify = (value: string) => verifyLaunchToken(value, secret);
  mocks.state.mockReturnValue(
    new GameStateService(
      { transaction: (work) => work(stateTransaction) },
      verify,
    ),
  );
  mocks.events.mockReturnValue(
    new GameEventService(
      { transaction: (work) => work(eventTransaction) },
      verify,
    ),
  );
});

describe("V2 player fixture API round trips", () => {
  it("returns exact new/returning bootstraps including the frozen policy and content version", async () => {
    const response = await bootstrap(
      request("bootstrap", { request_id: fresh.request_id }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(fresh);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-correlation-id")).toBeTruthy();
    if (returning.new_player) throw new Error("Returning fixture required");
    current = {
      revision: returning.revision,
      state: returning.state,
      contentVersion: returning.stored_content_version,
    };
    expect(
      await (
        await bootstrap(
          request("bootstrap", { request_id: returning.request_id }),
        )
      ).json(),
    ).toEqual(returning);
    expect(mocks.limit).toHaveBeenCalledTimes(2);
  });

  it("persists the save fixture and returns exact success and conflict fixtures", async () => {
    current = {
      revision: requestSave.expected_revision,
      state: requestSave.state,
      contentVersion: requestSave.content_version,
    };
    const response = await save(request("state", requestSave));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(fixture("accepted-save"));
    expect(current).toEqual({
      revision: 8,
      state: requestSave.state,
      contentVersion: requestSave.content_version,
    });
    current = {
      revision: conflict.revision,
      state: conflict.state,
      contentVersion: conflict.stored_content_version,
    };
    const rejected = await save(request("state", requestSave));
    expect(rejected.status).toBe(409);
    expect(await rejected.json()).toEqual(conflict);
  });

  it.each([
    "result-lia-memory",
    "result-pingpong-defense",
    "result-comfort-traffic-light",
    "result-brushing-teeth-practice",
    "result-smile-kit-selection",
  ])("ingests %s without changing the game-owned payload", async (name) => {
    const event = parseResultEventV2(fixture(name));
    const response = await result(request("results", event));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ...fixture("result-acknowledgement"),
      client_event_id: event.client_event_id,
    });
    expect(eventTransaction.acceptResult).toHaveBeenCalledWith(
      context.participationId,
      event,
      expect.any(String),
    );
  });

  it("ingests the active-time fixture and returns its exact acknowledgement", async () => {
    const batch = parseActiveTimeBatchV2(fixture("active-time-batch"));
    const response = await activeTime(request("active-time", batch));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      fixture("active-time-acknowledgement"),
    );
    expect(eventTransaction.acceptActiveTime).toHaveBeenCalledWith(
      context.participationId,
      batch,
      expect.any(Map),
    );
  });

  it.each([
    ["bootstrap", bootstrap],
    ["state", save],
    ["results", result],
    ["active-time", activeTime],
  ] as const)(
    "keeps auth, validation, body limits and rate limits on %s",
    async (path, handler) => {
      expect((await handler(request(path, {}, ""))).status).toBe(401);
      expect((await handler(request(path, {}))).status).toBe(400);
      expect(
        (await handler(request(path, { padding: "x".repeat(300_001) }))).status,
      ).toBe(413);
      mocks.limit.mockRejectedValueOnce(
        new HttpError(429, "RATE_LIMITED", "Try later."),
      );
      expect((await handler(request(path, {}))).status).toBe(429);
      expect(mocks.limit).toHaveBeenCalledTimes(4);
    },
  );
});
