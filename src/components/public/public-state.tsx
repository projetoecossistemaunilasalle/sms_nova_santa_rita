import Link from "next/link";

import { Icon, type IconName } from "@/components/shared/icon";

import styles from "./public.module.css";

export function PublicState({
  icon,
  title,
  description,
  retryHref,
  retryLabel = "Tentar novamente",
}: {
  icon: IconName;
  title: string;
  description: string;
  retryHref?: string;
  retryLabel?: string;
}) {
  return (
    <section className={styles.stateCard}>
      <span className={styles.stateIcon}>
        <Icon name={icon} />
      </span>
      <h1>{title}</h1>
      <p>{description}</p>
      <div className={styles.stateActions}>
        {retryHref && (
          <Link className={styles.primary} href={retryHref}>
            {retryLabel} <Icon name="arrow" />
          </Link>
        )}
      </div>
    </section>
  );
}
