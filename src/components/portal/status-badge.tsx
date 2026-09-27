import styles from "./portal.module.css";

type Status = "Ativa" | "Inativa";

export function StatusBadge({ status }: { status: Status }) {
  const tone =
    status === "Ativa" ? styles.statusPositive : styles.statusNeutral;

  return <span className={`${styles.statusBadge} ${tone}`}>{status}</span>;
}
