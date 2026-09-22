import Link from "next/link";
import type { ReactNode } from "react";

import type { ActorSession } from "@/server/auth/session";
import type { RuntimeMode } from "@/runtime/mode";
import type { PortalShellDto } from "@/application/adult-portal/types";
import { signOutAction } from "@runtime/sign-out-action";
import { Icon } from "@/components/shared/icon";
import { PortalNavigation } from "./portal-navigation";
import { DemoRoleControls } from "./demo-role-controls";
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
  runtimeMode,
  shell,
  children,
}: {
  session: ActorSession;
  runtimeMode: RuntimeMode;
  shell: PortalShellDto;
  children: ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Brand />
        {runtimeMode === "demo" && <DemoRoleControls />}
        <PortalNavigation items={shell.navigation} runtimeMode={runtimeMode} />
        <div className={styles.sidebarProfile}>
          <PortalShellIdentity
            defaultName={session.actor.displayName}
            shell={shell}
            runtimeMode={runtimeMode}
          />
          {runtimeMode === "demo" ? (
            <Link
              href="/entrar"
              aria-label="Sair do portal"
              className={styles.logoutButton}
            >
              <Icon name="logout" />
            </Link>
          ) : (
            <form action={signOutAction}>
              <button
                type="submit"
                aria-label="Sair do portal"
                className={styles.logoutButton}
              >
                <Icon name="logout" />
              </button>
            </form>
          )}
        </div>
      </aside>

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.schoolChip}>
            <Icon name="building" />
            <span>
              <small>Escopo de acesso</small>
              <PortalScopeContext shell={shell} runtimeMode={runtimeMode} />
            </span>
          </div>
          <div className={styles.topbarActions}>
            <Link className={styles.helpLink} href="/portal/ajuda">
              Ajuda
            </Link>
            <PortalTopbarAvatar
              defaultName={session.actor.displayName}
              runtimeMode={runtimeMode}
            />
          </div>
        </header>
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
