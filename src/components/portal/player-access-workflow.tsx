"use client";

import { useActionState, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";

import type {
  ClassWorkflowDto,
  PlayerAccessActionResult,
  PlayerSlotDto,
} from "@/application/player-access/types";
import { PlayerCredentialStatus, RecordStatus } from "@/generated/prisma/enums";
import type { RuntimeMode } from "@/runtime/mode";
import {
  allocatePlayerSlotsAction,
  endClassSessionAction,
  rotatePlayerCredentialAction,
  showClassPlayerCredentialsAction,
  startClassSessionAction,
} from "@/runtime/actions";
import { Icon } from "@/components/shared/icon";
import { printablePlayerCredentials } from "./player-credential-printing";
import { matchesPlayerNumber } from "./portal-filters";
import { usePortalFilters } from "./use-portal-filters";

import { PlayerCredentialPrintSheet } from "./player-credential-print-sheet";
import styles from "./portal.module.css";

const initialActionState: PlayerAccessActionResult = { ok: false, message: "" };

function playerLabel(playerNumber: number): string {
  return `Jogador ${String(playerNumber).padStart(2, "0")}`;
}

function ActionMessage({ state }: { state: PlayerAccessActionResult }) {
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

function AllocatePlayers({
  classGroupId,
  className,
  disabled,
  organizationName,
  runtimeMode,
  invalidatedSlotIds,
  onPlayersAllocated,
  hasPlayers,
}: {
  classGroupId: string;
  className: string;
  disabled: boolean;
  organizationName: string;
  runtimeMode: RuntimeMode;
  invalidatedSlotIds: ReadonlySet<string>;
  onPlayersAllocated: () => void;
  hasPlayers: boolean;
}) {
  const [expanded, setExpanded] = useState(!hasPlayers);
  const [count, setCount] = useState("");
  const [state, formAction, pending] = useActionState(
    async (previousState: PlayerAccessActionResult, formData: FormData) => {
      const nextState = await allocatePlayerSlotsAction(
        previousState,
        formData,
      );
      if (nextState.ok) {
        onPlayersAllocated();
        setCount("");
      }
      return nextState;
    },
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
    <details
      className={styles.creationDisclosure}
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>
        {hasPlayers ? "Adicionar jogadores" : "Preparar os primeiros jogadores"}
        <Icon name="plus" />
      </summary>
      <section className={styles.playerAllocationPanel}>
        <div>
          <h2>Adicionar jogadores numerados</h2>
          <p>
            Adicione apenas quem ainda não tem um número. Quem já jogou usa o
            mesmo cartão nas próximas sessões. Números antigos nunca são
            reutilizados.
          </p>
        </div>
        <form action={formAction} className={styles.playerAllocationForm}>
          <input type="hidden" name="classGroupId" value={classGroupId} />
          <label className={styles.field}>
            <span>Quantos novos jogadores?</span>
            <input
              className={styles.input}
              type="number"
              name="count"
              min="1"
              max="100"
              inputMode="numeric"
              placeholder="De 1 a 100"
              value={count}
              onChange={(event) => setCount(event.target.value)}
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
    </details>
  );
}

function ClassCredentials({
  classGroupId,
  className,
  disabled,
  organizationName,
  runtimeMode,
  playerQuery,
}: {
  classGroupId: string;
  className: string;
  disabled: boolean;
  organizationName: string;
  runtimeMode: RuntimeMode;
  playerQuery: string;
}) {
  const [state, formAction, pending] = useActionState(
    showClassPlayerCredentialsAction,
    initialActionState,
  );
  const [hidden, setHidden] = useState(false);
  const credentials = (state.issuedCredentials ?? []).filter((item) =>
    matchesPlayerNumber(item.playerNumber, playerQuery),
  );
  const unavailable = (state.unavailablePlayerNumbers ?? []).filter((number) =>
    matchesPlayerNumber(number, playerQuery),
  );
  const hasCredentials = state.ok && credentials.length > 0;

  return (
    <div className={styles.classCredentials}>
      <form
        action={formAction}
        onSubmit={() => setHidden(false)}
        className={styles.classCredentialsActions}
      >
        <input type="hidden" name="classGroupId" value={classGroupId} />
        <button
          className={styles.buttonSecondary}
          type="submit"
          disabled={disabled || pending}
        >
          <Icon name="grid" />
          {pending
            ? "Carregando QR codes…"
            : playerQuery.trim()
              ? "Exibir QR deste jogador"
              : "Exibir QR codes da turma"}
        </button>
        {hasCredentials && !hidden && (
          <button
            className={styles.buttonGhost}
            type="button"
            onClick={() => setHidden(true)}
          >
            Ocultar QR codes
          </button>
        )}
        <p>Consulte ou imprima novamente, sem trocar os códigos.</p>
      </form>
      <ActionMessage
        state={
          state.ok
            ? {
                ok: true,
                message:
                  credentials.length === 1
                    ? "1 cartão disponível para esta seleção."
                    : `${credentials.length} cartões disponíveis para esta seleção.`,
              }
            : state
        }
      />
      {state.ok && unavailable.length > 0 && (
        <p className={styles.inlineWarning} role="status">
          Sem QR recuperável: {unavailable.map(playerLabel).join(", ")}. Códigos
          antigos, se houver, continuam válidos, mas não podem ser recuperados.{" "}
          Para emitir um cartão recuperável, use “Trocar QR” no jogador. Essa
          troca invalida o cartão anterior.
        </p>
      )}
      {hasCredentials && !hidden && (
        <PlayerCredentialPrintSheet
          className={className}
          credentials={credentials}
          organizationName={organizationName}
          runtimeMode={runtimeMode}
        />
      )}
    </div>
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
            deste jogador. O número e o progresso serão mantidos. Para apenas
            reimprimir, cancele e use “Exibir QR deste jogador” na busca por
            número.
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
  const hasReadyPlayers = workflow.slots.some(
    (slot) =>
      slot.status === RecordStatus.ACTIVE &&
      slot.credentialStatus === PlayerCredentialStatus.ACTIVE,
  );
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
            ? `Iniciada em ${active.startedAt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })}. Os jogadores com QR válido já podem entrar.`
            : hasReadyPlayers
              ? "Inicie quando os tablets estiverem prontos. Antes disso, os jogadores verão uma tela de espera."
              : "Prepare pelo menos um jogador com QR ativo antes de iniciar a sessão."}
        </p>
        <ActionMessage state={state} />
      </div>
      <div className={styles.sessionControlActions}>
        {active ? (
          <button
            ref={triggerRef}
            className={styles.buttonDanger}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={dialogOpen}
            aria-controls={confirmationId}
            onClick={openConfirmation}
            disabled={disabled || pending}
          >
            <Icon name="archive" />
            {pending ? "Encerrando…" : "Encerrar sessão"}
          </button>
        ) : (
          <form action={formAction}>
            <input type="hidden" name="classGroupId" value={classGroupId} />
            <button
              className={styles.button}
              type="submit"
              disabled={disabled || pending || !hasReadyPlayers}
            >
              <Icon name="play" />
              {pending ? "Iniciando…" : "Iniciar sessão"}
            </button>
          </form>
        )}
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
          <h2 id={`${confirmationId}-title`}>Encerrar sessão?</h2>
          <p id={`${confirmationId}-description`}>
            Novas entradas de jogadores deixarão de ser aceitas.
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
                className={styles.buttonDanger}
                type="submit"
                disabled={disabled || pending}
              >
                {pending ? "Encerrando…" : "Confirmar encerramento"}
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
  const { params, setFilters } = usePortalFilters();
  const playerQuery = params.get("player") ?? "";
  const visibleSlots = workflow.slots.filter((slot) =>
    matchesPlayerNumber(slot.playerNumber, playerQuery),
  );
  const [invalidatedSlotIds, setInvalidatedSlotIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [credentialRevision, setCredentialRevision] = useState(0);
  const classCredentialKey = JSON.stringify([
    classGroupId,
    disabled,
    credentialRevision,
    playerQuery,
    workflow.slots.map((slot) => [
      slot.id,
      slot.status,
      slot.credentialId,
      slot.credentialStatus,
    ]),
  ]);
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
        hasPlayers={workflow.slots.length > 0}
        classGroupId={classGroupId}
        className={className}
        disabled={disabled}
        organizationName={organizationName}
        runtimeMode={runtimeMode}
        invalidatedSlotIds={invalidatedSlotIds}
        onPlayersAllocated={() =>
          setCredentialRevision((revision) => revision + 1)
        }
      />
      <section className={styles.playerDirectory}>
        <div className={styles.playerDirectoryHeader}>
          <div>
            <h2>Jogadores da turma</h2>
            <p>
              Mantenha o mesmo número para cada jogador. Consulte os cartões
              abaixo ou abra os resultados de um jogador.
            </p>
          </div>
          <span>{activeSlots.length} ativos</span>
        </div>
        {workflow.slots.length > 0 && (
          <div
            className={`${styles.directoryToolbar} ${styles.playerSearchToolbar}`}
          >
            <label className={styles.field}>
              <span>Número do jogador</span>
              <input
                className={styles.input}
                type="search"
                inputMode="numeric"
                placeholder="Ex.: 07"
                value={playerQuery}
                onChange={(event) => setFilters({ player: event.target.value })}
              />
            </label>
            <span role="status">
              {visibleSlots.length} de {workflow.slots.length} jogadores
            </span>
            {playerQuery && (
              <button
                className={styles.buttonGhost}
                type="button"
                onClick={() => setFilters({ player: "" })}
              >
                Limpar busca
              </button>
            )}
          </div>
        )}
        {visibleSlots.some((slot) => slot.status === RecordStatus.ACTIVE) && (
          <ClassCredentials
            key={classCredentialKey}
            classGroupId={classGroupId}
            className={className}
            disabled={disabled}
            organizationName={organizationName}
            runtimeMode={runtimeMode}
            playerQuery={playerQuery}
          />
        )}
        {workflow.slots.length === 0 ? (
          <div className={styles.playerEmptyState}>
            <Icon name="users" />
            <div>
              <strong>Nenhum jogador numerado ainda</strong>
              <p>Crie os primeiros acessos e imprima os cartões de uma vez.</p>
            </div>
          </div>
        ) : visibleSlots.length === 0 ? (
          <div className={styles.playerEmptyState}>
            <Icon name="search" />
            <div>
              <strong>Nenhum jogador com esse número</strong>
              <p>
                Confira o número do cartão ou limpe a busca para ver toda a
                turma.
              </p>
            </div>
          </div>
        ) : (
          <div className={styles.playerList}>
            {visibleSlots.map((slot) => (
              <article className={styles.playerRow} key={slot.id}>
                <span className={styles.playerNumber} aria-hidden="true">
                  {String(slot.playerNumber).padStart(2, "0")}
                </span>
                <div>
                  <Link
                    className={styles.playerResultLink}
                    href={`/portal/resultados/${classGroupId}/players/${slot.id}`}
                  >
                    <strong>{playerLabel(slot.playerNumber)}</strong>
                    <small>Ver resultados</small>
                  </Link>
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
                  onCredentialRotated={(slotId) => {
                    setCredentialRevision((revision) => revision + 1);
                    setInvalidatedSlotIds((previous) => {
                      if (previous.has(slotId)) return previous;
                      const next = new Set(previous);
                      next.add(slotId);
                      return next;
                    });
                  }}
                />
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
