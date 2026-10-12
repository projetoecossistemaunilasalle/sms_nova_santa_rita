import Link from "next/link";
import type { ReactNode } from "react";

import type { ActorSession } from "@/server/auth/session";
import type { PortalShellDto } from "@/application/adult-portal/types";
import { signOutAction } from "@/runtime/actions";
import { Icon } from "@/components/shared/icon";
import { PortalNavigation } from "./portal-navigation";
import { MockWorkspaceControls } from "./mock-workspace-controls";
import {
  PortalScopeContext,
  PortalShellIdentity,
  PortalTopbarAvatar,
} from "./portal-shell-context";
import styles from "./portal.module.css";

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
  mockWorkspace,
  shell,
  children,
}: {
  session: ActorSession;
  mockWorkspace?: {
    activeProfileId: string;
    resetVersion: number;
    profiles: { id: string; displayName: string; roleLabel: string }[];
  };
  shell: PortalShellDto;
  children: ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#portal-content">
        Pular para o conteúdo
      </a>
      <aside className={styles.sidebar}>
        <Brand />
        <PortalNavigation items={shell.navigation} />
        <div className={styles.sidebarProfile}>
          <PortalShellIdentity
            defaultName={session.actor.displayName}
            shell={shell}
          />
        </div>
      </aside>

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.schoolChip}>
            <Icon name="building" />
            <span>
              <small>Escopo de acesso</small>
              <PortalScopeContext shell={shell} />
            </span>
          </div>
          <div className={styles.topbarActions}>
            <Link className={styles.helpLink} href="/portal/ajuda">
              Ajuda
            </Link>
            <PortalTopbarAvatar defaultName={session.actor.displayName} />
            <form action={signOutAction}>
              <button type="submit" className={styles.signOutButton}>
                Sair
              </button>
            </form>
          </div>
        </header>
        <main className={styles.content} id="portal-content" tabIndex={-1}>
          {mockWorkspace && (
            <MockWorkspaceControls
              key={`${mockWorkspace.activeProfileId}:${mockWorkspace.resetVersion}`}
              {...mockWorkspace}
            />
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
