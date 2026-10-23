import type { ReactNode } from "react";

import { Icon, type IconName } from "@/components/shared/icon";

import styles from "./portal.module.css";

export function PortalState({
  icon,
  title,
  description,
  actions,
  headingLevel = 1,
}: {
  icon: IconName;
  title: string;
  description: string;
  actions?: ReactNode;
  headingLevel?: 1 | 2;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <section className={styles.stateCard}>
      <span className={styles.stateIcon}>
        <Icon name={icon} />
      </span>
      <Heading>{title}</Heading>
      <p>{description}</p>
      {actions && <div className={styles.stateActions}>{actions}</div>}
    </section>
  );
}
