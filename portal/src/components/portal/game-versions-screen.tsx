"use client";

import { useActionState } from "react";

import type { ActionResult } from "@/application/adult-portal/types";
import type { GameManifestsPageData } from "@/runtime/readers";
import {
  importGameManifestAction,
  setCurrentGameManifestAction,
} from "@/runtime/actions";
import { Icon } from "@/components/shared/icon";

import { ActionMessage } from "./action-message";
import { PageHeader } from "./page-header";
import { PortalState } from "./portal-state";
import styles from "./portal.module.css";

const initialState: ActionResult = { ok: false, message: "" };

function formatImportedAt(value: Date | string): string {
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });
}

export function GameVersionsScreen({
  manifests,
}: {
  manifests: GameManifestsPageData["manifests"];
}) {
  // One stable action for both buttons; each form says what it wants.
  const [state, formAction, pending] = useActionState(
    (previous: ActionResult, formData: FormData) =>
      formData.get("intent") === "import"
        ? importGameManifestAction(previous, formData)
        : setCurrentGameManifestAction(previous, formData),
    initialState,
  );

  return (
    <>
      <PageHeader
        eyebrow="Estrutura da plataforma"
        title="Versões do jogo"
        description="Importe o conteúdo publicado pelo jogo e escolha qual versão as próximas sessões usam. Sessões em andamento mantêm a versão com que começaram."
        actions={
          <form action={formAction}>
            <input type="hidden" name="intent" value="import" />
            <button className={styles.button} type="submit" disabled={pending}>
              <Icon name="archive" />
              {pending ? "Processando…" : "Importar do jogo configurado"}
            </button>
          </form>
        }
      />
      <ActionMessage state={state} />
      {manifests.length === 0 ? (
        <PortalState
          icon="archive"
          headingLevel={2}
          title="Nenhuma versão importada"
          description="Importe o conteúdo do jogo configurado para que as turmas possam iniciar sessões."
        />
      ) : (
        <ul className={styles.gameVersionList} aria-label="Versões importadas">
          {manifests.map((manifest) => (
            <li
              key={manifest.id}
              className={`${styles.gameVersionRow} ${manifest.isCurrent ? styles.gameVersionCurrent : ""}`}
            >
              <div className={styles.gameVersionMain}>
                <strong>Conteúdo {manifest.contentVersion}</strong>
                {manifest.isCurrent && (
                  <span
                    className={`${styles.statusBadge} ${styles.statusPositive}`}
                  >
                    Atual
                  </span>
                )}
              </div>
              <dl className={styles.gameVersionMeta}>
                <div>
                  <dt>Build</dt>
                  <dd>{manifest.buildId}</dd>
                </div>
                <div>
                  <dt>Commit</dt>
                  <dd>{manifest.sourceCommit ?? "Não informado"}</dd>
                </div>
                <div>
                  <dt>Importada em</dt>
                  <dd>{formatImportedAt(manifest.importedAt)}</dd>
                </div>
              </dl>
              {!manifest.isCurrent && (
                <form action={formAction}>
                  <input type="hidden" name="intent" value="set-current" />
                  <input type="hidden" name="manifestId" value={manifest.id} />
                  <button
                    className={styles.buttonSecondary}
                    type="submit"
                    disabled={pending}
                  >
                    Tornar atual
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
