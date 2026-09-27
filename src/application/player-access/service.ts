import { PlayerCredentialStatus, RecordStatus } from "@/generated/prisma/enums";
import { canAccessClass } from "@/server/authorization/v1-policy";
import { AdultPortalError } from "@/application/adult-portal/errors";
import { toAuthorizationActor } from "@/application/authorization/authorization-actor";

import type {
  PlayerAccessReader,
  PlayerAccessStore,
  PlayerAccessTransaction,
  PlayerCredentialIssuer,
} from "./ports";
import type { ClassScope, IssuedPlayerSlotDto } from "./types";

function fail(
  code: "FORBIDDEN" | "NOT_FOUND" | "CONFLICT",
  message: string,
): never {
  throw new AdultPortalError(message, code);
}

export class PlayerAccessService {
  constructor(
    private readonly store: PlayerAccessStore,
    private readonly credentials: PlayerCredentialIssuer,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private async requireClassAccess(
    profileId: string,
    classGroupId: string,
    reader: PlayerAccessReader,
  ): Promise<ClassScope> {
    const [actor, classGroup] = await Promise.all([
      reader.getActor(profileId),
      reader.getClassScope(classGroupId),
    ]);
    if (!actor || actor.profileStatus !== RecordStatus.ACTIVE) {
      return fail("FORBIDDEN", "Perfil profissional sem acesso operacional.");
    }
    if (!classGroup) return fail("NOT_FOUND", "Turma não encontrada.");
    if (
      classGroup.organizationStatus !== RecordStatus.ACTIVE ||
      !canAccessClass(toAuthorizationActor(actor), classGroup)
    ) {
      return fail("FORBIDDEN", "Você não pode operar esta turma.");
    }
    return classGroup;
  }

  async getClassWorkflow(profileId: string, classGroupId: string) {
    await this.requireClassAccess(profileId, classGroupId, this.store);
    const [slots, activeSession] = await Promise.all([
      this.store.listSlots(classGroupId),
      this.store.getActiveSession(classGroupId),
    ]);
    return { slots, activeSession };
  }

  async allocateSlots(
    profileId: string,
    classGroupId: string,
    count: number,
  ): Promise<IssuedPlayerSlotDto[]> {
    if (!Number.isInteger(count) || count < 1 || count > 100) {
      throw new AdultPortalError("Informe de 1 a 100 jogadores.", "VALIDATION");
    }
    const issued = Array.from({ length: count }, () =>
      this.credentials.issue(),
    );
    return this.store.transaction(async (transaction) => {
      await this.requireClassAccess(profileId, classGroupId, transaction);
      const slots = await transaction.allocateSlots(
        classGroupId,
        issued.map(({ tokenHash }) => ({ tokenHash })),
      );
      return slots.map((slot, index) => ({
        ...slot,
        credential: issued[index]!.token,
      }));
    });
  }

  async rotateCredential(
    profileId: string,
    slotId: string,
  ): Promise<IssuedPlayerSlotDto> {
    const issued = this.credentials.issue();
    return this.store.transaction(async (transaction) => {
      const slot = await transaction.getSlot(slotId);
      if (!slot) return fail("NOT_FOUND", "Jogador não encontrado.");
      await this.requireClassAccess(profileId, slot.classGroupId, transaction);
      if (slot.status !== RecordStatus.ACTIVE) {
        return fail("CONFLICT", "O jogador não está ativo.");
      }
      return {
        ...(await transaction.rotateCredential(
          slotId,
          issued.tokenHash,
          this.now(),
        )),
        credential: issued.token,
      };
    });
  }

  async startSession(profileId: string, classGroupId: string) {
    return this.store.transaction(async (transaction) => {
      await this.requireClassAccess(profileId, classGroupId, transaction);
      if (await transaction.getActiveSession(classGroupId)) {
        return fail("CONFLICT", "A turma já possui uma sessão ativa.");
      }
      return transaction.createSession(classGroupId, this.now());
    });
  }

  async endSession(profileId: string, classGroupId: string) {
    return this.store.transaction(async (transaction) => {
      await this.requireClassAccess(profileId, classGroupId, transaction);
      const session = await transaction.getActiveSession(classGroupId);
      if (!session) return fail("CONFLICT", "A turma não possui sessão ativa.");
      return transaction.endSession(session.id, this.now());
    });
  }

  async resolveEntry(tokenHash: string) {
    return this.store.transaction(
      async (transaction: PlayerAccessTransaction) => {
        const credential = await transaction.resolveCredential(tokenHash);
        if (!credential) return { state: "invalid" as const };
        if (credential.status === PlayerCredentialStatus.REVOKED) {
          return { state: "revoked" as const };
        }
        const { slot, classGroup } = credential;
        if (
          slot.status !== RecordStatus.ACTIVE ||
          classGroup.status !== RecordStatus.ACTIVE ||
          classGroup.organizationStatus !== RecordStatus.ACTIVE
        ) {
          return { state: "inactive" as const };
        }
        const entry = await transaction.findOrCreateActiveParticipation(
          slot.classGroupId,
          slot.id,
          this.now(),
        );
        if (!entry) {
          return {
            state: "waiting" as const,
            classGroupId: slot.classGroupId,
            playerSlotId: slot.id,
            playerNumber: slot.playerNumber,
          };
        }
        return {
          state: "ready" as const,
          classGroupId: slot.classGroupId,
          credentialId: credential.id,
          playerSlotId: slot.id,
          playerNumber: slot.playerNumber,
          gameSessionId: entry.session.id,
          participationId: entry.participation.id,
        };
      },
    );
  }
}
