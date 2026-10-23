"use client";

import { useActionState, useId, useRef, type ReactNode } from "react";

import type { ActionResult } from "@/application/adult-portal/types";

import styles from "./portal.module.css";

const initialState: ActionResult = { ok: false, message: "" };

export type PortalMutation = (
  previous: ActionResult,
  formData: FormData,
) => Promise<ActionResult>;

export function AdultPortalForm({
  action,
  children,
  submitLabel,
  compact = false,
  className,
  submitButtonClassName,
  confirmation,
}: {
  action: PortalMutation;
  children: ReactNode;
  submitLabel: string;
  compact?: boolean;
  className?: string;
  submitButtonClassName?: string;
  confirmation?: { title: string; description: string };
}) {
  const actionSucceeded = useRef(false);
  const [state, formAction, pending] = useActionState(
    async (previous: ActionResult, formData: FormData) => {
      actionSucceeded.current = false;
      const result = await action(previous, formData);
      actionSucceeded.current = result.ok;
      return result;
    },
    initialState,
  );
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const confirmationId = useId();
  return (
    <form
      action={formAction}
      aria-busy={pending}
      onReset={(event) => {
        // React resets uncontrolled fields even when an action returns an error.
        if (!actionSucceeded.current) event.preventDefault();
      }}
      onSubmit={(event) => {
        if (!confirmation) return;
        if (!dialogRef.current?.open) {
          event.preventDefault();
          dialogRef.current?.showModal();
        } else {
          dialogRef.current.close();
        }
      }}
      className={`${compact ? styles.inlineMutationForm : styles.portalForm} ${className ?? ""}`}
    >
      {children}
      <button
        ref={triggerRef}
        className={`${confirmation ? styles.buttonDanger : styles.button} ${submitButtonClassName ?? ""}`}
        type="submit"
        disabled={pending}
        aria-haspopup={confirmation ? "dialog" : undefined}
      >
        {pending ? "Salvando…" : submitLabel}
      </button>
      {confirmation && (
        <dialog
          ref={dialogRef}
          className={styles.confirmationDialog}
          aria-labelledby={`${confirmationId}-title`}
          aria-describedby={`${confirmationId}-description`}
          onClose={() => triggerRef.current?.focus()}
        >
          <h2 id={`${confirmationId}-title`}>{confirmation.title}</h2>
          <p id={`${confirmationId}-description`}>{confirmation.description}</p>
          <div className={styles.confirmationDialogActions}>
            <button
              className={styles.buttonGhost}
              type="button"
              autoFocus
              onClick={() => dialogRef.current?.close()}
            >
              Cancelar
            </button>
            <button
              className={styles.buttonDanger}
              type="submit"
              disabled={pending}
            >
              {submitLabel}
            </button>
          </div>
        </dialog>
      )}
      {state.message && (
        <p
          className={state.ok ? styles.formSuccess : styles.formError}
          role={state.ok ? "status" : "alert"}
        >
          {state.message}
        </p>
      )}
      {!state.ok && state.fieldErrors && (
        <ul className={styles.formError} aria-label="Campos a revisar">
          {Object.entries(state.fieldErrors).flatMap(([field, errors]) =>
            (errors ?? []).map((error, index) => (
              <li key={`${field}-${index}`}>{error}</li>
            )),
          )}
        </ul>
      )}
    </form>
  );
}
