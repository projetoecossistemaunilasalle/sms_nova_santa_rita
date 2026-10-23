"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { AdultPortalError } from "@/application/adult-portal/errors";
import type { ActionResult } from "@/application/adult-portal/types";
import type { GameContentService } from "@/application/game-content/service";
import { getAuthGateway } from "@/server/auth/gateway";
import { getGameContentService } from "@/server/services/game-content-container";

const manifestSchema = z.object({
  manifestId: z.string().trim().min(1).max(128),
});

async function runAction(
  operation: (
    service: GameContentService,
    profileId: string,
  ) => Promise<unknown>,
  message: string,
): Promise<ActionResult> {
  try {
    const session = await getAuthGateway().getSession();
    if (!session) {
      throw new AdultPortalError("Sessão expirada.", "UNAUTHENTICATED");
    }
    await operation(await getGameContentService(), session.actor.profileId);
    revalidatePath("/portal", "layout");
    return { ok: true, message };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof AdultPortalError
          ? error.message
          : "Não foi possível concluir a operação.",
    };
  }
}

export async function importGameManifestAction(
  _previous: ActionResult,
  _formData: FormData,
): Promise<ActionResult> {
  void _previous;
  void _formData;
  return runAction(
    (service, profileId) => service.importFromGameClient(profileId),
    "Versão do jogo importada. Selecione Tornar atual para usá-la nas próximas sessões.",
  );
}

export async function setCurrentGameManifestAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = manifestSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    return {
      ok: false,
      message: "Selecione uma versão do jogo.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  return runAction(
    (service, profileId) =>
      service.setCurrent(profileId, parsed.data.manifestId),
    "Versão atual do jogo atualizada. As sessões em andamento não serão alteradas.",
  );
}
