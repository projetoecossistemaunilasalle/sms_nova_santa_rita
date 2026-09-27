"use client";

import { useActionState, useId, useMemo, useRef, useState } from "react";

import type {
  ClassWorkflowDto,
  PlayerAccessActionResult,
  PlayerSlotDto,
} from "@/application/player-access/types";
import {
  GameSessionStatus,
  PlayerCredentialStatus,
  RecordStatus,
} from "@/generated/prisma/enums";
import type { RuntimeMode } from "@/runtime/mode";
import type { DemoAdultPortalState } from "@/runtime/adult-portal-demo-store";
import {
  allocatePlayerSlotsAction,
  endClassSessionAction,
  rotatePlayerCredentialAction,
  startClassSessionAction,
} from "@/runtime/actions";
import { Icon } from "@/components/shared/icon";
import { printablePlayerCredentials } from "./player-credential-printing";

import { PlayerCredentialPrintSheet } from "./player-credential-print-sheet";
import styles from "./portal.module.css";

const initialActionState: PlayerAccessActionResult = { ok: false, message: "" };

type DemoWorkflowState = {
  playerSlots?: Array<{
    id: string;
    classGroupId: string;
    playerNumber: number;
    status: RecordStatus;
  }>;
  playerCredentials?: Array<{
    id: string;
    playerSlotId: string;
    status: PlayerCredentialStatus;
  }>;
  gameSessions?: Array<{
    id: string;
    classGroupId: string;
    status: GameSessionStatus;
    startedAt: string;
    endedAt: string | null;
  }>;
};

function playerLabel(playerNumber: number): string {
  return `Jogador ${String(playerNumber).padStart(2, "0")}`;
}

export function workflowFromDemoState(
  demoState: DemoAdultPortalState | null,
  classGroupId: string,
  fallback: ClassWorkflowDto,
): ClassWorkflowDto {
  if (!demoState) return fallback;
  const demo = demoState as unknown as DemoWorkflowState;
  if (!demo.playerSlots || !demo.playerCredentials || !demo.gameSessions) {
    return fallback;
  }

  const slots: PlayerSlotDto[] = demo.playerSlots
    .filter((slot) => slot.classGroupId === classGroupId)
    .map((slot) => {
      const credential = demo.playerCredentials!.find(
        (item) =>
          item.playerSlotId === slot.id &&
          item.status === PlayerCredentialStatus.ACTIVE,
      );
      return {
        ...slot,
        credentialId: credential?.id ?? null,
        credentialStatus: credential?.status ?? null,
      };
    })
    .sort((a, b) => a.playerNumber - b.playerNumber);
  const activeSession = demo.gameSessions.find(
    (session) =>
      session.classGroupId === classGroupId &&
      session.status === GameSessionStatus.ACTIVE,
  );

  return {
    slots,
    activeSession: activeSession
      ? {
          ...activeSession,
          startedAt: new Date(activeSession.startedAt),
          endedAt: activeSession.endedAt
            ? new Date(activeSession.endedAt)
            : null,
        }
      : null,
  };
}

function ActionMessage({ state }: { state: PlayerAccessActionResult }) {
  if (!state.message) return null;
  return (
    <p
      className={state.ok ? styles.formSuccess : styles.formError}
      role="status"
    >
      {state.message}
    </p>
  );
}

function AllocatePlayers({
  classGroupId,
  className,
  disabled,
  organizationName,
  runtimeMode,
  invalidatedSlotIds,
}: {
  classGroupId: string;
  className: string;
  disabled: boolean;
  organizationName: string;
  runtimeMode: RuntimeMode;
  invalidatedSlotIds: ReadonlySet<string>;
}) {
  const [state, formAction, pending] = useActionState(
    allocatePlayerSlotsAction,
    initialActionState,
  );
  const printableCredentials = useMemo(
    () =>
      printablePlayerCredentials(
        state.issuedCredentials ?? [],
        invalidatedSlotIds,
      ),
    [invalidatedSlotIds, state.issuedCredentials],
  );

  return (
    <section className={styles.playerAllocationPanel}>
      <div>
        <h2>Adicionar jogadores numerados</h2>
        <p>
          Novos números seguem a sequência da turma. Números antigos nunca são
          reutilizados.
        </p>
      </div>
      <form action={formAction} className={styles.playerAllocationForm}>
        <input type="hidden" name="classGroupId" value={classGroupId} />
        <label className={styles.field}>
          <span>Quantidade</span>
          <input
            className={styles.input}
            type="number"
            name="count"
            min="1"
            max="100"
            inputMode="numeric"
            defaultValue="5"
            required
            disabled={disabled || pending}
          />
        </label>
        <button
          className={styles.button}
          type="submit"
          disabled={disabled || pending}
        >
          <Icon name="plus" />
          {pending ? "Criando…" : "Criar e gerar QR"}
        </button>
        <ActionMessage state={state} />
      </form>
      {state.ok && printableCredentials.length ? (
        <PlayerCredentialPrintSheet
          className={className}
          credentials={printableCredentials}
          organizationName={organizationName}
          runtimeMode={runtimeMode}
        />
      ) : null}
    </section>
  );
}

