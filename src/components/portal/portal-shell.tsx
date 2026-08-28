import Link from "next/link";
import type { ReactNode } from "react";

import type { Capability as CapabilityValue } from "@/generated/prisma/enums";
import type { ActorSession } from "@/server/auth/session";

import { Icon } from "@/components/shared/icon";

import { PortalNavigation } from "./portal-navigation";
import styles from "./portal.module.css";

function initialsFrom(displayName: string): string {
  return displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      className={`${styles.brand} ${compact ? styles.brandCompact : ""}`}
      href="/portal"
      aria-label="Missões do Caramelito, página inicial"
    >
      <span className={styles.brandMark}>MC</span>
      {!compact && (
        <span className={styles.brandCopy}>
          <strong>Missões do Caramelito</strong>
          <small>Portal do profissional</small>
        </span>
      )}
    </Link>
  );
}

export async function PortalShell({
  session,
  children,
}: {
  session: ActorSession;
  children: ReactNode;
}) {
  const initials = initialsFrom(session.actor.displayName);

  // Determine which admin destinations the current actor may see.
  // When the dev bypass is active the synthetic actor has no DB
  // assignments, but we still show the admin navigation for walkthroughs.
  // P1-7 FIX: authorize navigation via effective scope resolution (deny-by-default)
  // instead of permissive canUse without org. Resolve every destination from one
  // profile snapshot, and show a link if its scope is not denied (platform or any
  // org grant). For platform-wide admin screens a stricter policy would require
  // `scope.kind === "platform"` only.
  let allowedAdminHrefs: string[] | undefined;
  const { isAuthDevBypassEnabled } = await import("@/server/config/env");
  if (!isAuthDevBypassEnabled()) {
    try {
      const { getAuthorizationService } =
        await import("@/server/services/service-container");
      const { Capability } = await import("@/generated/prisma/enums");
      const authz = getAuthorizationService();
      const checks: Array<[string, CapabilityValue]> = [
        ["/portal/admin/equipe", Capability.USER_MANAGE],
        ["/portal/admin/organizacoes", Capability.ORGANIZATION_MANAGE],
        ["/portal/admin/auditoria", Capability.AUDIT_VIEW],
        // Jogos/módulos currently redirect; keep them hidden unless org-manage is present.
        ["/portal/admin/jogos", Capability.ORGANIZATION_MANAGE],
        ["/portal/admin/modulos", Capability.ORGANIZATION_MANAGE],
      ];
      const results = await authz.resolveEffectiveScopes(
        session.actor.profileId,
        checks.map(([, capability]) => capability),
      );
      allowedAdminHrefs = checks
        .filter((_, idx) => results[idx]?.kind !== "denied")
        .map(([href]) => href);
      // Stricter platform-only navigation: replace `!== "denied"` with `=== "platform"`.
    } catch {
      allowedAdminHrefs = [];
    }
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Brand />
        <PortalNavigation allowedAdminHrefs={allowedAdminHrefs} />
        <div className={styles.sidebarProfile}>
          <span className={styles.avatar}>{initials}</span>
          <span className={styles.sidebarProfileCopy}>
            <strong>{session.actor.displayName}</strong>
            <small>Profissional de saúde</small>
          </span>
          <Link
            href="/entrar"
            aria-label="Sair do portal"
            className={styles.logoutButton}
          >
            <Icon name="logout" />
          </Link>
        </div>
      </aside>

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.schoolChip}>
            <Icon name="building" />
            <span>
              <small>Organização ativa</small>
              <strong>EMEF Victor Aggens</strong>
            </span>
          </div>
          <div className={styles.topbarActions}>
            <Link className={styles.helpLink} href="/portal/ajuda">
              Ajuda
            </Link>
            <Link
              className={styles.newActivityShortcut}
              href="/portal/atividades/nova"
            >
              <Icon name="link" />
              <span>Novo link</span>
            </Link>
            <span className={styles.topbarAvatar}>{initials}</span>
          </div>
        </header>
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
