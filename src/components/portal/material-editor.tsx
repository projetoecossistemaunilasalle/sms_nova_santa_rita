"use client";

import Link from "next/link";
import { useState } from "react";

import type {
  MaterialStatus,
  MaterialSummary,
} from "@/server/services/portal-view-service";
import { Icon } from "@/components/shared/icon";

import { StatusBadge } from "./status-badge";
import styles from "./portal.module.css";

const emptyMaterial = {
  title: "",
  summary: "",
  type: "Guia",
  theme: "Convivência",
  audience: "Professores",
  status: "Rascunho" as MaterialStatus,
  body: "",
};

export function MaterialEditor({ material }: { material?: MaterialSummary }) {
  const [form, setForm] = useState(material ?? emptyMaterial);
  const [cover, setCover] = useState("");
  const [attachment, setAttachment] = useState("");
  const [preview, setPreview] = useState(false);
  const [notice, setNotice] = useState("");

  function setField(field: keyof typeof emptyMaterial, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3600);
  }

  function saveAs(status: MaterialStatus) {
    setForm((current) => ({ ...current, status }));
    showNotice(
      status === "Publicado"
        ? "Publicado apenas nesta demonstração. Nada foi gravado no servidor."
        : "Rascunho mantido apenas nesta demonstração. Nada foi gravado no servidor.",
    );
  }

  return (
    <>
      <div className={styles.editorLayout}>
        <section className={styles.editorPaper}>
          <div className={styles.editorHeading}>
            <div>
              <p className={styles.eyebrow}>Conteúdo</p>
              <h2>Informações do material</h2>
            </div>
            <StatusBadge status={form.status} />
          </div>

          <div className={styles.formGrid}>
            <label className={`${styles.field} ${styles.fieldFull}`}>
              <span>Título</span>
              <input
                className={styles.input}
                value={form.title}
                onChange={(event) => setField("title", event.target.value)}
                placeholder="Título que aparecerá na biblioteca"
              />
            </label>
            <label className={`${styles.field} ${styles.fieldFull}`}>
              <span>Resumo</span>
              <textarea
                className={`${styles.textarea} ${styles.textareaShort}`}
                value={form.summary}
                onChange={(event) => setField("summary", event.target.value)}
                placeholder="Explique em poucas linhas como este material ajuda"
              />
            </label>
            <label className={styles.field}>
              <span>Tipo</span>
              <select
                className={styles.select}
                value={form.type}
                onChange={(event) => setField("type", event.target.value)}
              >
                <option>Guia</option>
                <option>Material pedagógico</option>
                <option>Artigo</option>
                <option>Comunicado</option>
                <option>Atividade</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>Tema</span>
              <select
                className={styles.select}
                value={form.theme}
                onChange={(event) => setField("theme", event.target.value)}
              >
                <option>Convivência</option>
                <option>Alimentação</option>
                <option>Prevenção</option>
                <option>Saúde emocional</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>Público</span>
              <select
                className={styles.select}
                value={form.audience}
                onChange={(event) => setField("audience", event.target.value)}
              >
                <option>Professores</option>
                <option>Famílias</option>
                <option>Todos</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>Estado</span>
              <select
                className={styles.select}
                value={form.status}
                onChange={(event) => setField("status", event.target.value)}
              >
                <option>Rascunho</option>
                <option>Publicado</option>
                <option>Arquivado</option>
              </select>
            </label>
          </div>

          <label className={styles.field}>
            <span>Corpo do conteúdo</span>
            <textarea
              className={`${styles.textarea} ${styles.contentTextarea}`}
              value={form.body}
              onChange={(event) => setField("body", event.target.value)}
              placeholder="Escreva orientações, perguntas e passos para a atividade..."
            />
            <small className={styles.fieldHelp}>
              {form.body.length} caracteres · editor simplificado para a
              demonstração
            </small>
          </label>
        </section>

        <aside className={styles.editorSidebar}>
          <section className={styles.uploadPanel}>
            <div className={styles.uploadArt}>
              <Icon name="upload" />
            </div>
            <h3>Capa do material</h3>
            <p>PNG ou JPG em formato horizontal.</p>
            <label className={styles.buttonGhost}>
              <input
                type="file"
                accept="image/*"
                onChange={(event) =>
                  setCover(event.target.files?.[0]?.name ?? "")
                }
              />
              <Icon name="upload" /> {cover || "Escolher imagem"}
            </label>
          </section>
          <section className={styles.attachmentPanel}>
            <span>
              <Icon name="paperclip" />
            </span>
            <div>
              <h3>Anexos</h3>
              <p>{attachment || "Inclua um PDF ou arquivo de apoio."}</p>
            </div>
            <label className={styles.iconButton} aria-label="Escolher anexo">
              <input
                type="file"
                onChange={(event) =>
                  setAttachment(event.target.files?.[0]?.name ?? "")
                }
              />
              <Icon name="plus" />
            </label>
          </section>
          <div className={styles.demoNotice}>
            <Icon name="alert" />
            <p>
              Alterações ficam somente nesta sessão de demonstração e serão
              descartadas ao recarregar.
            </p>
          </div>
        </aside>
      </div>

      <footer className={styles.stickyEditorActions}>
        <Link className={styles.buttonGhost} href="/portal/materiais">
          Cancelar
        </Link>
        <div>
          <button
            className={styles.buttonGhost}
            type="button"
            onClick={() => setPreview(true)}
          >
            <Icon name="external" /> Visualizar
          </button>
          <button
            className={styles.buttonSecondary}
            type="button"
            onClick={() => saveAs("Rascunho")}
          >
            Salvar rascunho
          </button>
          <button
            className={styles.button}
            type="button"
            onClick={() => saveAs("Publicado")}
          >
            <Icon name="check" /> Publicar
          </button>
        </div>
      </footer>

      {preview && (
        <div
          className={styles.previewBackdrop}
          role="presentation"
          onMouseDown={() => setPreview(false)}
        >
          <article
            className={styles.materialPreview}
            role="dialog"
            aria-modal="true"
            aria-label="Pré-visualização do material"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className={styles.previewClose}
              type="button"
              onClick={() => setPreview(false)}
              aria-label="Fechar pré-visualização"
            >
              <Icon name="close" />
            </button>
            <p className={styles.eyebrow}>
              {form.theme} · {form.audience}
            </p>
            <h2>{form.title || "Material sem título"}</h2>
            <p className={styles.previewSummary}>
              {form.summary ||
                "Adicione um resumo para apresentar este material."}
            </p>
            <div className={styles.previewBody}>
              {form.body || "O conteúdo aparecerá aqui."}
            </div>
          </article>
        </div>
      )}
      {notice && (
        <div className={styles.toast} role="status">
          <Icon name="check" /> {notice}
        </div>
      )}
    </>
  );
}
