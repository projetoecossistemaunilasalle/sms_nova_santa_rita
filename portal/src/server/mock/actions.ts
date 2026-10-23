"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { RecordStatus } from "@/generated/prisma/enums";
import { getMockDatabase } from "./session";

export async function changeMockProfile(formData: FormData): Promise<void> {
  const profileId = String(formData.get("profileId") ?? "");
  const database = await getMockDatabase();
  await database.transaction(async (state) => {
    if (
      !state.profiles.some(
        (profile) =>
          profile.id === profileId && profile.status === RecordStatus.ACTIVE,
      )
    ) {
      throw new Error("Selecione um perfil ativo.");
    }
    state.activeProfileId = profileId;
  });
  revalidatePath("/portal", "layout");
  redirect("/portal");
}

export async function resetMockWorkspace(): Promise<void> {
  await (await getMockDatabase()).reset();
  revalidatePath("/portal", "layout");
  redirect("/portal");
}
