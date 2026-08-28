"use client";

import { useState } from "react";
import type { ActivityStatus } from "@/server/services/portal-view-service";
import { Icon } from "@/components/shared/icon";
import { StatusBadge } from "./status-badge";
import styles from "./portal.module.css";

type RotateFeedback =
  { kind: "none" } | { kind: "token"; url: string; token: string };

type Toast = { tone: "success" | "error"; text: string } | null;

export function ActivityControls({
  initialStatus,
}: {
  initialStatus: ActivityStatus;
  linkId?: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [toast, setToast] = useState<Toast>(null);
  const [rotateFeedback, setRotateFeedback] = useState<RotateFeedback>({
    kind: "none",
  });

  function showToast(text: string, tone: "success" | "error" = "success") {
    setToast({ tone, text });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  }

  function updateStatus(next: ActivityStatus, feedback: string) {
    setStatus(next);
    showToast(feedback);
  }

  function handleRotate() {
    const newToken = `MC-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    setStatus("Aberta");
    showToast("Novo link gerado.");
    setRotateFeedback({
      kind: "token",
      url: `https://niciniv.github.io/SMS_Portal/atividade/${newToken}`,
      token: newToken,
    });
  }

  async function copyRotateUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      showToast("Novo link copiado para a área de transferência.");
    } catch {
      showToast(
        "Não foi possível copiar automaticamente. Selecione o link acima.",
        "error",
      );
    }
  }

  return (
    <>
      <div className={styles.summaryLine}>
        <span>Estado atual</span>
        <StatusBadge status={status} />
      </div>
      <div className={styles.lifecycleActions}>
        {status === "Aberta" && (
          <button
            className={styles.buttonGhost}
            type="button"
            onClick={() =>
              updateStatus(
                "Pausada",
                "Demonstração: link pausado. O mesmo link pode ser reaberto.",
              )
            }
          >
            <Icon name="pause" /> Pausar
          </button>
        )}
        {status === "Pausada" && (
          <button
            className={styles.button}
            type="button"
            onClick={() =>
              updateStatus(
                "Aberta",
                "Demonstração: link reaberto. O mesmo link volta a funcionar.",
              )
            }
          >
            <Icon name="play" /> Reabrir
          </button>
        )}
        {status !== "Encerrada" && status !== "Rascunho" && (
          <button
            className={styles.buttonDanger}
            type="button"
            onClick={() =>
              updateStatus(
                "Encerrada",
                "Demonstração: link encerrado. Os resultados continuam disponíveis.",
              )
            }
          >
            <Icon name="archive" /> Encerrar
          </button>
        )}
        {status === "Aberta" && (
          <button
            className={styles.buttonSecondary}
            type="button"
            onClick={handleRotate}
          >
            <Icon name="history" /> Gerar novo link
          </button>
        )}
      </div>
      {rotateFeedback.kind === "token" && (
        <div style={{ marginTop: 10 }}>
          <div className={styles.contextNotice} role="status">
            <Icon name="check" />
            <span>
              O link anterior deixou de funcionar. Copie e envie o novo link
              abaixo.
            </span>
          </div>
          <div className={styles.shareUrl} style={{ marginTop: 8 }}>
            <code>{rotateFeedback.url}</code>
            <button
              type="button"
              aria-label="Copiar novo link"
              onClick={() => copyRotateUrl(rotateFeedback.url)}
            >
              <Icon name="copy" />
            </button>
          </div>
          <div className={styles.linkCard} style={{ marginTop: 8 }}>
            <code>{rotateFeedback.token}</code>
            <div className={styles.linkMeta}>
              <span>Novo token</span>
              <span>exibido apenas uma vez</span>
            </div>
          </div>
        </div>
      )}
      {toast !== null && (
        <div className={styles.toast} role="status">
          <Icon name={toast.tone === "error" ? "alert" : "check"} />
          {toast.text}
        </div>
      )}
    </>
  );
}
