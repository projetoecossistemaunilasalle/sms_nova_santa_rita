"use client";

import { useActionState, useId, useRef, useState } from "react";

import type { ActionResult } from "@/application/adult-portal/types";
import { RecordStatus } from "@/generated/prisma/enums";
import { changeOrganizationStatusAction } from "@runtime/adult-portal-actions";

import styles from "./portal.module.css";

export function DeactivateOrganizationControl({
  organizationId,
  organizationName,
  triggerLabel = "Desativar organização",
}: {
  organizationId: string;
  organizationName?: string;
  triggerLabel?: string;
}) {
  const confirmationId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const confirmationDialogRef = useRef<HTMLDialogElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (previousState: ActionResult, formData: FormData) => {
      const nextState = await changeOrganizationStatusAction(
        previousState,
        formData,
      );
      if (nextState.ok) closeConfirmation();
      return nextState;
    },
    { ok: false, message: "" },
  );

  function openConfirmation() {
    const dialog = confirmationDialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    setDialogOpen(true);
  }

  function closeConfirmation() {
    const dialog = confirmationDialogRef.current;
    if (dialog?.open) dialog.close();
    else triggerRef.current?.focus();
  }

  return (
    <div className={styles.organizationStatusControl}>
      <button
        ref={triggerRef}
        className={styles.buttonDanger}
        type="button"
        aria-label={
          organizationName ? `Desativar ${organizationName}` : triggerLabel
        }
        aria-haspopup="dialog"
        aria-expanded={dialogOpen}
        aria-controls={confirmationId}
        onClick={openConfirmation}
        disabled={pending}
      >
        {triggerLabel}
      </button>
      <dialog
        ref={confirmationDialogRef}
        className={`${styles.confirmationDialog} ${styles.organizationDeactivateDialog}`}
        id={confirmationId}
        aria-modal="true"
        aria-labelledby={`${confirmationId}-title`}
        aria-describedby={`${confirmationId}-description`}
        onCancel={() => setDialogOpen(false)}
        onClose={() => {
          setDialogOpen(false);
          triggerRef.current?.focus();
        }}
      >
        <h2 id={`${confirmationId}-title`}>Desativar esta organização?</h2>
        <p id={`${confirmationId}-description`}>
          {organizationName && <strong>{organizationName}: </strong>}
          Os profissionais deixarão de acessar os dados e as turmas desta
          organização enquanto ela estiver inativa. Nenhum cadastro será
          excluído.
        </p>
        <form action={formAction}>
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="status" value={RecordStatus.INACTIVE} />
          {state.message && !state.ok && (
            <p className={styles.formError} role="alert">
              {state.message}
            </p>
          )}
          <div className={styles.confirmationDialogActions}>
            <button
              className={styles.buttonGhost}
              type="button"
              autoFocus
              onClick={closeConfirmation}
              disabled={pending}
            >
              Cancelar
            </button>
            <button
              className={styles.buttonDanger}
              type="submit"
              disabled={pending}
            >
              {pending ? "Desativando…" : "Desativar organização"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
