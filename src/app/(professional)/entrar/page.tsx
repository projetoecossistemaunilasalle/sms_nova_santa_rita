import Link from "next/link";
import { Suspense } from "react";

import { SignInError } from "@/components/auth/sign-in-error";
import styles from "@/components/marketing/marketing.module.css";
import { getRuntimeMode } from "@/runtime/mode";

import { signInAction } from "@/runtime/actions";

export default function SignInPage() {
  const mode = getRuntimeMode();
  const isDemo = mode === "demo";

  return (
    <main className={styles.authPage}>
      <section className={styles.authArt}>
        <Link className={styles.brand} href={isDemo ? "/portal" : "/entrar"}>
          <span className={styles.brandMark}>MC</span>
          <span className={styles.brandCopy}>
            <strong>Missões do Caramelito</strong>
            <small>Programa Saúde na Escola</small>
          </span>
        </Link>
        <div className={styles.authQuote}>
          <h1>Prepare caminhos. Acompanhe o coletivo.</h1>
          <p>
            Um espaço de trabalho para profissionais autorizados organizarem
            turmas e acompanharem a experiência.
          </p>

          {!isDemo && (
            <Suspense>
              <SignInError />
            </Suspense>
          )}
        </div>
      </section>
      <section className={styles.authFormWrap}>
        <div className={styles.authForm}>
          <div className={styles.brand}>
            <span className={styles.brandMark}>MC</span>
            <span className={styles.brandCopy}>
              <strong>Portal do profissional</strong>
              <small>{isDemo ? "Demonstração" : "Acesso seguro"}</small>
            </span>
          </div>
          <h2>Entre no portal.</h2>
          <p>
            {isDemo
              ? "Explore a demonstração estática sem usar uma conta real."
              : "Use a conta profissional configurada no Neon Auth."}
          </p>

          {isDemo ? (
            <div className={styles.form}>
              <label className={styles.field}>
                E-mail profissional
                <input
                  type="email"
                  defaultValue="demonstracao@localhost"
                  readOnly
                />
              </label>
              <label className={styles.field}>
                Senha
                <input type="password" defaultValue="demonstracao" readOnly />
              </label>
              <Link className={styles.submit} href="/portal">
                Entrar na demonstração
              </Link>
            </div>
          ) : (
            <form className={styles.form} action={signInAction}>
              <label className={styles.field}>
                E-mail profissional
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                />
              </label>
              <label className={styles.field}>
                Senha
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  required
                />
              </label>
              <button className={styles.submit} type="submit">
                Entrar
              </button>
            </form>
          )}

          <p className={styles.authHelp}>
            {isDemo
              ? "Os dados são fictícios e as alterações ficam somente neste navegador."
              : "O acesso depende de um perfil profissional ativo vinculado à identidade autenticada."}
          </p>
        </div>
      </section>
    </main>
  );
}
