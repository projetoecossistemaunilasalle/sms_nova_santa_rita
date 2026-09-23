"use client";

import type { PortalShellDto } from "@/application/adult-portal/types";
import type { RuntimeMode } from "@/runtime/mode";

import { demoRole, demoScopeLabel, initials } from "./adult-portal-helpers";
import { useDemoPortalState } from "./use-demo-portal";
import styles from "./portal.module.css";

function roleLabel(role: PortalShellDto["effectiveRole"] | null): string {
  if (!role) return "Sem acesso ativo";
  return role === "platform_admin"
    ? "Administrador da plataforma"
    : role === "organization_admin"
      ? "Administrador da organização"
      : "Professor";
}

export function PortalShellIdentity({
  defaultName,
  shell,
  runtimeMode,
}: {
  defaultName: string;
  shell: PortalShellDto;
  runtimeMode: RuntimeMode;
}) {
  const demo = useDemoPortalState();
  const profile =
    runtimeMode === "demo" && demo
      ? demo.profiles.find((item) => item.id === demo.activeProfileId)
      : null;
  const name = profile?.displayName ?? defaultName;
  const role = demo ? demoRole(demo) : shell.effectiveRole;
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

export function PortalScopeContext({
  shell,
  runtimeMode,
}: {
  shell: PortalShellDto;
  runtimeMode: RuntimeMode;
}) {
  const demo = useDemoPortalState();
  let label = shell.scopeLabel;
  if (runtimeMode === "demo" && demo) {
    label = demoScopeLabel(demo);
  }
  return <strong>{label}</strong>;
}

export function PortalTopbarAvatar({
  defaultName,
  runtimeMode,
}: {
  defaultName: string;
  runtimeMode: RuntimeMode;
}) {
  const demo = useDemoPortalState();
  const profile =
    runtimeMode === "demo" && demo
      ? demo.profiles.find((item) => item.id === demo.activeProfileId)
      : null;
  return (
    <span className={styles.topbarAvatar}>
      {initials(profile?.displayName ?? defaultName)}
    </span>
  );
}
