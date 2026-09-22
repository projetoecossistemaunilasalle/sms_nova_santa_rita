"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { AdultPortalError } from "@/application/adult-portal/errors";
import {
  allocatePlayerSlotsSchema,
  classSessionSchema,
  rotatePlayerCredentialSchema,
} from "@/application/player-access/schemas";
import type { PlayerAccessActionResult } from "@/application/player-access/types";
import { getAuthGateway } from "@/server/auth/gateway";
import { getPlayerAccessService } from "@/server/services/player-access-container";

const initialError: PlayerAccessActionResult = {
  ok: false,
  message: "Não foi possível concluir a operação.",
};

function formObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function validationError(error: z.ZodError): PlayerAccessActionResult {
  return {
    ...initialError,
    message: "Revise os campos informados.",
    fieldErrors: error.flatten().fieldErrors,
  };
}

async function actorProfileId(): Promise<string> {
  const session = await getAuthGateway().getSession();
  if (!session) {
    throw new AdultPortalError("Sessão expirada.", "UNAUTHENTICATED");
  }
  return session.actor.profileId;
}

function operationError(error: unknown): PlayerAccessActionResult {
  if (error instanceof z.ZodError) return validationError(error);
  if (error instanceof AdultPortalError) {
    return { ...initialError, message: error.message };
  }
  return initialError;
}

function revalidateClass(classGroupId: string) {
  revalidatePath("/portal");
  revalidatePath("/portal/turmas");
  revalidatePath(`/portal/turmas/${classGroupId}`);
}

export async function allocatePlayerSlotsAction(
  _previous: PlayerAccessActionResult,
  formData: FormData,
): Promise<PlayerAccessActionResult> {
  const parsed = allocatePlayerSlotsSchema.safeParse(formObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  try {
    const slots = await getPlayerAccessService().allocateSlots(
      await actorProfileId(),
      parsed.data.classGroupId,
      parsed.data.count,
    );
    revalidateClass(parsed.data.classGroupId);
    return {
      ok: true,
      message: `${slots.length} jogador(es) criado(s). Imprima as credenciais agora.`,
      issuedCredentials: slots.map((slot) => ({
        playerSlotId: slot.id,
        playerNumber: slot.playerNumber,
        token: slot.credential,
      })),
    };
  } catch (error) {
    return operationError(error);
  }
}

export async function rotatePlayerCredentialAction(
  _previous: PlayerAccessActionResult,
  formData: FormData,
): Promise<PlayerAccessActionResult> {
  const parsed = rotatePlayerCredentialSchema.safeParse(formObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  try {
    const slot = await getPlayerAccessService().rotateCredential(
      await actorProfileId(),
      parsed.data.playerSlotId,
    );
    revalidateClass(slot.classGroupId);
    return {
      ok: true,
      message: "Credencial substituída. A anterior não pode mais ser usada.",
      issuedCredentials: [
        {
          playerSlotId: slot.id,
          playerNumber: slot.playerNumber,
          token: slot.credential,
        },
      ],
    };
  } catch (error) {
    return operationError(error);
  }
}

export async function startClassSessionAction(
  _previous: PlayerAccessActionResult,
  formData: FormData,
): Promise<PlayerAccessActionResult> {
  const parsed = classSessionSchema.safeParse(formObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  try {
    await getPlayerAccessService().startSession(
      await actorProfileId(),
      parsed.data.classGroupId,
    );
    revalidateClass(parsed.data.classGroupId);
    return { ok: true, message: "Sessão da turma iniciada." };
  } catch (error) {
    return operationError(error);
  }
}

export async function endClassSessionAction(
  _previous: PlayerAccessActionResult,
  formData: FormData,
): Promise<PlayerAccessActionResult> {
  const parsed = classSessionSchema.safeParse(formObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  try {
    await getPlayerAccessService().endSession(
      await actorProfileId(),
      parsed.data.classGroupId,
    );
    revalidateClass(parsed.data.classGroupId);
    return { ok: true, message: "Sessão da turma encerrada." };
  } catch (error) {
    return operationError(error);
  }
}
