import {
  OrganizationRole,
  PlatformRole,
  RecordStatus,
} from "@/generated/prisma/enums";
import {
  canAccessClass,
  canManageClasses,
  canManageOrganizations,
  canManageOrganizationStaff,
} from "@/server/authorization/v1-policy";

import { toAuthorizationActor } from "@/application/authorization/authorization-actor";

import { AdultPortalError } from "./errors";
import type {
  AccountIdentityProvider,
  AdultPortalReader,
  AdultPortalStore,
} from "./ports";
import { buildPortalShell } from "./shell-view-model";
import type {
  AssignMembershipInput,
  AssignTeacherInput,
  ChangeClassStatusInput,
  ChangeMembershipInput,
  ChangeOrganizationStatusInput,
  CreateClassInput,
  CreateAccountInput,
  CreateOrganizationInput,
  DeactivateTeacherAssignmentInput,
} from "./schemas";
import {
  assignMembershipSchema,
  assignTeacherSchema,
  changeClassStatusSchema,
  changeMembershipSchema,
  changeOrganizationStatusSchema,
  createClassSchema,
  createAccountSchema,
  createOrganizationSchema,
  deactivateTeacherAssignmentSchema,
} from "./schemas";
import type {
  ActorSnapshot,
  AdultRole,
  ClassDetailDto,
  ClassSummaryDto,
  OrganizationDetailDto,
  OrganizationSummaryDto,
  PortalOverviewDto,
  PortalShellDto,
  ProfessionalOptionDto,
  TeamMemberDto,
  TeacherAssignmentDto,
} from "./types";

function activeOrganizationIds(actor: ActorSnapshot): string[] {
  if (actor.profileStatus !== RecordStatus.ACTIVE) return [];
  return actor.memberships
    .filter(
      (membership) =>
        membership.status === RecordStatus.ACTIVE &&
        membership.organizationStatus === RecordStatus.ACTIVE,
    )
    .map((membership) => membership.organizationId);
}

function effectiveRole(actor: ActorSnapshot): AdultRole {
  if (
    actor.profileStatus === RecordStatus.ACTIVE &&
    actor.platformRole === PlatformRole.PLATFORM_ADMIN
  ) {
    return "platform_admin";
  }
  const roles = actor.memberships
    .filter(
      (membership) =>
        membership.status === RecordStatus.ACTIVE &&
        membership.organizationStatus === RecordStatus.ACTIVE,
    )
    .map((membership) => membership.role);
  return roles.includes(OrganizationRole.ORGANIZATION_ADMIN)
    ? "organization_admin"
    : "teacher";
}

function requireActor(actor: ActorSnapshot | null): ActorSnapshot {
  if (!actor || actor.profileStatus !== RecordStatus.ACTIVE) {
    throw new AdultPortalError(
      "Sessão profissional inativa.",
      "UNAUTHENTICATED",
    );
  }
  return actor;
}

function notFound(entity: string): never {
  throw new AdultPortalError(`${entity} não encontrado.`, "NOT_FOUND");
}

function forbidden(message = "Você não pode realizar esta operação."): never {
  throw new AdultPortalError(message, "FORBIDDEN");
}

export class AdultPortalService {
  constructor(
    private readonly store: AdultPortalStore,
    private readonly identities?: AccountIdentityProvider,
  ) {}

