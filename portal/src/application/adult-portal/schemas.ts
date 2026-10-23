import { z } from "zod";

import { OrganizationRole, RecordStatus } from "@/generated/prisma/enums";

const id = z.string().trim().min(1, "Identificador obrigatório.");
const status = z.enum([RecordStatus.ACTIVE, RecordStatus.INACTIVE]);

export const createAccountSchema = z.object({
  displayName: z.string().trim().min(2, "Informe o nome completo.").max(160),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Informe um e-mail válido.").max(254)),
  password: z
    .string()
    .min(12, "Use uma senha com pelo menos 12 caracteres.")
    .max(128),
  organizationId: id,
  role: z.enum([OrganizationRole.ORGANIZATION_ADMIN, OrganizationRole.TEACHER]),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da organização.").max(200),
  type: z.string().trim().min(2, "Informe o tipo da organização.").max(80),
});

export const changeOrganizationStatusSchema = z.object({
  organizationId: id,
  status,
});

export const assignMembershipSchema = z.object({
  organizationId: id,
  profileId: id,
});

export const changeMembershipSchema = z.object({
  membershipId: id,
  role: z.enum([OrganizationRole.ORGANIZATION_ADMIN, OrganizationRole.TEACHER]),
  status,
});

export const createClassSchema = z.object({
  organizationId: id,
  name: z.string().trim().min(2, "Informe o nome da turma.").max(160),
});

export const changeClassStatusSchema = z.object({
  classGroupId: id,
  status,
});

export const assignTeacherSchema = z.object({
  classGroupId: id,
  membershipId: id,
});

export const deactivateTeacherAssignmentSchema = z.object({
  assignmentId: id,
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type ChangeOrganizationStatusInput = z.infer<
  typeof changeOrganizationStatusSchema
>;
export type AssignMembershipInput = z.infer<typeof assignMembershipSchema>;
export type ChangeMembershipInput = z.infer<typeof changeMembershipSchema>;
export type CreateClassInput = z.infer<typeof createClassSchema>;
export type ChangeClassStatusInput = z.infer<typeof changeClassStatusSchema>;
export type AssignTeacherInput = z.infer<typeof assignTeacherSchema>;
export type DeactivateTeacherAssignmentInput = z.infer<
  typeof deactivateTeacherAssignmentSchema
>;
