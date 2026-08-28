import type { ReactNode } from "react";

import styles from "./public.module.css";

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.page}>
      <span
        className={`${styles.cloud} ${styles.cloudOne}`}
        aria-hidden="true"
      />
      <span
        className={`${styles.cloud} ${styles.cloudTwo}`}
        aria-hidden="true"
      />
      <header className={styles.header}>
        <div className={styles.brand} aria-label="Missões do Caramelito">
          <span className={styles.brandMark}>MC</span> Missões do Caramelito
        </div>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