  async createAccount(profileId: string, input: CreateAccountInput) {
    const data = createAccountSchema.parse(input);
    const authorize = async (reader: AdultPortalReader) => {
      const actor = toAuthorizationActor(await this.actor(profileId, reader));
      if (
        !canManageOrganizations(actor) &&
        (data.role !== OrganizationRole.TEACHER ||
          !canManageOrganizationStaff(actor, data.organizationId))
      )
        forbidden();
      await this.assertActiveOrganization(reader, data.organizationId);
    };
    // Check before contacting the provider, then again before committing access.
    await authorize(this.store);
    if (!this.identities) {
      throw new AdultPortalError(
        "A criação de contas não está configurada. Contate o administrador da plataforma.",
        "VALIDATION",
      );
    }
    const identity = await this.identities.create(data);
    try {
      return await this.store.transaction(async (transaction) => {
        await authorize(transaction);
        const profile = await transaction.createProfessionalProfile({
          authUserId: identity.authUserId,
          displayName: data.displayName,
          email: data.email,
        });
        return transaction.createMembership({
          profileId: profile.id,
          organizationId: data.organizationId,
          role: data.role,
        });
      });
    } catch (error) {
      try {
        await identity.rollback();
      } catch {
        throw new AdultPortalError(
          "Não foi possível concluir o vínculo nem remover a identidade criada. Peça ao administrador para verificar o cadastro no Neon Auth antes de tentar novamente.",
          "CONFLICT",
        );
      }
      throw error;
    }
  }

  private async actor(
    profileId: string,
    reader: AdultPortalReader = this.store,
  ) {
    return requireActor(await reader.getActor(profileId));
  }

  async getShell(profileId: string): Promise<PortalShellDto> {
    const actor = await this.actor(profileId);
    return buildPortalShell(actor, effectiveRole(actor));
  }

  async getOverview(profileId: string): Promise<PortalOverviewDto> {
    const actor = await this.actor(profileId);
    const shell = buildPortalShell(actor, effectiveRole(actor));
    const [organizations, classes] = await Promise.all([
      this.organizationsForActor(actor),
      this.classesForActor(actor),
    ]);
    const organizationIds = activeOrganizationIds(actor);
    const team =
      shell.effectiveRole === "teacher"
        ? []
        : await this.store.listMemberships(
            shell.effectiveRole === "platform_admin"
              ? undefined
              : organizationIds,
          );
    return {
      effectiveRole: shell.effectiveRole,
      roleLabel: shell.roleLabel,
      scopeLabel: shell.scopeLabel,
      organizations,
      classes,
      teamMemberCount: team.filter(
        (member) => member.status === RecordStatus.ACTIVE,
      ).length,
    };
  }

  async listOrganizations(
    profileId: string,
  ): Promise<OrganizationSummaryDto[]> {
    const actor = await this.actor(profileId);
    return this.organizationsForActor(actor);
  }

  private async organizationsForActor(
    actor: ActorSnapshot,
  ): Promise<OrganizationSummaryDto[]> {
    if (canManageOrganizations(toAuthorizationActor(actor))) {
      return this.store.listOrganizations();
    }
    const adminOrganizationIds = actor.memberships
      .filter(
        (membership) =>
          membership.role === OrganizationRole.ORGANIZATION_ADMIN &&
          membership.status === RecordStatus.ACTIVE &&
          membership.organizationStatus === RecordStatus.ACTIVE,
      )
      .map((membership) => membership.organizationId);
    if (adminOrganizationIds.length === 0) return [];
    return this.store.listOrganizations(adminOrganizationIds);
  }

  async getOrganization(
    profileId: string,
    organizationId: string,
  ): Promise<OrganizationDetailDto> {
    const actor = await this.actor(profileId);
    const organization = await this.store.getOrganization(organizationId);
    if (!organization) return notFound("Organização");
    const platformAdmin = canManageOrganizations(toAuthorizationActor(actor));
    const organizationAdmin = canManageOrganizationStaff(
      toAuthorizationActor(actor),
      organizationId,
    );
    if (!platformAdmin && !organizationAdmin) forbidden();
    const [memberships, classes] = await Promise.all([
      this.store.listMemberships([organizationId]),
      this.store.listClasses([organizationId]),
    ]);
    return {
      ...organization,
      memberships,
      classes,
      canManage: platformAdmin,
      canAssignAdministrator: platformAdmin,
    };
  }

