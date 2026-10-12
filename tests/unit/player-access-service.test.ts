import { describe, expect, it } from "vitest";

import type { ActorSnapshot } from "@/application/adult-portal/types";
import type {
  NewSlotCredential,
  PlayerAccessStore,
  PlayerAccessTransaction,
  PlayerCredentialIssuer,
  PlayerCredentialCipher,
  ResolvedCredential,
} from "@/application/player-access/ports";
import { PlayerAccessService } from "@/application/player-access/service";
import type {
  ClassScope,
  GameSessionDto,
  ParticipationDto,
  PlayerSlotDto,
} from "@/application/player-access/types";
import {
  GameSessionStatus,
  OrganizationRole,
  PlayerCredentialStatus,
  RecordStatus,
} from "@/generated/prisma/enums";

const classGroup: ClassScope = {
  id: "class-a",
  organizationId: "organization-a",
  organizationStatus: RecordStatus.ACTIVE,
  status: RecordStatus.ACTIVE,
};

function actor(overrides: Partial<ActorSnapshot> = {}): ActorSnapshot {
  return {
    profileId: "teacher-a",
    displayName: "Teacher",
    profileStatus: RecordStatus.ACTIVE,
    platformRole: null,
    memberships: [
      {
        id: "membership-a",
        organizationId: classGroup.organizationId,
        organizationName: "Organization",
        organizationStatus: RecordStatus.ACTIVE,
        role: OrganizationRole.TEACHER,
        status: RecordStatus.ACTIVE,
        teacherAssignments: [
          {
            id: "assignment-a",
            classGroupId: classGroup.id,
            status: RecordStatus.ACTIVE,
          },
        ],
      },
    ],
    ...overrides,
  };
}

class FakeCredentialIssuer implements PlayerCredentialIssuer {
  next = 0;
  issue() {
    this.next += 1;
    return { token: `token-${this.next}`, tokenHash: `hash-${this.next}` };
  }
}

const fakeCipher: PlayerCredentialCipher = {
  encrypt: (token) => `encrypted:${token}`,
  decrypt: (encryptedToken) => encryptedToken.slice("encrypted:".length),
};

