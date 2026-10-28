"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

import type { IssuedCredentialDto } from "@/application/player-access/types";
import type { RuntimeMode } from "@/runtime/mode";
import { Icon } from "@/components/shared/icon";
import {
  cardsForPlayerCredentialBatch,
  playerCredentialBatchKey,
} from "./player-credential-printing";

import styles from "./portal.module.css";

function playerLabel(playerNumber: number): string {
  return `Jogador ${String(playerNumber).padStart(2, "0")}`;
}

function CopyEntryLinkButton({ url }: { url: string }) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");

  useEffect(() => {
    if (state !== "copied") return;
    const timer = window.setTimeout(() => setState("idle"), 2500);
    return () => window.clearTimeout(timer);
  }, [state]);

  return (
    <div className={styles.credentialLink}>
      <button
        className={styles.buttonSecondary}
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setState("copied");
          } catch {
            setState("manual");
          }
        }}
      >
        <Icon name={state === "copied" ? "check" : "copy"} />
        {state === "copied" ? "Link copiado" : "Copiar link de entrada"}
      </button>
      {state === "manual" ? (
        <input
          aria-label="Link de entrada do jogador"
          readOnly
          value={url}
          onFocus={(event) => event.currentTarget.select()}
          autoFocus
        />
      ) : (
        <small>Para enviar por WhatsApp ou e-mail e jogar em casa.</small>
      )}
    </div>
  );
}

function playerEntryUrl(token: string): string {
  const basePath = process.env.APP_BASE_PATH ?? "";
  const url = new URL(`${basePath}/jogar/`, window.location.origin);
  url.searchParams.set("cred", token);
  return url.toString();
}

export function PlayerCredentialPrintSheet({
  className,
  credentials,
  organizationName,
  runtimeMode,
}: {
  className: string;
  credentials: IssuedCredentialDto[];
  organizationName: string;
  runtimeMode: RuntimeMode;
}) {
  const batchKey = playerCredentialBatchKey(credentials);
  const [generatedBatch, setGeneratedBatch] = useState<{
    key: string;
    cards: Array<IssuedCredentialDto & { url: string; qrDataUrl: string }>;
  } | null>(null);
  const [qrErrorBatchKey, setQrErrorBatchKey] = useState<string | null>(null);
  const printSheetRef = useRef<HTMLDivElement>(null);
  const printCards = cardsForPlayerCredentialBatch(batchKey, generatedBatch);
  const qrError = qrErrorBatchKey === batchKey;

  useEffect(() => {
    let cancelled = false;

    async function generateQrCodes() {
      try {
        const generated = await Promise.all(
          credentials.map(async (credential) => {
            const url = playerEntryUrl(credential.token);
            const qrDataUrl = await QRCode.toDataURL(url, {
              width: 460,
              margin: 2,
              errorCorrectionLevel: "M",
              color: { dark: "#000000", light: "#ffffff" },
            });
            return { ...credential, url, qrDataUrl };
          }),
        );
        if (!cancelled) {
          setGeneratedBatch({ key: batchKey, cards: generated });
          setQrErrorBatchKey(null);
        }
      } catch {
        if (!cancelled) setQrErrorBatchKey(batchKey);
      }
    }

    void generateQrCodes();
    return () => {
      cancelled = true;
    };
  }, [batchKey, credentials]);

  return (
    <section className={styles.issuedCredentials} aria-live="polite">
      <div className={styles.issuedCredentialsHeader}>
        <div>
          <h3>Credenciais prontas para imprimir</h3>
          <p>
            Estes mesmos códigos podem ser consultados novamente em “Exibir QR
            codes da turma”. Reimprimir não invalida os cartões anteriores.
          </p>
        </div>
        <button
          className={styles.buttonSecondary}
          type="button"
          onClick={() => {
            const sheet = printSheetRef.current;
            if (!sheet) return;
            document
              .querySelectorAll("[data-player-print-sheet]")
              .forEach((item) =>
                item.removeAttribute("data-player-print-active"),
              );
            sheet.setAttribute("data-player-print-active", "");
            window.addEventListener(
              "afterprint",
              () => sheet.removeAttribute("data-player-print-active"),
              { once: true },
            );
            window.print();
          }}
          disabled={printCards.length !== credentials.length}
        >
          <Icon name="download" />
          {credentials.length > 1 ? "Imprimir todos" : "Imprimir credencial"}
        </button>
      </div>

      <div
        className={styles.printSheet}
        data-player-print-sheet
        ref={printSheetRef}
      >
        {printCards.length === 0 && !qrError && (
          <p className={styles.qrPreparing} role="status">
            Preparando os QR codes…
          </p>
        )}
        {qrError && (
          <p className={styles.formError} role="alert">
            Não foi possível preparar os QR codes. Atualize a página e use
            “Exibir QR codes da turma” para tentar novamente, sem trocar as
            credenciais.
          </p>
        )}
        {printCards.map((credential) => (
          <article
            className={styles.credentialPrintCard}
            key={credential.playerSlotId}
          >
            {runtimeMode === "demo" && (
              <span className={styles.demoCredentialMark}>
                DEMONSTRAÇÃO • SEM VALIDADE EM PRODUÇÃO
              </span>
            )}
            <div className={styles.credentialPrintHeading}>
              <span>Missões do Caramelito</span>
              <strong>{playerLabel(credential.playerNumber)}</strong>
              <small>
                {className} • {organizationName}
              </small>
            </div>
            {/* Generated locally; no credential is sent to an image service. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={credential.qrDataUrl} alt="" width={230} height={230} />
            <CopyEntryLinkButton url={credential.url} />
            <p>Aponte a câmera do tablet para entrar. Não é preciso digitar.</p>
            <span className={styles.credentialPrivacy}>
              Este cartão dá acesso ao jogador numerado. Guarde-o em local
              seguro.
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}