  async createOrganization(profileId: string, input: CreateOrganizationInput) {
    const data = createOrganizationSchema.parse(input);
    return this.store.transaction(async (transaction) => {
      const actor = await this.actor(profileId, transaction);
      if (!canManageOrganizations(toAuthorizationActor(actor))) forbidden();
      return transaction.createOrganization(data);
    });
  }

  async changeOrganizationStatus(
    profileId: string,
    input: ChangeOrganizationStatusInput,
  ) {
    const data = changeOrganizationStatusSchema.parse(input);
    return this.store.transaction(async (transaction) => {
      const actor = await this.actor(profileId, transaction);
      if (!canManageOrganizations(toAuthorizationActor(actor))) forbidden();
      if (!(await transaction.getOrganization(data.organizationId))) {
        return notFound("Organização");
      }
      return transaction.updateOrganizationStatus(
        data.organizationId,
        data.status,
      );
    });
  }

  async listTeam(profileId: string): Promise<TeamMemberDto[]> {
    const actor = await this.actor(profileId);
    if (canManageOrganizations(toAuthorizationActor(actor))) {
      return this.store.listMemberships();
    }
    const organizationIds = activeOrganizationIds(actor).filter((id) =>
      canManageOrganizationStaff(toAuthorizationActor(actor), id),
    );
    if (organizationIds.length === 0) forbidden();
    return this.store.listMemberships(organizationIds);
  }

  async listProvisionedProfiles(
    profileId: string,
  ): Promise<ProfessionalOptionDto[]> {
    const actor = await this.actor(profileId);
    const canManageAnyStaff = activeOrganizationIds(actor).some((id) =>
      canManageOrganizationStaff(toAuthorizationActor(actor), id),
    );
    if (
      !canManageOrganizations(toAuthorizationActor(actor)) &&
      !canManageAnyStaff
    ) {
      forbidden();
    }
    return this.store.listProfessionalProfiles();
  }

  async assignOrganizationAdministrator(
    profileId: string,
    input: AssignMembershipInput,
  ) {
    const data = assignMembershipSchema.parse(input);
    return this.store.transaction(async (transaction) => {
      const actor = await this.actor(profileId, transaction);
      if (!canManageOrganizations(toAuthorizationActor(actor))) forbidden();
      await this.assertActiveOrganization(transaction, data.organizationId);
      await this.assertActiveProfile(transaction, data.profileId);
      const existing = await transaction.findMembership(
        data.profileId,
        data.organizationId,
      );
      if (existing?.role === OrganizationRole.ORGANIZATION_ADMIN) {
        throw new AdultPortalError(
          "Este profissional já é administrador da organização.",
          "CONFLICT",
        );
      }
      if (existing) {
        await transaction.deactivateAssignmentsForMembership(existing.id);
        return transaction.updateMembership(
          existing.id,
          OrganizationRole.ORGANIZATION_ADMIN,
          RecordStatus.ACTIVE,
        );
      }
      return transaction.createMembership({
        organizationId: data.organizationId,
        profileId: data.profileId,
        role: OrganizationRole.ORGANIZATION_ADMIN,
      });
    });
  }

  async assignTeacher(profileId: string, input: AssignMembershipInput) {
    const data = assignMembershipSchema.parse(input);
    return this.store.transaction(async (transaction) => {
      const actor = await this.actor(profileId, transaction);
      if (
        !canManageOrganizationStaff(
          toAuthorizationActor(actor),
          data.organizationId,
        )
      ) {
        forbidden();
      }
      await this.assertActiveOrganization(transaction, data.organizationId);
      await this.assertActiveProfile(transaction, data.profileId);
      if (
        await transaction.findMembership(data.profileId, data.organizationId)
      ) {
        throw new AdultPortalError(
          "Este profissional já possui vínculo com a organização.",
          "CONFLICT",
        );
      }
      return transaction.createMembership({
        organizationId: data.organizationId,
        profileId: data.profileId,
        role: OrganizationRole.TEACHER,
      });
    });
  }

