import Link from "next/link";
import type { ReactNode } from "react";

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

export function PortalShell({
  session,
  children,
}: {
  session: ActorSession;
  children: ReactNode;
}) {
  const initials = initialsFrom(session.actor.displayName);
  const allowedAdminHrefs = [
    "/portal/admin/equipe",
    "/portal/admin/organizacoes",
    "/portal/admin/auditoria",
  ];

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
