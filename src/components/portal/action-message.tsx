import type { PlayerAccessActionResult } from "@/application/player-access/types";
import styles from "./portal.module.css";

export function ActionMessage({ state }: { state: PlayerAccessActionResult }) {
  if (!state.message) return null;
  return (
    <p
      className={state.ok ? styles.formSuccess : styles.formError}
      role={state.ok ? "status" : "alert"}
    >
      {state.message}
    </p>
  );
}
