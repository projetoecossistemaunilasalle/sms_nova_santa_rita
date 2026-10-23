"use client";

import { useEffect } from "react";

import styles from "./error.module.css";
import { Icon } from "@/components/shared/icon";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className={styles.page}>
      <div className={styles.main}>
        <section className={styles.stateCard}>
          <span className={styles.stateIcon}>
            <Icon name="alert" />
          </span>
          <h1>Não foi possível abrir esta página.</h1>
          <p>
            Tente novamente. Se o problema continuar, reabra o link recebido ou
            informe o suporte.
          </p>
          <div className={styles.stateActions}>
            <button className={styles.primary} type="button" onClick={reset}>
              Tentar novamente
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
