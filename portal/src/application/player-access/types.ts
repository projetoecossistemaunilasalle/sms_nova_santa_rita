import type {
  GameSessionStatus,
  PlayerCredentialStatus,
  RecordStatus,
} from "@/generated/prisma/enums";
import type { ContentSelection } from "@/application/game-content/policy";
import type { SessionContentPolicyV1 } from "@/contracts/v2";

export type SessionContentSnapshot = {
  contentManifestId: string;
  contentPolicy: SessionContentPolicyV1;
  startedById: string | null;
};

export type ClassScope = {
  id: string;
  organizationId: string;
  organizationStatus: RecordStatus;
  status: RecordStatus;
  defaultContentSelection?: ContentSelection | null;
};

export type PlayerSlotDto = {
  id: string;
  classGroupId: string;
  playerNumber: number;
  status: RecordStatus;
  credentialId: string | null;
  credentialStatus: PlayerCredentialStatus | null;
};

export type IssuedPlayerSlotDto = PlayerSlotDto & { credential: string };

export type GameSessionDto = SessionContentSnapshot & {
  id: string;
  classGroupId: string;
  status: GameSessionStatus;
  startedAt: Date;
  endedAt: Date | null;
};

export type ParticipationDto = {
  id: string;
  gameSessionId: string;
  playerSlotId: string;
  joinedAt: Date;
};

export type ClassWorkflowDto = {
  slots: PlayerSlotDto[];
  activeSession: GameSessionDto | null;
};

export type IssuedCredentialDto = {
  playerSlotId: string;
  playerNumber: number;
  token: string;
};

export type PlayerAccessActionResult = {
  ok: boolean;
  message: string;
  issuedCredentials?: IssuedCredentialDto[];
  unavailablePlayerNumbers?: number[];
  fieldErrors?: Record<string, string[]>;
};

export type PlayerEntryResult =
  | { state: "invalid" }
  | { state: "revoked" }
  | { state: "inactive" }
  | {
      state: "waiting";
      classGroupId: string;
      playerSlotId: string;
      playerNumber: number;
    }
  | {
      state: "ready";
      classGroupId: string;
      credentialId: string;
      playerSlotId: string;
      playerNumber: number;
      gameSessionId: string;
      participationId: string;
    }
  | { state: "ended" }
  | { state: "unauthorized" };

export type PlayerEntryActionResult =
  | Exclude<PlayerEntryResult, { state: "ready" }>
  | (Extract<PlayerEntryResult, { state: "ready" }> & {
      launchToken: string;
      expiresAt: string;
    })
  | { state: "expired" };