class FakePlayerAccessStore
  implements PlayerAccessStore, PlayerAccessTransaction
{
  actors = new Map<string, ActorSnapshot>([["teacher-a", actor()]]);
  classes = new Map<string, ClassScope>([[classGroup.id, classGroup]]);
  slots: PlayerSlotDto[] = [];
  credentials: Array<{
    slotId: string;
    hash: string;
    encryptedToken?: string | null;
    status: PlayerCredentialStatus;
  }> = [];
  revokeCredentialBeforeNextResolve = false;
  sessions: GameSessionDto[] = [];
  participations: ParticipationDto[] = [];
  nextPlayerNumber = 1;

  async transaction<T>(
    work: (transaction: PlayerAccessTransaction) => Promise<T>,
  ) {
    return work(this);
  }

  async getActor(profileId: string) {
    return this.actors.get(profileId) ?? null;
  }

  async getClassScope(classGroupId: string) {
    return this.classes.get(classGroupId) ?? null;
  }

  async getSlot(slotId: string) {
    return this.slots.find((slot) => slot.id === slotId) ?? null;
  }

  async listSlots(classGroupId: string) {
    return this.slots.filter((slot) => slot.classGroupId === classGroupId);
  }

  async listStoredCredentials(classGroupId: string) {
    const slots = await this.listSlots(classGroupId);
    return this.credentials
      .filter(
        (credential) =>
          credential.status === PlayerCredentialStatus.ACTIVE &&
          slots.some(
            (slot) =>
              slot.id === credential.slotId &&
              slot.status === RecordStatus.ACTIVE,
          ),
      )
      .map((credential) => ({
        playerSlotId: credential.slotId,
        tokenHash: credential.hash,
        encryptedToken: credential.encryptedToken ?? null,
      }));
  }

  async getActiveSession(classGroupId: string) {
    return (
      this.sessions.find(
        (session) =>
          session.classGroupId === classGroupId &&
          session.status === GameSessionStatus.ACTIVE,
      ) ?? null
    );
  }

  async resolveCredential(
    tokenHash: string,
  ): Promise<ResolvedCredential | null> {
    const credential = this.credentials.find((item) => item.hash === tokenHash);
    if (!credential) return null;
    if (this.revokeCredentialBeforeNextResolve) {
      credential.status = PlayerCredentialStatus.REVOKED;
      this.revokeCredentialBeforeNextResolve = false;
    }
    const slot = this.slots.find((item) => item.id === credential.slotId)!;
    return {
      id: `credential-${this.credentials.indexOf(credential) + 1}`,
      status: credential.status,
      slot: {
        id: slot.id,
        classGroupId: slot.classGroupId,
        playerNumber: slot.playerNumber,
        status: slot.status,
      },
      classGroup: this.classes.get(slot.classGroupId)!,
    };
  }

  async allocateSlots(
    classGroupId: string,
    credentials: readonly NewSlotCredential[],
  ) {
    return credentials.map(({ tokenHash, encryptedToken }) => {
      const playerNumber = this.nextPlayerNumber++;
      const slot: PlayerSlotDto = {
        id: `slot-${playerNumber}`,
        classGroupId,
        playerNumber,
        status: RecordStatus.ACTIVE,
        credentialId: `credential-${playerNumber}`,
        credentialStatus: PlayerCredentialStatus.ACTIVE,
      };
      this.slots.push(slot);
      this.credentials.push({
        slotId: slot.id,
        hash: tokenHash,
        encryptedToken,
        status: PlayerCredentialStatus.ACTIVE,
      });
      return slot;
    });
  }

  async rotateCredential(
    slotId: string,
    tokenHash: string,
    _revokedAt: Date,
    encryptedToken: string | null = null,
  ) {
    for (const credential of this.credentials) {
      if (credential.slotId === slotId) {
        credential.status = PlayerCredentialStatus.REVOKED;
        credential.encryptedToken = null;
      }
    }
    this.credentials.push({
      slotId,
      hash: tokenHash,
      encryptedToken,
      status: PlayerCredentialStatus.ACTIVE,
    });
    const slot = (await this.getSlot(slotId))!;
    return {
      ...slot,
      credentialId: `credential-${this.credentials.length}`,
      credentialStatus: PlayerCredentialStatus.ACTIVE,
    };
  }

  async createSession(classGroupId: string, startedAt: Date) {
    const session: GameSessionDto = {
      id: `session-${this.sessions.length + 1}`,
      classGroupId,
      status: GameSessionStatus.ACTIVE,
      startedAt,
      endedAt: null,
    };
    this.sessions.push(session);
    return session;
  }

  async endSession(sessionId: string, endedAt: Date) {
    const session = this.sessions.find((item) => item.id === sessionId)!;
    session.status = GameSessionStatus.ENDED;
    session.endedAt = endedAt;
    return session;
  }

  endActiveSessionBeforeJoin = false;

  async findOrCreateActiveParticipation(
    classGroupId: string,
    playerSlotId: string,
    joinedAt: Date,
  ) {
    if (this.endActiveSessionBeforeJoin) {
      const activeSession = await this.getActiveSession(classGroupId);
      if (activeSession) {
        activeSession.status = GameSessionStatus.ENDED;
        activeSession.endedAt = joinedAt;
      }
      this.endActiveSessionBeforeJoin = false;
    }
    const session = await this.getActiveSession(classGroupId);
    if (!session) return null;

    const existing = this.participations.find(
      (item) =>
        item.gameSessionId === session.id && item.playerSlotId === playerSlotId,
    );
    if (existing) return { session, participation: existing };
    const participation = {
      id: `participation-${this.participations.length + 1}`,
      gameSessionId: session.id,
      playerSlotId,
      joinedAt,
    };
    this.participations.push(participation);
    return { session, participation };
  }
}

function setup() {
  const store = new FakePlayerAccessStore();
  return {
    store,
    service: new PlayerAccessService(
      store,
      new FakeCredentialIssuer(),
      fakeCipher,
      () => new Date("2026-09-22T12:00:00.000Z"),
    ),
  };
}

