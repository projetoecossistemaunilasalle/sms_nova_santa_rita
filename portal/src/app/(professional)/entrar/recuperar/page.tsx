import Link from "next/link";

import { RequestResetForm } from "@/components/auth/password-reset-forms";
import styles from "@/components/marketing/marketing.module.css";
import { getRuntimeMode } from "@/runtime/mode";

export default function RecoverAccessPage() {
  const demo = getRuntimeMode() === "demo";

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

          <RequestResetForm demo={demo} />

          <p className={styles.authHelp}>
            <Link href="/entrar">← Voltar para o login</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
