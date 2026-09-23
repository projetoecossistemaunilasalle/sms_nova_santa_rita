import { z } from "zod";

import { AdultPortalError } from "@/application/adult-portal/errors";
import { AdultPortalService } from "@/application/adult-portal/service";
import type { TeamMemberDto } from "@/application/adult-portal/types";
import { OrganizationRole, RecordStatus } from "@/generated/prisma/enums";
import {
  createDemoProfileId,
  DemoAdultPortalStore,
  type DemoAdultPortalState,
} from "@/runtime/adult-portal-demo-store";

export const createDemoProfessionalSchema = z.object({
  displayName: z.string().trim().min(2, "Informe o nome.").max(160),
  email: z
    .string()
    .trim()
    .email("Informe um e-mail válido.")
    .max(254)
    .refine((email) => email.toLowerCase().endsWith(".test"), {
      message: "Use um e-mail fictício terminado em .test.",
    }),
  organizationId: z.string().trim().min(1, "Selecione uma organização."),
  role: z.enum([OrganizationRole.ORGANIZATION_ADMIN, OrganizationRole.TEACHER]),
});

export type CreateDemoProfessionalInput = z.infer<
  typeof createDemoProfessionalSchema
>;

export async function createDemoProfessionalMembership(
  state: DemoAdultPortalState,
  actorId: string,
  input: unknown,
): Promise<TeamMemberDto> {
  const data = createDemoProfessionalSchema.parse(input);
  const email = data.email.toLocaleLowerCase("pt-BR");

  if (
    state.profiles.some(
      (profile) => profile.email?.toLocaleLowerCase("pt-BR") === email,
    )
  ) {
    throw new AdultPortalError(
      "Este e-mail já foi usado em um perfil demo.",
      "CONFLICT",
    );
  }

  const profileId = createDemoProfileId();
  state.profiles.push({
    id: profileId,
    displayName: data.displayName,
    email,
    status: RecordStatus.ACTIVE,
    platformRole: null,
  });

  try {
    const service = new AdultPortalService(new DemoAdultPortalStore(state));
    return data.role === OrganizationRole.ORGANIZATION_ADMIN
      ? await service.assignOrganizationAdministrator(actorId, {
          profileId,
          organizationId: data.organizationId,
        })
      : await service.assignTeacher(actorId, {
          profileId,
          organizationId: data.organizationId,
        });
  } catch (error) {
    state.profiles = state.profiles.filter(
      (profile) => profile.id !== profileId,
    );
    throw error;
  }
}
