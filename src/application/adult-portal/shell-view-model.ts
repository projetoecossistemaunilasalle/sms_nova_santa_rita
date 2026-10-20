import { RecordStatus } from "@/generated/prisma/enums";

import type {
  ActorSnapshot,
  AdultRole,
  PortalShellDto,
} from "@/application/adult-portal/types";

export function buildPortalShell(
  actor: ActorSnapshot,
  effectiveRole: AdultRole,
): PortalShellDto {
  const activeMemberships = actor.memberships.filter(
    (membership) =>
      membership.status === RecordStatus.ACTIVE &&
      membership.organizationStatus === RecordStatus.ACTIVE,
  );
  const names = [
    ...new Set(activeMemberships.map((item) => item.organizationName)),
  ];
  const scopeLabel =
    effectiveRole === "platform_admin"
      ? "Escopo de toda a plataforma"
      : names.length === 0
        ? "Sem organização ativa"
        : names.length === 1
          ? names[0]!
          : `${names.length} organizações acessíveis`;
  const navigation: PortalShellDto["navigation"] = [
    {
      href: "/portal",
      label: "Visão geral",
      icon: "home",
      exact: true,
      mobile: true,
    },
  ];
  if (effectiveRole !== "platform_admin") {
    navigation.push(
      {
        href: "/portal/turmas",
        label: "Turmas",
        icon: "school",
        mobile: true,
      },
      {
        href: "/portal/resultados",
        label: "Resultados",
        icon: "chart",
        mobile: true,
      },
    );
  }
  if (effectiveRole === "platform_admin") {
    navigation.push(
      {
        href: "/portal/admin/organizacoes",
        label: "Organizações",
        icon: "building",
        mobile: true,
      },
      {
        href: "/portal/admin/equipe",
        label: "Equipe",
        icon: "users",
        mobile: true,
      },
    );
  } else if (effectiveRole === "organization_admin") {
    navigation.push(
      {
        href: "/portal/admin/equipe",
        label: "Equipe",
        icon: "users",
        mobile: true,
      },
      {
        href: `/portal/admin/organizacoes/${activeMemberships[0]?.organizationId ?? ""}`,
        label: "Minha organização",
        icon: "building",
        mobile: true,
      },
    );
  }
  return {
    effectiveRole,
    roleLabel:
      effectiveRole === "platform_admin"
        ? "Administrador da plataforma"
        : effectiveRole === "organization_admin"
          ? "Administrador da organização"
          : "Profissional",
    scopeLabel,
    navigation,
  };
}