function RotateCredential({
  className,
  disabled,
  organizationName,
  runtimeMode,
  slot,
  onCredentialRotated,
}: {
  className: string;
  disabled: boolean;
  organizationName: string;
  runtimeMode: RuntimeMode;
  slot: PlayerSlotDto;
  onCredentialRotated: (slotId: string) => void;
}) {
  const confirmationId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const confirmationDialogRef = useRef<HTMLDialogElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (previousState: PlayerAccessActionResult, formData: FormData) => {
      const nextState = await rotatePlayerCredentialAction(
        previousState,
        formData,
      );
      if (nextState.ok) onCredentialRotated(slot.id);
      return nextState;
    },
    initialActionState,
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
    setDialogOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div
      className={`${styles.playerCredentialAction} ${
        state.ok && state.issuedCredentials?.length
          ? styles.playerCredentialActionIssued
          : ""
      }`}
    >
      <form action={formAction} onSubmit={closeConfirmation}>
        <input type="hidden" name="playerSlotId" value={slot.id} />
        <button
          ref={triggerRef}
          className={styles.buttonGhost}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={dialogOpen}
          aria-controls={confirmationId}
          onClick={openConfirmation}
          disabled={disabled || pending}
          aria-label={`Gerar novo QR para ${playerLabel(slot.playerNumber)}`}
        >
          <Icon name="history" />
          {pending ? "Gerando…" : "Trocar QR"}
        </button>
        <dialog
          ref={confirmationDialogRef}
          className={styles.confirmationDialog}
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
          <h2 id={`${confirmationId}-title`}>
            Substituir QR de {playerLabel(slot.playerNumber)}?
          </h2>
          <p id={`${confirmationId}-description`}>
            O código atual deixará de funcionar. Descarte os cartões anteriores
            deste jogador.
          </p>
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
              disabled={disabled || pending}
            >
              {pending ? "Gerando…" : "Confirmar troca"}
            </button>
          </div>
        </dialog>
      </form>
      <ActionMessage state={state} />
      {state.ok && state.issuedCredentials?.length ? (
        <PlayerCredentialPrintSheet
          className={className}
          credentials={state.issuedCredentials}
          organizationName={organizationName}
          runtimeMode={runtimeMode}
        />
      ) : null}
    </div>
  );
}

function SessionControl({
  classGroupId,
  disabled,
  workflow,
}: {
  classGroupId: string;
  disabled: boolean;
  workflow: ClassWorkflowDto;
}) {
  const confirmationId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const confirmationDialogRef = useRef<HTMLDialogElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const active = workflow.activeSession;
  const action = active ? endClassSessionAction : startClassSessionAction;
  const [state, formAction, pending] = useActionState(
    action,
    initialActionState,
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
    setDialogOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <section
      className={`${styles.sessionControl} ${active ? styles.sessionControlActive : ""}`}
    >
      <span className={styles.sessionSignal} aria-hidden="true">
        <Icon name={active ? "play" : "pause"} />
      </span>
      <div className={styles.sessionControlCopy}>
        <h2>{active ? "Sessão em andamento" : "Nenhuma sessão ativa"}</h2>
        <p>
          {active
            ? `Iniciada às ${active.startedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}. Os jogadores com QR válido já podem entrar.`
            : "Inicie quando os tablets estiverem prontos. Antes disso, os jogadores verão uma tela de espera."}
        </p>
        <ActionMessage state={state} />
      </div>
      <div className={styles.sessionControlActions}>
        <button
          ref={triggerRef}
          className={active ? styles.buttonDanger : styles.button}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={dialogOpen}
          aria-controls={confirmationId}
          onClick={openConfirmation}
          disabled={disabled || pending}
        >
          <Icon name={active ? "archive" : "play"} />
          {pending
            ? active
              ? "Encerrando…"
              : "Iniciando…"
            : active
              ? "Encerrar sessão"
              : "Iniciar sessão"}
        </button>
        <dialog
          ref={confirmationDialogRef}
          className={`${styles.confirmationDialog} ${active ? styles.confirmationDialogWarning : ""}`}
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
          <h2 id={`${confirmationId}-title`}>
            {active ? "Encerrar sessão?" : "Iniciar sessão?"}
          </h2>
          <p id={`${confirmationId}-description`}>
            {active
              ? "Novas entradas de jogadores deixarão de ser aceitas."
              : "Jogadores com QR válido poderão entrar nesta sessão."}
          </p>
          <form action={formAction} onSubmit={closeConfirmation}>
            <input type="hidden" name="classGroupId" value={classGroupId} />
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
                className={active ? styles.buttonDanger : styles.button}
                type="submit"
                disabled={disabled || pending}
              >
                {pending
                  ? active
                    ? "Encerrando…"
                    : "Iniciando…"
                  : active
                    ? "Confirmar encerramento"
                    : "Confirmar início"}
              </button>
            </div>
          </form>
        </dialog>
      </div>
    </section>
  );
}

