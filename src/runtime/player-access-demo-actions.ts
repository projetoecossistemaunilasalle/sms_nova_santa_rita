"use client";

import { z } from "zod";

import { AdultPortalError } from "@/application/adult-portal/errors";
import type { PlayerCredentialIssuer } from "@/application/player-access/ports";
import {
  allocatePlayerSlotsSchema,
  classSessionSchema,
  rotatePlayerCredentialSchema,
} from "@/application/player-access/schemas";
import { PlayerAccessService } from "@/application/player-access/service";
import type {
  IssuedCredentialDto,
  PlayerAccessActionResult,
} from "@/application/player-access/types";
import {
  DemoPlayerAccessStore,
  readDemoAdultPortalState,
  writeDemoAdultPortalState,
} from "@/runtime/adult-portal-demo-store";

function demoToken(): string {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return `demo_player_${suffix}`;
}

export class DemoPlayerCredentialIssuer implements PlayerCredentialIssuer {
  issue() {
    const token = demoToken();
    // Demo tokens are intentionally stored raw so a static page can resolve
    // credentials created in this browser without a server or shared secret.
    return { token, tokenHash: token };
  }
}

function formObject(formData: FormData): Record<string, FormDataEntryValue> {
  return Object.fromEntries(formData.entries());
}

function validationError(error: z.ZodError): PlayerAccessActionResult {
  return {
    ok: false,
    message: "Revise os campos informados.",
    fieldErrors: error.flatten().fieldErrors,
  };
}

function issuedCredential(
  slot: Awaited<ReturnType<PlayerAccessService["allocateSlots"]>>[number],
): IssuedCredentialDto {
  return {
    playerSlotId: slot.id,
    playerNumber: slot.playerNumber,
    token: slot.credential,
  };
}

async function runDemo(
  operation: (
    service: PlayerAccessService,
    profileId: string,
  ) => Promise<{
    message: string;
    issuedCredentials?: IssuedCredentialDto[];
  }>,
): Promise<PlayerAccessActionResult> {
  const state = readDemoAdultPortalState();
  try {
    const result = await operation(
      new PlayerAccessService(
        new DemoPlayerAccessStore(state),
        new DemoPlayerCredentialIssuer(),
      ),
      state.activeProfileId,
    );
    writeDemoAdultPortalState(state);
    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof z.ZodError) return validationError(error);
    return {
      ok: false,
      message:
        error instanceof AdultPortalError
          ? error.message
          : "Não foi possível concluir a operação.",
    };
  }
}

export async function allocatePlayerSlotsAction(
  _previous: PlayerAccessActionResult,
  formData: FormData,
): Promise<PlayerAccessActionResult> {
  const parsed = allocatePlayerSlotsSchema.safeParse(formObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;
  return runDemo(async (service, profileId) => {
    const slots = await service.allocateSlots(
      profileId,
      input.classGroupId,
      input.count,
    );
    return {
      message: `${slots.length} jogador${slots.length === 1 ? "" : "es"} criado${slots.length === 1 ? "" : "s"} no demo.`,
      issuedCredentials: slots.map(issuedCredential),
    };
  });
}

export async function rotatePlayerCredentialAction(
  _previous: PlayerAccessActionResult,
  formData: FormData,
): Promise<PlayerAccessActionResult> {
  const parsed = rotatePlayerCredentialSchema.safeParse(formObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  return runDemo(async (service, profileId) => {
    const slot = await service.rotateCredential(
      profileId,
      parsed.data.playerSlotId,
    );
    return {
      message: `QR do Jogador ${String(slot.playerNumber).padStart(2, "0")} substituído no demo.`,
      issuedCredentials: [issuedCredential(slot)],
    };
  });
}

export async function startClassSessionAction(
  _previous: PlayerAccessActionResult,
  formData: FormData,
): Promise<PlayerAccessActionResult> {
  const parsed = classSessionSchema.safeParse(formObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  return runDemo(async (service, profileId) => {
    await service.startSession(profileId, parsed.data.classGroupId);
    return { message: "Sessão da turma iniciada no demo." };
  });
}

export async function endClassSessionAction(
  _previous: PlayerAccessActionResult,
  formData: FormData,
): Promise<PlayerAccessActionResult> {
  const parsed = classSessionSchema.safeParse(formObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  return runDemo(async (service, profileId) => {
    await service.endSession(profileId, parsed.data.classGroupId);
    return { message: "Sessão da turma encerrada no demo." };
  });
}
