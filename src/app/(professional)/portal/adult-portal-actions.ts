"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { AdultPortalError } from "@/application/adult-portal/errors";
import type { AdultPortalService } from "@/application/adult-portal/service";
import {
  assignMembershipSchema,
  assignTeacherSchema,
  changeClassStatusSchema,
  changeMembershipSchema,
  changeOrganizationStatusSchema,
  createClassSchema,
  createOrganizationSchema,
  deactivateTeacherAssignmentSchema,
} from "@/application/adult-portal/schemas";
import type { ActionResult } from "@/application/adult-portal/types";
import { getAuthGateway } from "@/server/auth/gateway";
import { getAdultPortalService } from "@/server/services/adult-portal-container";

const initialError: ActionResult = {
  ok: false,
  message: "Não foi possível concluir a operação.",
};

function validationError(error: z.ZodError): ActionResult {
  return {
    ...initialError,
    message: "Revise os campos informados.",
    fieldErrors: error.flatten().fieldErrors,
  };
}

async function actorProfileId(): Promise<string> {
  const session = await getAuthGateway().getSession();
  if (!session)
    throw new AdultPortalError("Sessão expirada.", "UNAUTHENTICATED");
  return session.actor.profileId;
}

function formObject(formData: FormData): Record<string, FormDataEntryValue> {
  return Object.fromEntries(formData.entries());
}

async function runAction(
  operation: (
    profileId: string,
    service: AdultPortalService,
  ) => Promise<unknown>,
  successMessage: string,
  paths: string[],
): Promise<ActionResult> {
  try {
    await operation(await actorProfileId(), await getAdultPortalService());
    paths.forEach((path) => revalidatePath(path));
    return { ok: true, message: successMessage };
  } catch (error) {
    if (error instanceof z.ZodError) return validationError(error);
    if (error instanceof AdultPortalError) {
      return { ...initialError, message: error.message };
    }
    return initialError;
  }
}

export async function createOrganizationAction(
  _previous: ActionResult,
  formData: FormData,
) {
  const parsed = createOrganizationSchema.safeParse(formObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;
  return runAction(
    (profileId, service) => service.createOrganization(profileId, input),
    "Organização criada.",
    ["/portal", "/portal/admin/organizacoes"],
  );
}

export async function changeOrganizationStatusAction(
  _previous: ActionResult,
  formData: FormData,
) {
  const parsed = changeOrganizationStatusSchema.safeParse(formObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;
  return runAction(
    (profileId, service) => service.changeOrganizationStatus(profileId, input),
    input.status === "ACTIVE"
      ? "Organização ativada."
      : "Organização desativada.",
    [
      "/portal",
      "/portal/admin/organizacoes",
      `/portal/admin/organizacoes/${input.organizationId}`,
    ],
  );
}

export async function assignOrganizationAdministratorAction(
  _previous: ActionResult,
  formData: FormData,
) {
  const parsed = assignMembershipSchema.safeParse(formObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;
  return runAction(
    (profileId, service) =>
      service.assignOrganizationAdministrator(profileId, input),
    "Administrador vinculado à organização.",
    [
      "/portal/admin/equipe",
      `/portal/admin/organizacoes/${input.organizationId}`,
    ],
  );
}

export async function assignTeacherMembershipAction(
  _previous: ActionResult,
  formData: FormData,
) {
  const parsed = assignMembershipSchema.safeParse(formObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;
  return runAction(
    (profileId, service) => service.assignTeacher(profileId, input),
    "Professor vinculado à organização.",
    [
      "/portal/admin/equipe",
      `/portal/admin/organizacoes/${input.organizationId}`,
    ],
  );
}

export async function changeMembershipAction(
  _previous: ActionResult,
  formData: FormData,
) {
  const parsed = changeMembershipSchema.safeParse(formObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;
  return runAction(
    (profileId, service) => service.changeMembership(profileId, input),
    input.status === "ACTIVE" ? "Acesso ativado." : "Acesso desativado.",
    ["/portal/admin/equipe", "/portal/turmas"],
  );
}

export async function createClassAction(
  _previous: ActionResult,
  formData: FormData,
) {
  const parsed = createClassSchema.safeParse(formObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;
  return runAction(
    (profileId, service) => service.createClass(profileId, input),
    "Turma criada.",
    [
      "/portal",
      "/portal/turmas",
      `/portal/admin/organizacoes/${input.organizationId}`,
    ],
  );
}

export async function changeClassStatusAction(
  _previous: ActionResult,
  formData: FormData,
) {
  const parsed = changeClassStatusSchema.safeParse(formObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;
  return runAction(
    (profileId, service) => service.changeClassStatus(profileId, input),
    input.status === "ACTIVE" ? "Turma ativada." : "Turma desativada.",
    ["/portal/turmas", `/portal/turmas/${input.classGroupId}`],
  );
}

export async function assignTeacherToClassAction(
  _previous: ActionResult,
  formData: FormData,
) {
  const parsed = assignTeacherSchema.safeParse(formObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;
  return runAction(
    (profileId, service) => service.assignTeacherToClass(profileId, input),
    "Professor atribuído à turma.",
    ["/portal/turmas", `/portal/turmas/${input.classGroupId}`],
  );
}

export async function deactivateTeacherAssignmentAction(
  _previous: ActionResult,
  formData: FormData,
) {
  const parsed = deactivateTeacherAssignmentSchema.safeParse(
    formObject(formData),
  );
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;
  return runAction(
    (profileId, service) =>
      service.deactivateTeacherAssignment(profileId, input),
    "Atribuição desativada.",
    ["/portal/turmas"],
  );
}