  async changeMembership(profileId: string, input: ChangeMembershipInput) {
    const data = changeMembershipSchema.parse(input);
    return this.store.transaction(async (transaction) => {
      const actor = await this.actor(profileId, transaction);
      const membership = await transaction.getMembership(data.membershipId);
      if (!membership) return notFound("Vínculo");
      const platformAdmin = canManageOrganizations(toAuthorizationActor(actor));
      if (platformAdmin) {
        const roleChanged = membership.role !== data.role;
        if (data.status === RecordStatus.ACTIVE || roleChanged) {
          await this.assertActiveOrganization(
            transaction,
            membership.organizationId,
          );
          await this.assertActiveProfile(transaction, membership.profileId);
        }
        if (roleChanged && data.role === OrganizationRole.ORGANIZATION_ADMIN) {
          await transaction.deactivateAssignmentsForMembership(membership.id);
        }
      } else {
        if (
          !canManageOrganizationStaff(
            toAuthorizationActor(actor),
            membership.organizationId,
          ) ||
          membership.role !== OrganizationRole.TEACHER ||
          data.role !== OrganizationRole.TEACHER
        ) {
          forbidden(
            "Administradores da organização gerenciam apenas profissionais da própria organização.",
          );
        }
        if (data.status === RecordStatus.ACTIVE) {
          await this.assertActiveProfile(transaction, membership.profileId);
        }
      }
      return transaction.updateMembership(
        data.membershipId,
        data.role,
        data.status,
      );
    });
  }

  async listClasses(profileId: string): Promise<ClassSummaryDto[]> {
    const actor = await this.actor(profileId);
    return this.classesForActor(actor);
  }

  private async classesForActor(
    actor: ActorSnapshot,
  ): Promise<ClassSummaryDto[]> {
    const auth = toAuthorizationActor(actor);
    if (canManageOrganizations(auth)) return this.store.listClasses();
    const adminOrganizationIds = activeOrganizationIds(actor).filter((id) =>
      canManageClasses(auth, id),
    );
    const teacherMemberships = actor.memberships.filter(
      (membership) =>
        membership.role === OrganizationRole.TEACHER &&
        membership.status === RecordStatus.ACTIVE &&
        membership.organizationStatus === RecordStatus.ACTIVE,
    );
    const teacherClassIds = new Set(
      teacherMemberships.flatMap((membership) =>
        membership.teacherAssignments
          .filter((assignment) => assignment.status === RecordStatus.ACTIVE)
          .map((assignment) => assignment.classGroupId),
      ),
    );
    const organizationIds = [
      ...new Set([
        ...adminOrganizationIds,
        ...teacherMemberships.map((membership) => membership.organizationId),
      ]),
    ];
    if (organizationIds.length === 0) return [];
    const classes = await this.store.listClasses(organizationIds);
    return classes.filter(
      (classGroup) =>
        adminOrganizationIds.includes(classGroup.organizationId) ||
        (classGroup.status === RecordStatus.ACTIVE &&
          teacherClassIds.has(classGroup.id)),
    );
  }

  async getClass(
    profileId: string,
    classGroupId: string,
  ): Promise<ClassDetailDto> {
    const actor = await this.actor(profileId);
    const classGroup = await this.store.getClass(classGroupId);
    if (!classGroup) return notFound("Turma");
    const auth = toAuthorizationActor(actor);
    const canManage = canManageClasses(auth, classGroup.organizationId);
    if (!canManage && !canAccessClass(auth, classGroup)) forbidden();
    return {
      ...classGroup,
      canManage,
      availableTeachers: canManage ? classGroup.availableTeachers : [],
    };
  }

  async createClass(profileId: string, input: CreateClassInput) {
    const data = createClassSchema.parse(input);
    return this.store.transaction(async (transaction) => {
      const actor = await this.actor(profileId, transaction);
      if (!canManageClasses(toAuthorizationActor(actor), data.organizationId))
        forbidden();
      await this.assertActiveOrganization(transaction, data.organizationId);
      return transaction.createClass(data);
    });
  }

