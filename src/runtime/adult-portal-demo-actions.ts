"use client";

import { z } from "zod";

import { AdultPortalError } from "@/application/adult-portal/errors";
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
import { AdultPortalService } from "@/application/adult-portal/service";
import type { ActionResult } from "@/application/adult-portal/types";
import {
  DemoAdultPortalStore,
  readDemoAdultPortalState,
  writeDemoAdultPortalState,
} from "@/runtime/adult-portal-demo-store";

function formObject(formData: FormData): Record<string, FormDataEntryValue> {
  return Object.fromEntries(formData.entries());
}

function validationError(error: z.ZodError): ActionResult {
  return {
    ok: false,
    message: "Revise os campos informados.",
    fieldErrors: error.flatten().fieldErrors,
  };
}

async function runDemo(
  operation: (
    service: AdultPortalService,
    profileId: string,
  ) => Promise<unknown>,
  successMessage: string,
): Promise<ActionResult> {
  const state = readDemoAdultPortalState();
  try {
    await operation(
      new AdultPortalService(new DemoAdultPortalStore(state)),
      state.activeProfileId,
    );
    writeDemoAdultPortalState(state);
    return { ok: true, message: successMessage };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        ok: false,
        message: "Revise os campos informados.",
        fieldErrors: error.flatten().fieldErrors,
      };
    }
    return {
      ok: false,
      message:
        error instanceof AdultPortalError
          ? error.message
          : "Não foi possível concluir a operação.",
    };
  }
}

export async function createOrganizationAction(
  _previous: ActionResult,
  formData: FormData,
) {
  const parsed = createOrganizationSchema.safeParse(formObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;
  return runDemo(
    (service, profileId) => service.createOrganization(profileId, input),
    "Organização demo criada.",
  );
}

export async function changeOrganizationStatusAction(
  _previous: ActionResult,
  formData: FormData,
) {
  const parsed = changeOrganizationStatusSchema.safeParse(formObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;
  return runDemo(
    (service, profileId) => service.changeOrganizationStatus(profileId, input),
    "Estado da organização atualizado no demo.",
  );
}

export async function assignOrganizationAdministratorAction(
  _previous: ActionResult,
  formData: FormData,
) {
  const parsed = assignMembershipSchema.safeParse(formObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;
  return runDemo(
    (service, profileId) =>
      service.assignOrganizationAdministrator(profileId, input),
    "Administrador vinculado no demo.",
  );
}

export async function assignTeacherMembershipAction(
  _previous: ActionResult,
  formData: FormData,
) {
  const parsed = assignMembershipSchema.safeParse(formObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;
  return runDemo(
    (service, profileId) => service.assignTeacher(profileId, input),
    "Professor vinculado no demo.",
  );
}

export async function changeMembershipAction(
  _previous: ActionResult,
  formData: FormData,
) {
  const parsed = changeMembershipSchema.safeParse(formObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;
  return runDemo(
    (service, profileId) => service.changeMembership(profileId, input),
    "Acesso atualizado no demo.",
  );
}

export async function createClassAction(
  _previous: ActionResult,
  formData: FormData,
) {
  const parsed = createClassSchema.safeParse(formObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;
  return runDemo(
    (service, profileId) => service.createClass(profileId, input),
    "Turma demo criada.",
  );
}

export async function changeClassStatusAction(
  _previous: ActionResult,
  formData: FormData,
) {
  const parsed = changeClassStatusSchema.safeParse(formObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;
  return runDemo(
    (service, profileId) => service.changeClassStatus(profileId, input),
    "Estado da turma atualizado no demo.",
  );
}

export async function assignTeacherToClassAction(
  _previous: ActionResult,
  formData: FormData,
) {
  const parsed = assignTeacherSchema.safeParse(formObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;
  return runDemo(
    (service, profileId) => service.assignTeacherToClass(profileId, input),
    "Professor atribuído no demo.",
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
  return runDemo(
    (service, profileId) =>
      service.deactivateTeacherAssignment(profileId, input),
    "Atribuição desativada no demo.",
  );
}