export function PlayerAccessWorkflow({
  classGroupId,
  className,
  disabled,
  organizationName,
  runtimeMode,
  workflow,
}: {
  classGroupId: string;
  className: string;
  disabled: boolean;
  organizationName: string;
  runtimeMode: RuntimeMode;
  workflow: ClassWorkflowDto;
}) {
  const [invalidatedSlotIds, setInvalidatedSlotIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const activeSlots = workflow.slots.filter(
    (slot) => slot.status === RecordStatus.ACTIVE,
  );

  return (
    <div className={styles.playerWorkflow}>
      <SessionControl
        classGroupId={classGroupId}
        disabled={disabled}
        workflow={workflow}
      />
      <AllocatePlayers
        classGroupId={classGroupId}
        className={className}
        disabled={disabled}
        organizationName={organizationName}
        runtimeMode={runtimeMode}
        invalidatedSlotIds={invalidatedSlotIds}
      />
      <section className={styles.playerDirectory}>
        <div className={styles.playerDirectoryHeader}>
          <div>
            <h2>Jogadores da turma</h2>
            <p>
              Cada número representa um acesso durável, sem nome, e-mail ou
              senha infantil.
            </p>
          </div>
          <span>{activeSlots.length} ativos</span>
        </div>
        {workflow.slots.length === 0 ? (
          <div className={styles.playerEmptyState}>
            <Icon name="users" />
            <div>
              <strong>Nenhum jogador numerado ainda</strong>
              <p>Crie os primeiros acessos e imprima os cartões de uma vez.</p>
            </div>
          </div>
        ) : (
          <div className={styles.playerList}>
            {workflow.slots.map((slot) => (
              <article className={styles.playerRow} key={slot.id}>
                <span className={styles.playerNumber} aria-hidden="true">
                  {String(slot.playerNumber).padStart(2, "0")}
                </span>
                <div>
                  <strong>{playerLabel(slot.playerNumber)}</strong>
                  <small>
                    {slot.credentialStatus === PlayerCredentialStatus.ACTIVE
                      ? "QR ativo"
                      : "Sem credencial ativa"}
                  </small>
                </div>
                <span
                  className={
                    slot.status === RecordStatus.ACTIVE &&
                    slot.credentialStatus === PlayerCredentialStatus.ACTIVE
                      ? styles.playerStatusActive
                      : styles.playerStatusInactive
                  }
                >
                  {slot.status !== RecordStatus.ACTIVE
                    ? "Inativo"
                    : slot.credentialStatus === PlayerCredentialStatus.ACTIVE
                      ? "QR ativo"
                      : "Sem QR"}
                </span>
                <RotateCredential
                  className={className}
                  disabled={disabled || slot.status !== RecordStatus.ACTIVE}
                  organizationName={organizationName}
                  runtimeMode={runtimeMode}
                  slot={slot}
                  onCredentialRotated={(slotId) =>
                    setInvalidatedSlotIds((previous) => {
                      if (previous.has(slotId)) return previous;
                      const next = new Set(previous);
                      next.add(slotId);
                      return next;
                    })
                  }
                />
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