  async changeClassStatus(profileId: string, input: ChangeClassStatusInput) {
    const data = changeClassStatusSchema.parse(input);
    return this.store.transaction(async (transaction) => {
      const actor = await this.actor(profileId, transaction);
      const classGroup = await transaction.getClass(data.classGroupId);
      if (!classGroup) return notFound("Turma");
      if (
        !canManageClasses(
          toAuthorizationActor(actor),
          classGroup.organizationId,
        )
      )
        forbidden();
      return transaction.updateClassStatus(data.classGroupId, data.status);
    });
  }

  async assignTeacherToClass(profileId: string, input: AssignTeacherInput) {
    const data = assignTeacherSchema.parse(input);
    return this.store.transaction(async (transaction) => {
      const actor = await this.actor(profileId, transaction);
      const classGroup = await transaction.getClass(data.classGroupId);
      if (!classGroup) return notFound("Turma");
      if (
        !canManageClasses(
          toAuthorizationActor(actor),
          classGroup.organizationId,
        )
      )
        forbidden();
      if (classGroup.status !== RecordStatus.ACTIVE) {
        throw new AdultPortalError(
          "Ative a turma antes de atribuir profissionais.",
          "VALIDATION",
        );
      }
      const membership = await transaction.getMembership(data.membershipId);
      if (!membership) return notFound("Vínculo profissional");
      if (
        membership.organizationId !== classGroup.organizationId ||
        membership.role !== OrganizationRole.TEACHER ||
        membership.status !== RecordStatus.ACTIVE ||
        membership.profileStatus !== RecordStatus.ACTIVE
      ) {
        throw new AdultPortalError(
          "A atribuição exige um vínculo de profissional ativo na mesma organização.",
          "VALIDATION",
        );
      }
      const existing = await transaction.findAssignment(
        data.membershipId,
        data.classGroupId,
      );
      if (existing?.status === RecordStatus.INACTIVE) {
        return transaction.updateAssignmentStatus(
          existing.id,
          RecordStatus.ACTIVE,
        );
      }
      if (existing) {
        throw new AdultPortalError(
          "Este profissional já possui atribuição nesta turma.",
          "CONFLICT",
        );
      }
      return transaction.createAssignment(data.membershipId, data.classGroupId);
    });
  }

  async deactivateTeacherAssignment(
    profileId: string,
    input: DeactivateTeacherAssignmentInput,
  ): Promise<TeacherAssignmentDto> {
    const data = deactivateTeacherAssignmentSchema.parse(input);
    return this.store.transaction(async (transaction) => {
      const actor = await this.actor(profileId, transaction);
      const assignment = await transaction.getAssignment(data.assignmentId);
      if (!assignment) return notFound("Atribuição");
      if (
        !canManageClasses(
          toAuthorizationActor(actor),
          assignment.organizationId,
        )
      )
        forbidden();
      return transaction.updateAssignmentStatus(
        data.assignmentId,
        RecordStatus.INACTIVE,
      );
    });
  }

  private async assertActiveOrganization(
    reader: AdultPortalReader,
    organizationId: string,
  ) {
    const organization = await reader.getOrganization(organizationId);
    if (!organization) return notFound("Organização");
    if (organization.status !== RecordStatus.ACTIVE) {
      throw new AdultPortalError(
        "A organização precisa estar ativa.",
        "VALIDATION",
      );
    }
  }

  private async assertActiveProfile(
    reader: AdultPortalReader,
    profileId: string,
  ) {
    const profile = await reader.getProfessionalProfile(profileId);
    if (!profile) return notFound("Perfil profissional");
    if (profile.status !== RecordStatus.ACTIVE) {
      throw new AdultPortalError(
        "O perfil profissional precisa estar ativo.",
        "VALIDATION",
      );
    }
  }
}
