"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Icon } from "@/components/shared/icon";
import { ShareActions } from "./share-actions";
import styles from "./portal.module.css";

export function AccessLinkBuilder({
  editing = false,
  linkId,
  initialLabel,
  initialAudience,
  initialExpiration,
  initialExpiresAt,
}: {
  editing?: boolean;
  linkId?: string;
  initialLabel?: string;
  initialAudience?: string;
  initialExpiration?: string;
  initialExpiresAt?: string;
}) {
  const router = useRouter();
  const [createdState, setCreatedState] = useState<{
    status: "idle" | "success";
    linkId: string;
    label: string;
    audience: string;
    token: string;
  }>({
    status: "idle",
    linkId: linkId ?? "turma-5b",
    label: initialLabel ?? (editing ? "Link principal" : "Turma 5B"),
    audience:
      initialAudience ??
      (editing
        ? "Todas as turmas · EMEF Victor Aggens"
        : "Turma 5B · EMEF Victor Aggens"),
    token: "7FQ-29M",
  });

  const [label, setLabel] = useState(
    initialLabel ?? (editing ? "Link principal" : "Turma 5B"),
  );
  const [audience, setAudience] = useState(
    initialAudience ??
      (editing
        ? "Todas as turmas · EMEF Victor Aggens"
        : "Turma 5B · EMEF Victor Aggens"),
  );
  const [expiration, setExpiration] = useState(initialExpiration ?? "never");
  const [customDate, setCustomDate] = useState(initialExpiresAt ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      router.push(`/portal/atividades/${linkId ?? "turma-5b"}`);
    } else {
      const demoToken = `MC-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      setCreatedState({
        status: "success",
        linkId: "turma-5b",
        label,
        audience,
        token: demoToken,
      });
    }
  };

  if (!editing && createdState.status === "success") {
    return (
      <div className={styles.shareLayout}>
        <article className={styles.successPanel} aria-live="polite">
          <span className={styles.successMark}>
            <Icon name="check" />
          </span>
          <h1>Link criado</h1>
          <p>
            {createdState.label} · {createdState.audience}
          </p>
          <div className={styles.linkCard}>
            <code>{createdState.token}</code>
            <div className={styles.linkMeta}>
              <span>Token de acesso</span>
              <span>exibido apenas uma vez</span>
            </div>
          </div>
          <div
            className={styles.contextNotice}
            style={{
              marginTop: 12,
              background: "var(--warning-bg, #fff8e1)",
              border: "1px solid #ffe082",
            }}
          >
            <Icon name="shield" />
            <span>Demonstração: este token foi gerado no seu navegador.</span>
          </div>
          <div style={{ marginTop: 18 }}>
            <Link
              className={styles.buttonSecondary}
              href={`/portal/atividades/${createdState.linkId}`}
            >
              Ver link criado
            </Link>
          </div>
        </article>

        <aside className={styles.shareCard}>
          <h2>Compartilhar com a turma</h2>
          <p>Use o QR code em sala ou envie o link pelos canais da escola.</p>
          <ShareActions
            url={`https://niciniv.github.io/SMS_Portal/atividade/${createdState.token}`}
          />
        </aside>
      </div>
    );
  }

  return (
    <div className={styles.builderLayout}>
      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>
          {editing
            ? "Ajuste este link de acesso."
            : "Crie um link para esta atividade."}
        </h2>
        <p className={styles.panelDescription}>
          O jogo é o mesmo para todas as turmas. O link só organiza o acesso e
          separa as sessões nos resultados.
        </p>

        <form onSubmit={handleSubmit}>
          <div className={styles.formGrid}>
            <label className={`${styles.field} ${styles.fieldFull}`}>
              <span>Nome do link</span>
              <input
                className={styles.input}
                name="label"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Ex.: Turma 5B"
                required
                maxLength={200}
              />
              <small className={styles.fieldHelp}>
                Um nome curto para você reconhecer este acesso no portal.
              </small>
            </label>
            <label className={`${styles.field} ${styles.fieldFull}`}>
              <span>Turma ou grupo</span>
              <input
                className={styles.input}
                name="audience"
                value={audience}
                onChange={(event) => setAudience(event.target.value)}
                placeholder="Ex.: Turma 5B · EMEF Victor Aggens"
                required
                maxLength={200}
              />
            </label>
            <label className={`${styles.field} ${styles.fieldFull}`}>
              <span>Expiração do link</span>
              <select
                className={styles.input}
                name="expiration"
                value={expiration}
                onChange={(event) => setExpiration(event.target.value)}
              >
                <option value="never">Sem expiração</option>
                <option value="week">Em 7 dias</option>
                <option value="month">Em 30 dias</option>
                <option value="date">Escolher uma data</option>
              </select>
            </label>
            {expiration === "date" && (
              <label className={`${styles.field} ${styles.fieldFull}`}>
                <span>Data de expiração</span>
                <input
                  className={styles.input}
                  type="date"
                  name="expiresAt"
                  value={customDate}
                  onChange={(event) => setCustomDate(event.target.value)}
                  required={expiration === "date"}
                />
                <small className={styles.fieldHelp}>
                  Escolha uma data futura. O link expirará às 23:59 do dia
                  selecionado.
                </small>
              </label>
            )}
          </div>

          <div className={styles.contextNotice} style={{ marginTop: 18 }}>
            <Icon name="shield" />
            <span>
              Participantes entram pelo link personalizado e não acessam o
              portal profissional. Nenhum nome ou e-mail é solicitado.
            </span>
          </div>

          <footer className={styles.builderFooter}>
            <span className={styles.savedState}>
              <Icon name="check" /> Demonstração visual
            </span>
            <div>
              <button
                className={styles.buttonGhost}
                type="button"
                onClick={() => router.back()}
              >
                Cancelar
              </button>
              <button className={styles.button} type="submit">
                {editing ? "Salvar link" : "Criar link"} <Icon name="arrow" />
              </button>
            </div>
          </footer>
        </form>
      </section>

      <aside className={styles.sidePanel}>
        <div className={styles.sidePanelArt}>
          <span className={styles.sidePanelBadge}>MC</span>
        </div>
        <div className={styles.sidePanelBody}>
          <h3>Resumo do acesso</h3>
          <div className={styles.summaryList}>
            <div className={styles.summaryLine}>
              <span>Experiência</span>
              <strong>Missões do Caramelito</strong>
            </div>
            <div className={styles.summaryLine}>
              <span>Destino</span>
              <strong>Jogo GameMaker</strong>
            </div>
            <div className={styles.summaryLine}>
              <span>Identificação</span>
              <strong>Anônima</strong>
            </div>
            <div className={styles.summaryLine}>
              <span>Expiração</span>
              <strong>
                {expiration === "never" ? "Sem expiração" : "Definida no link"}
              </strong>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
