"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

import { Icon } from "@/components/shared/icon";

import styles from "./portal.module.css";

export function ShareActions({ url }: { url: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function generate() {
      try {
        const isValidUrl = (() => {
          try {
            const u = new URL(url);
            return u.protocol === "http:" || u.protocol === "https:";
          } catch {
            return false;
          }
        })();
        if (!isValidUrl || url.includes(" ") || url.includes("(copie")) {
          setQrDataUrl(null);
          return;
        }
        const dataUrl = await QRCode.toDataURL(url, {
          width: 320,
          margin: 2,
          errorCorrectionLevel: "M",
          color: { dark: "#23402e", light: "#ffffff" },
        });
        if (!cancelled) setQrDataUrl(dataUrl);
      } catch {
        if (!cancelled) setQrDataUrl(null);
      }
    }
    generate();
    return () => {
      cancelled = true;
    };
  }, [url]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Link copiado para a área de transferência.");
    } catch {
      setMessage(
        "Não foi possível copiar automaticamente. Selecione o link acima.",
      );
    }
  }

  async function downloadQr() {
    try {
      // Real QR code generated locally from the URL without sending it to
      // any external service. Uses the `qrcode` library to encode the URL
      // as a standards-compliant QR (ISO 18004) via a local canvas/data URL
      // so the download is scannable, reproducible per link, and works
      // offline. No network request is made and the URL never leaves the
      // browser.
      const dataUrl = await QRCode.toDataURL(url, {
        width: 320,
        margin: 2,
        errorCorrectionLevel: "M",
        color: {
          dark: "#23402e",
          light: "#ffffff",
        },
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      // Derive a safe filename from the URL tail.
      const slug =
        url
          .split("/")
          .pop()
          ?.replace(/[^a-zA-Z0-9-_]/g, "") ?? "qr";
      a.download = `qr-${slug}.png`;
      a.click();
      setMessage("QR code gerado localmente e download iniciado.");
    } catch {
      setMessage(
        "Não foi possível gerar o QR code localmente. Copie o link acima.",
      );
    }
  }

  return (
    <>
      {qrDataUrl ? (
        <div className={styles.qrCode} aria-label="QR code do link">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt="QR code"
            width={184}
            height={184}
            style={{ width: "184px", height: "184px", borderRadius: 12 }}
          />
        </div>
      ) : (
        <div className={styles.qrCode} aria-label="QR code indisponível">
          <span
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              textAlign: "center",
              padding: 8,
            }}
          >
            QR disponível apenas com link válido (token de 43 caracteres)
          </span>
        </div>
      )}
      <div className={styles.shareUrl}>
        <code>{url}</code>
        <button type="button" aria-label="Copiar link" onClick={copyLink}>
          <Icon name="copy" />
        </button>
      </div>
      <div className={styles.shareActions}>
        <button
          className={styles.buttonSecondary}
          type="button"
          onClick={downloadQr}
          disabled={!qrDataUrl}
        >
          <Icon name="download" /> Baixar QR
        </button>
        <button className={styles.button} type="button" onClick={copyLink}>
          <Icon name="link" /> Copiar link
        </button>
      </div>
      {message && (
        <div className={styles.toast} role="status">
          <Icon name="check" />
          {message}
        </div>
      )}
    </>
  );
}
