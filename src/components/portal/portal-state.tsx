import type { ReactNode } from "react";

import { Icon, type IconName } from "@/components/shared/icon";

import styles from "./portal.module.css";

export function PortalState({
  icon,
  title,
  description,
  actions,
}: {
  icon: IconName;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <section className={styles.stateCard}>
      <span className={styles.stateIcon}>
        <Icon name={icon} />
      </span>
      <h1>{title}</h1>
      <p>{description}</p>
      {actions && <div className={styles.stateActions}>{actions}</div>}
    </section>
  );
}
