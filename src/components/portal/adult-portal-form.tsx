"use client";

import { useActionState, type ReactNode } from "react";

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
}: {
  action: PortalMutation;
  children: ReactNode;
  submitLabel: string;
  compact?: boolean;
  className?: string;
  submitButtonClassName?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form
      action={formAction}
      className={`${compact ? styles.inlineMutationForm : styles.portalForm} ${className ?? ""}`}
    >
      {children}
      <button
        className={`${styles.button} ${submitButtonClassName ?? ""}`}
        type="submit"
        disabled={pending}
      >
        {pending ? "Salvando…" : submitLabel}
      </button>
      {state.message && (
        <p
          className={state.ok ? styles.formSuccess : styles.formError}
          role="status"
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
