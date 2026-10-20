"use client";

import type { PortalShellDto } from "@/application/adult-portal/types";

import { initials } from "./adult-portal-helpers";
import styles from "./portal.module.css";

function roleLabel(role: PortalShellDto["effectiveRole"] | null): string {
  if (!role) return "Sem acesso ativo";
  return role === "platform_admin"
    ? "Administrador da plataforma"
    : role === "organization_admin"
      ? "Administrador da organização"
      : "Profissional";
}

export function PortalShellIdentity({
  defaultName,
  shell,
}: {
  defaultName: string;
  shell: PortalShellDto;
}) {
  const name = defaultName;
  const role = shell.effectiveRole;
  return (
    <>
      <span className={styles.avatar}>{initials(name)}</span>
      <span className={styles.sidebarProfileCopy}>
        <strong>{name}</strong>
        <small>{roleLabel(role)}</small>
      </span>
    </>
  );
}

export function PortalScopeContext({ shell }: { shell: PortalShellDto }) {
  return <strong>{shell.scopeLabel}</strong>;
}

export function PortalTopbarAvatar({ defaultName }: { defaultName: string }) {
  return <span className={styles.topbarAvatar}>{initials(defaultName)}</span>;
}
