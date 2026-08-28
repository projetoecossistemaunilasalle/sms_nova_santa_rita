import Link from "next/link";

import styles from "@/components/marketing/marketing.module.css";
import { requestPasswordResetAction } from "./actions";

export const metadata = { title: "Recuperar acesso" };

export const dynamic = "force-dynamic";

export default function RecoverAccessPage() {
  return (
    <main className={styles.authPage}>
      <section className={styles.authArt}>
        <Link className={styles.brand} href="/">
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
          <form className={styles.form} action={requestPasswordResetAction}>
            <label className={styles.field}>
              E-mail profissional
              <input
                type="email"
                name="email"
                autoComplete="email"
                placeholder="nome@novasantarita.rs.gov.br"
                required
              />
            </label>
            <button className={styles.submit} type="submit">
              Enviar instruções
            </button>
          </form>
          <p className={styles.authHelp}>
            Se o endereço estiver cadastrado, a mensagem será enviada. O portal
            não confirma publicamente se uma conta existe.
          </p>
        </div>
      </section>
    </main>
  );
}
