import type { ActorSnapshot } from "@/application/adult-portal/types";
import type {
  PlayerCredentialStatus,
  RecordStatus,
} from "@/generated/prisma/enums";

import type {
  ClassScope,
  GameSessionDto,
  ParticipationDto,
  PlayerSlotDto,
} from "./types";

export type CredentialMaterial = {
  token: string;
  tokenHash: string;
};

export interface PlayerCredentialIssuer {
  issue(): CredentialMaterial;
}

export interface PlayerCredentialCipher {
  encrypt(token: string, tokenHash: string): string;
  decrypt(encryptedToken: string, tokenHash: string): string;
}

export type NewSlotCredential = {
  tokenHash: string;
  encryptedToken?: string | null;
};

export type StoredPlayerCredential = {
  playerSlotId: string;
  tokenHash: string;
  encryptedToken: string | null;
};

export type ResolvedCredential = {
  id: string;
  status: PlayerCredentialStatus;
  slot: {
    id: string;
    classGroupId: string;
    playerNumber: number;
    status: RecordStatus;
  };
  classGroup: ClassScope;
};

export type ActiveEntryParticipation = {
  session: GameSessionDto;
  participation: ParticipationDto;
};

export interface PlayerAccessReader {
  getActor(profileId: string): Promise<ActorSnapshot | null>;
  getClassScope(classGroupId: string): Promise<ClassScope | null>;
  getSlot(slotId: string): Promise<PlayerSlotDto | null>;
  listSlots(classGroupId: string): Promise<PlayerSlotDto[]>;
  listStoredCredentials(
    classGroupId: string,
  ): Promise<StoredPlayerCredential[]>;
  getActiveSession(classGroupId: string): Promise<GameSessionDto | null>;
  resolveCredential(tokenHash: string): Promise<ResolvedCredential | null>;
}

export interface PlayerAccessTransaction extends PlayerAccessReader {
  allocateSlots(
    classGroupId: string,
    credentials: readonly NewSlotCredential[],
  ): Promise<PlayerSlotDto[]>;
  rotateCredential(
    slotId: string,
    tokenHash: string,
    revokedAt: Date,
    encryptedToken?: string | null,
  ): Promise<PlayerSlotDto>;
  createSession(classGroupId: string, startedAt: Date): Promise<GameSessionDto>;
  endSession(sessionId: string, endedAt: Date): Promise<GameSessionDto>;
  findOrCreateActiveParticipation(
    classGroupId: string,
    playerSlotId: string,
    joinedAt: Date,
  ): Promise<ActiveEntryParticipation | null>;
}

export interface PlayerAccessStore extends PlayerAccessReader {
  transaction<T>(
    work: (transaction: PlayerAccessTransaction) => Promise<T>,
  ): Promise<T>;
}
