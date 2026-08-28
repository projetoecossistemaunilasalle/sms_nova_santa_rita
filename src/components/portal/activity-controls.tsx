"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { ActivityStatus } from "@/server/services/portal-view-service";
import { Icon } from "@/components/shared/icon";
import {
  pauseAccessLinkAction,
  resumeAccessLinkAction,
  revokeAccessLinkAction,
  rotateAccessLinkAction,
  type AccessLifecycleActionResult,
} from "@/app/(professional)/portal/atividades/actions";

import { StatusBadge } from "./status-badge";
import styles from "./portal.module.css";

/**
 * Inline panel shown after a successful rotation. The raw token exists only
 * in this client state — it must never be placed in an href or URL.
 */
type RotateFeedback =
  { kind: "none" } | { kind: "token"; url: string; token: string };

/** Toast tone drives the icon: "check" for success, "alert" for errors. */
type Toast = { tone: "success" | "error"; text: string } | null;

export function ActivityControls({
  initialStatus,
  linkId,
}: {
  initialStatus: ActivityStatus;
  linkId?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [toast, setToast] = useState<Toast>(null);
  const [rotateFeedback, setRotateFeedback] = useState<RotateFeedback>({
    kind: "none",
  });
  const [pending, startTransition] = useTransition();

  function showToast(text: string, tone: "success" | "error" = "success") {
    setToast({ tone, text });
  }

  function updateStatus(next: ActivityStatus, feedback: string) {
    setStatus(next);
    showToast(feedback);
  }

  /**
   * Runs a throw-free lifecycle action (pause/resume/revoke) and reflects
   * the returned state locally; errors arrive pre-localized in pt-BR.
   */
  function handleLifecycle(
    action: (formData: FormData) => Promise<AccessLifecycleActionResult>,
    options: { reason?: string; next: ActivityStatus; feedback: string },
  ) {
    if (!linkId) {
      updateStatus(options.next, options.feedback);
      return;
    }
    const formData = new FormData();
    formData.set("linkId", linkId);
    if (options.reason) formData.set("reason", options.reason);
    startTransition(async () => {
      try {
        const result = await action(formData);
        if (result.status === "success") {
          // A pause/resume/revoke invalidates any previously rotated token
          // panel (the token itself may be gone or no longer shareable).
          setRotateFeedback({ kind: "none" });
          updateStatus(options.next, options.feedback);
          router.refresh();
        } else {
          showToast(result.message, "error");
        }
      } catch {
        showToast(
          "Não foi possível atualizar o link. Tente novamente em instantes.",
          "error",
        );
      }
    });
  }

  function handleRotate() {
    if (!linkId) {
      setRotateFeedback({ kind: "none" });
      updateStatus("Aberta", "Novo link gerado.");
      return;
    }
    const formData = new FormData();
    formData.set("linkId", linkId);
    startTransition(async () => {
      try {
        // Rotation returns the new one-time token inside its result value;
        // it is displayed once below and never written to a URL.
        const result = await rotateAccessLinkAction(formData);
        if (result.status === "success") {
          setStatus("Aberta");
          showToast("Novo link gerado.");
          setRotateFeedback({
            kind: "token",
            url: `${window.location.origin}/atividade/${result.token}`,
            token: result.token,
          });
          router.refresh();
        } else {
          showToast(result.message, "error");
        }
      } catch {
        showToast(
          "Não foi possível rotacionar o link. Tente novamente em instantes.",
          "error",
        );
      }
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
            disabled={pending}
            onClick={() =>
              handleLifecycle(pauseAccessLinkAction, {
                reason: "Link pausado pelo profissional",
                next: "Pausada",
                feedback: "Link pausado. O mesmo link pode ser reaberto.",
              })
            }
          >
            <Icon name="pause" /> Pausar
          </button>
        )}
        {status === "Pausada" && (
          <button
            className={styles.button}
            type="button"
            disabled={pending}
            onClick={() =>
              handleLifecycle(resumeAccessLinkAction, {
                next: "Aberta",
                feedback:
                  "Link reaberto. O mesmo link volta a funcionar — não é preciso enviar um novo link à turma.",
              })
            }
          >
            <Icon name="play" /> Reabrir
          </button>
        )}
        {status !== "Encerrada" && status !== "Rascunho" && (
          <button
            className={styles.buttonDanger}
            type="button"
            disabled={pending}
            onClick={() =>
              handleLifecycle(revokeAccessLinkAction, {
                reason: "Link encerrado pelo profissional",
                next: "Encerrada",
                feedback:
                  "Link encerrado. Os resultados continuam disponíveis.",
              })
            }
          >
            <Icon name="archive" /> Encerrar
          </button>
        )}
        {status === "Aberta" && (
          <button
            className={styles.buttonSecondary}
            type="button"
            disabled={pending}
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
