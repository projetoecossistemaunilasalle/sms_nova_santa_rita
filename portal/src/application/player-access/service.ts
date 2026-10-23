import {
  GameSessionStatus,
  PlayerCredentialStatus,
  RecordStatus,
} from "@/generated/prisma/enums";
import {
  canFlushSession,
  DEFAULT_OFFLINE_FLUSH_WINDOW_SECONDS,
} from "./flush-policy";
import {
  canAccessClass,
  canManageClasses,
} from "@/server/authorization/v1-policy";
import { AdultPortalError } from "@/application/adult-portal/errors";
import { toAuthorizationActor } from "@/application/authorization/authorization-actor";
import {
  resolvePolicy,
  type ContentSelection,
} from "@/application/game-content/policy";

import type {
  PlayerAccessReader,
  PlayerAccessStore,
  PlayerAccessTransaction,
  PlayerCredentialIssuer,
  PlayerCredentialCipher,
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
    private readonly cipher: PlayerCredentialCipher,
    private readonly now: () => Date = () => new Date(),
    private readonly flushWindowSeconds = DEFAULT_OFFLINE_FLUSH_WINDOW_SECONDS,
  ) {}

  private async requireClassAccess(
    profileId: string,
    classGroupId: string,
    reader: PlayerAccessReader,
    allowInactiveManagement = false,
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
      !(
        canAccessClass(toAuthorizationActor(actor), classGroup) ||
        (allowInactiveManagement &&
          canManageClasses(
            toAuthorizationActor(actor),
            classGroup.organizationId,
          ))
      )
    ) {
      return fail("FORBIDDEN", "Você não pode operar esta turma.");
    }
    return classGroup;
  }

  async getClassWorkflow(profileId: string, classGroupId: string) {
    await this.requireClassAccess(profileId, classGroupId, this.store, true);
    const [slots, activeSession] = await Promise.all([
      this.store.listSlots(classGroupId),
      this.store.getActiveSession(classGroupId),
    ]);
    return { slots, activeSession };
  }

  async getClassContent(profileId: string, classGroupId: string) {
    return this.store.transaction(async (transaction) => {
      const classGroup = await this.requireClassAccess(
        profileId,
        classGroupId,
        transaction,
        true,
      );
      const manifest = await transaction.getCurrentManifest();
      const activeSession = await transaction.getActiveSession(classGroupId);
      const activeManifest = activeSession
        ? await transaction.getManifest(activeSession.contentManifestId)
        : null;
      if (activeSession && !activeManifest) {
        return fail("CONFLICT", "A versão desta sessão não está disponível.");
      }
      return {
        manifest,
        defaultSelection: classGroup.defaultContentSelection ?? null,
        activeSession,
        activeManifest,
      };
    });
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
        issued.map(({ token, tokenHash }) => ({
          tokenHash,
          encryptedToken: this.cipher.encrypt(token, tokenHash),
        })),
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
          this.cipher.encrypt(issued.token, issued.tokenHash),
        )),
        credential: issued.token,
      };
    });
  }

  async getClassCredentials(profileId: string, classGroupId: string) {
    return this.store.transaction(async (transaction) => {
      await this.requireClassAccess(profileId, classGroupId, transaction);
      const [slots, storedCredentials] = await Promise.all([
        transaction.listSlots(classGroupId),
        transaction.listStoredCredentials(classGroupId),
      ]);
      const storedBySlot = new Map(
        storedCredentials.map((credential) => [
          credential.playerSlotId,
          credential,
        ]),
      );
      const issuedCredentials = [];
      const unavailablePlayerNumbers = [];
      for (const slot of slots) {
        if (slot.status !== RecordStatus.ACTIVE) continue;
        const stored = storedBySlot.get(slot.id);
        if (
          slot.credentialStatus !== PlayerCredentialStatus.ACTIVE ||
          !stored?.encryptedToken
        ) {
          unavailablePlayerNumbers.push(slot.playerNumber);
          continue;
        }
        let token: string;
        try {
          token = this.cipher.decrypt(stored.encryptedToken, stored.tokenHash);
        } catch {
          unavailablePlayerNumbers.push(slot.playerNumber);
          continue;
        }
        if (this.cipher.needsReencryption?.(stored.encryptedToken)) {
          await transaction.updateEncryptedCredential(
            slot.id,
            stored.tokenHash,
            this.cipher.encrypt(token, stored.tokenHash),
          );
        }
        issuedCredentials.push({
          playerSlotId: slot.id,
          playerNumber: slot.playerNumber,
          token,
        });
      }
      return { issuedCredentials, unavailablePlayerNumbers };
    });
  }

  async startSession(
    profileId: string,
    classGroupId: string,
    selection?: ContentSelection | null,
    saveAsClassDefault = false,
  ) {
    return this.store.transaction(async (transaction) => {
      const classGroup = await this.requireClassAccess(
        profileId,
        classGroupId,
        transaction,
      );
      if (await transaction.getActiveSession(classGroupId)) {
        return fail("CONFLICT", "A turma já possui uma sessão ativa.");
      }
      const manifest = await transaction.getCurrentManifest();
      if (!manifest)
        return fail("CONFLICT", "Nenhuma versão do jogo importada");
      const effectiveSelection =
        selection === undefined
          ? (classGroup.defaultContentSelection ?? null)
          : selection;
      const contentPolicy = resolvePolicy(effectiveSelection, manifest.payload);
      // Save and start atomically: a failed or duplicate start must not edit defaults.
      if (saveAsClassDefault) {
        await transaction.setClassDefaultContent(
          classGroupId,
          effectiveSelection,
        );
      }
      return transaction.createSession(classGroupId, this.now(), {
        contentManifestId: manifest.id,
        contentPolicy,
        startedById: profileId,
      });
    });
  }

  async setClassDefaultContent(
    profileId: string,
    classGroupId: string,
    selection: ContentSelection | null,
  ) {
    return this.store.transaction(async (transaction) => {
      await this.requireClassAccess(profileId, classGroupId, transaction);
      const manifest = await transaction.getCurrentManifest();
      if (!manifest)
        return fail("CONFLICT", "Nenhuma versão do jogo importada");
      resolvePolicy(selection, manifest.payload);
      await transaction.setClassDefaultContent(classGroupId, selection);
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

  async renewEntry(
    tokenHash: string,
    playerSlotId: string,
    gameSessionId: string,
  ) {
    return this.store.transaction(async (transaction) => {
      const credential = await transaction.resolveCredential(tokenHash);
      if (!credential || credential.slot.id !== playerSlotId)
        return { state: "invalid" as const };
      if (credential.status !== PlayerCredentialStatus.ACTIVE)
        return { state: "revoked" as const };
      if (
        credential.slot.status !== RecordStatus.ACTIVE ||
        credential.classGroup.status !== RecordStatus.ACTIVE ||
        credential.classGroup.organizationStatus !== RecordStatus.ACTIVE
      )
        return { state: "inactive" as const };
      // Renewal never creates participation or switches to the latest class session.
      const existing = await transaction.getExistingParticipation(
        gameSessionId,
        playerSlotId,
      );
      if (
        !existing ||
        existing.session.classGroupId !== credential.slot.classGroupId ||
        existing.participation.playerSlotId !== playerSlotId ||
        existing.participation.gameSessionId !== gameSessionId
      )
        return { state: "invalid" as const };
      if (
        !canFlushSession(
          existing.session.status,
          existing.session.endedAt,
          this.now(),
          this.flushWindowSeconds,
        )
      )
        return { state: "ended" as const };
      return {
        state: "ready" as const,
        classGroupId: credential.slot.classGroupId,
        credentialId: credential.id,
        playerSlotId,
        playerNumber: credential.slot.playerNumber,
        gameSessionId,
        participationId: existing.participation.id,
        purpose:
          existing.session.status === GameSessionStatus.ACTIVE
            ? ("play" as const)
            : ("flush" as const),
      };
    });
  }
}