describe("PlayerAccessService", () => {
  it("reopens the same credentials across service instances without any mutation", async () => {
    const { service, store } = setup();
    const issued = await service.allocateSlots("teacher-a", classGroup.id, 2);
    await service.startSession("teacher-a", classGroup.id);
    await service.endSession("teacher-a", classGroup.id);
    const before = structuredClone(store.credentials);
    const reopenedService = new PlayerAccessService(
      store,
      new FakeCredentialIssuer(),
      fakeCipher,
    );
    const expected = {
      issuedCredentials: issued.map((slot) => ({
        playerSlotId: slot.id,
        playerNumber: slot.playerNumber,
        token: slot.credential,
      })),
      unavailablePlayerNumbers: [],
    };
    await expect(
      reopenedService.getClassCredentials("teacher-a", classGroup.id),
    ).resolves.toEqual(expected);
    await expect(
      reopenedService.getClassCredentials("teacher-a", classGroup.id),
    ).resolves.toEqual(expected);
    expect(store.credentials).toEqual(before);
    expect(store.nextPlayerNumber).toBe(3);
    await expect(service.resolveEntry("hash-1")).resolves.toMatchObject({
      state: "waiting",
    });
  });

  it("reports legacy or missing credentials without rotating them and excludes inactive players", async () => {
    const { service, store } = setup();
    await service.allocateSlots("teacher-a", classGroup.id, 4);
    store.credentials[0]!.encryptedToken = null;
    store.slots[1]!.status = RecordStatus.INACTIVE;
    store.slots[2]!.credentialStatus = null;
    store.credentials[2]!.status = PlayerCredentialStatus.REVOKED;
    const before = structuredClone(store.credentials);
    await expect(
      service.getClassCredentials("teacher-a", classGroup.id),
    ).resolves.toEqual({
      issuedCredentials: [
        { playerSlotId: "slot-4", playerNumber: 4, token: "token-4" },
      ],
      unavailablePlayerNumbers: [1, 3],
    });
    expect(store.credentials).toEqual(before);
    await expect(service.resolveEntry("hash-1")).resolves.toMatchObject({
      state: "waiting",
    });
  });

  it("only reopens the replacement token after an explicit rotation", async () => {
    const { service, store } = setup();
    const [slot] = await service.allocateSlots("teacher-a", classGroup.id, 1);
    await service.rotateCredential("teacher-a", slot!.id);
    await expect(
      service.getClassCredentials("teacher-a", classGroup.id),
    ).resolves.toEqual({
      issuedCredentials: [
        { playerSlotId: slot!.id, playerNumber: 1, token: "token-2" },
      ],
      unavailablePlayerNumbers: [],
    });
    expect(store.credentials[0]!.encryptedToken).toBeNull();
  });

  it("blocks QR disclosure for unauthorized, unassigned, cross-organization and inactive actors", async () => {
    const { service, store } = setup();
    await service.allocateSlots("teacher-a", classGroup.id, 1);
    await expect(
      service.getClassCredentials("unknown", classGroup.id),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    for (const change of [
      (profile: ActorSnapshot) => {
        profile.profileStatus = RecordStatus.INACTIVE;
      },
      (profile: ActorSnapshot) => {
        profile.memberships[0]!.teacherAssignments = [];
      },
      (profile: ActorSnapshot) => {
        profile.memberships[0]!.organizationId = "other-organization";
      },
      (profile: ActorSnapshot) => {
        profile.memberships[0]!.status = RecordStatus.INACTIVE;
      },
    ]) {
      const profile = actor();
      change(profile);
      store.actors.set("teacher-a", profile);
      await expect(
        service.getClassCredentials("teacher-a", classGroup.id),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    store.actors.set("teacher-a", actor());
    store.classes.set(classGroup.id, {
      ...classGroup,
      status: RecordStatus.INACTIVE,
    });
    await expect(
      service.getClassCredentials("teacher-a", classGroup.id),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    store.classes.set(classGroup.id, {
      ...classGroup,
      organizationStatus: RecordStatus.INACTIVE,
    });
    await expect(
      service.getClassCredentials("teacher-a", classGroup.id),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("keeps tokens and ciphertext out of the ordinary class workflow", async () => {
    const { service } = setup();
    await service.allocateSlots("teacher-a", classGroup.id, 1);
    const workflow = await service.getClassWorkflow("teacher-a", classGroup.id);
    expect(JSON.stringify(workflow)).not.toContain("token-1");
    expect(JSON.stringify(workflow)).not.toContain("encryptedToken");
  });

  it("allocates monotonically numbered slots", async () => {
    const { service, store } = setup();
    await service.allocateSlots("teacher-a", classGroup.id, 2);
    store.slots[0]!.status = RecordStatus.ARCHIVED;
    const additional = await service.allocateSlots(
      "teacher-a",
      classGroup.id,
      1,
    );
    expect(additional[0]).toMatchObject({
      playerNumber: 3,
      credential: "token-3",
    });
  });

  it("enforces class scope and all inactive authorization boundaries", async () => {
    const { service, store } = setup();
    await expect(
      service.allocateSlots("unknown", classGroup.id, 1),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    store.actors.set(
      "teacher-a",
      actor({ profileStatus: RecordStatus.INACTIVE }),
    );
    await expect(
      service.startSession("teacher-a", classGroup.id),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    store.actors.set("teacher-a", actor());
    store.actors.get("teacher-a")!.memberships[0]!.status =
      RecordStatus.INACTIVE;
    await expect(
      service.startSession("teacher-a", classGroup.id),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    store.actors.set("teacher-a", actor());
    store.actors.get(
      "teacher-a",
    )!.memberships[0]!.teacherAssignments[0]!.status = RecordStatus.INACTIVE;
    await expect(
      service.startSession("teacher-a", classGroup.id),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    store.actors.set("teacher-a", actor());
    store.classes.set(classGroup.id, {
      ...classGroup,
      organizationStatus: RecordStatus.INACTIVE,
    });
    await expect(
      service.startSession("teacher-a", classGroup.id),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    store.classes.set(classGroup.id, {
      ...classGroup,
      status: RecordStatus.INACTIVE,
    });
    await expect(
      service.startSession("teacher-a", classGroup.id),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows an active organization administrator in the same organization", async () => {
    const { service, store } = setup();
    const admin = actor({ profileId: "admin-a" });
    admin.memberships[0]!.role = OrganizationRole.ORGANIZATION_ADMIN;
    admin.memberships[0]!.teacherAssignments = [];
    store.actors.set(admin.profileId, admin);
    await expect(
      service.allocateSlots(admin.profileId, classGroup.id, 1),
    ).resolves.toHaveLength(1);
  });

  it("revokes the previous credential when rotating", async () => {
    const { service } = setup();
    const [slot] = await service.allocateSlots("teacher-a", classGroup.id, 1);
    await service.rotateCredential("teacher-a", slot!.id);
    await expect(service.resolveEntry("hash-1")).resolves.toEqual({
      state: "revoked",
    });
    await expect(service.resolveEntry("hash-2")).resolves.toMatchObject({
      state: "waiting",
    });
  });

  it("enforces one active session and distinguishes waiting from ready", async () => {
    const { service } = setup();
    await service.allocateSlots("teacher-a", classGroup.id, 1);
    await expect(service.resolveEntry("hash-1")).resolves.toMatchObject({
      state: "waiting",
    });
    await service.startSession("teacher-a", classGroup.id);
    await expect(
      service.startSession("teacher-a", classGroup.id),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(service.resolveEntry("hash-1")).resolves.toMatchObject({
      state: "ready",
      gameSessionId: "session-1",
    });
  });

  it("creates participation idempotently for repeated entry", async () => {
    const { service, store } = setup();
    await service.allocateSlots("teacher-a", classGroup.id, 1);
    await service.startSession("teacher-a", classGroup.id);
    const first = await service.resolveEntry("hash-1");
    const second = await service.resolveEntry("hash-1");
    expect(second).toEqual(first);
    expect(store.participations).toHaveLength(1);
  });

  it("does not join a session ended before the atomic entry operation", async () => {
    const { service, store } = setup();
    await service.allocateSlots("teacher-a", classGroup.id, 1);
    await service.startSession("teacher-a", classGroup.id);
    store.endActiveSessionBeforeJoin = true;

    await expect(service.resolveEntry("hash-1")).resolves.toMatchObject({
      state: "waiting",
    });
    expect(store.participations).toHaveLength(0);
  });

  it("returns revoked when credential rotation wins before the locked read", async () => {
    const { service, store } = setup();
    await service.allocateSlots("teacher-a", classGroup.id, 1);
    await service.startSession("teacher-a", classGroup.id);
    store.revokeCredentialBeforeNextResolve = true;

    await expect(service.resolveEntry("hash-1")).resolves.toEqual({
      state: "revoked",
    });
    expect(store.participations).toHaveLength(0);
  });
});
