"use client";

import Link from "next/link";
import { useState } from "react";

import styles from "@/components/marketing/marketing.module.css";

export default function RecoverAccessPage() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <main className={styles.authPage}>
      <section className={styles.authArt}>
        <Link className={styles.brand} href="/portal">
          <span className={styles.brandMark}>MC</span>
          <span className={styles.brandCopy}>
            <strong>Missões do Caramelito</strong>
            <small>Programa Saúde na Escola</small>
          </span>
        </Link>
        <div className={styles.authQuote}>
          <h1>Recupere o acesso com segurança.</h1>
          <p>
            As instruções são enviadas apenas ao e-mail profissional cadastrado.
          </p>
        </div>
      </section>
      <section className={styles.authFormWrap}>
        <div className={styles.authForm}>
          <Link className={styles.brand} href="/entrar">
            <span className={styles.brandMark}>MC</span>
            <span className={styles.brandCopy}>
              <strong>Portal do profissional</strong>
              <small>Recuperação de acesso</small>
            </span>
          </Link>
          <h2>Redefinir senha.</h2>
          <p>
            Informe seu e-mail profissional para receber as próximas instruções.
          </p>

          {submitted ? (
            <div style={{ marginTop: "1rem" }}>
              <p
                role="status"
                style={{
                  margin: "0 0 16px",
                  color: "var(--green-dark, #26713a)",
                  fontWeight: 600,
                  fontSize: "0.95rem",
                }}
              >
                Demonstração: se o e-mail existisse, as instruções seriam
                enviadas.
              </p>
              <Link
                className={styles.submit}
                href="/entrar"
                style={{
                  display: "inline-block",
                  textAlign: "center",
                  textDecoration: "none",
                }}
              >
                Voltar para o início
              </Link>
            </div>
          ) : (
            <form className={styles.form} onSubmit={handleSubmit}>
              <label className={styles.field}>
                E-mail profissional
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="profissional@exemplo.gov.br"
                  required
                />
              </label>
              <button className={styles.submit} type="submit">
                Enviar instruções
              </button>
            </form>
          )}

          <p className={styles.authHelp}>
            <Link href="/entrar">← Voltar para o login</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
