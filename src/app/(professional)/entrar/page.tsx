import Link from "next/link";

import { isAuthDevBypassEnabled } from "@/server/config/env";
import styles from "@/components/marketing/marketing.module.css";

import { signInAction } from "./actions";

export const metadata = { title: "Entrar" };

// Entrar must be dynamic so the per-request CSP nonce can be stamped correctly
// and so the POST action is not statically cached.
export const dynamic = "force-dynamic";

/**
 * Fixed pt-BR copy for the query-string states set by ./actions.ts
 * (auth_not_configured | credentials_required) and by /entrar/recuperar
 * (reset=sent). Only these fixed strings are ever rendered — user input is
 * never echoed back.
 */
function feedbackFor(
  error: string | undefined,
  reset: string | undefined,
): { alert: string | null; notice: string | null } {
  const alert =
    error === "auth_not_configured"
      ? "Autenticação ainda não está configurada neste ambiente."
      : error === "credentials_required"
        ? "Informe e-mail e senha."
        : null;
  const notice =
    reset === "sent"
      ? "Se o e-mail existir, enviaremos instruções de redefinição."
      : null;
  return { alert, notice };
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string }>;
}) {
  // While the local dev bypass is active the form accepts an empty submit so
  // the mock screen can be walked through without credentials (P1-04 pending).
  const requireCredentials = !isAuthDevBypassEnabled();
  const { error, reset } = await searchParams;
  const { alert, notice } = feedbackFor(error, reset);

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
          <h1>Prepare caminhos. Acompanhe o coletivo.</h1>
          <p>
            Um espaço de trabalho para profissionais autorizados criarem e
            compartilharem atividades.
          </p>
        </div>
      </section>
      <section className={styles.authFormWrap}>
        <div className={styles.authForm}>
          <Link className={styles.brand} href="/">
            <span className={styles.brandMark}>MC</span>
            <span className={styles.brandCopy}>
              <strong>Portal do profissional</strong>
              <small>Acesso restrito</small>
            </span>
          </Link>
          <h2>Entre no portal.</h2>
          <p>Use o acesso profissional fornecido pela administração.</p>
          {alert !== null && (
            <p
              role="alert"
              style={{
                margin: "0 0 12px",
                color: "var(--coral-dark, #b23a2c)",
                fontWeight: 600,
                fontSize: "0.875rem",
              }}
            >
              {alert}
            </p>
          )}
          <form className={styles.form} action={signInAction}>
            <label className={styles.field}>
              E-mail profissional
              <input
                type="email"
                name="email"
                autoComplete="email"
                placeholder="nome@novasantarita.rs.gov.br"
                required={requireCredentials}
              />
            </label>
            <label className={styles.field}>
              Senha
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="Sua senha"
                required={requireCredentials}
              />
            </label>
            <div className={styles.formRow}>
              <label>
                <input type="checkbox" name="remember" /> Manter acesso neste
                dispositivo
              </label>
              <Link href="/entrar/recuperar">Esqueci minha senha</Link>
            </div>
            <button className={styles.submit} type="submit">
              Entrar
            </button>
          </form>
          {notice !== null && (
            <p
              role="status"
              style={{
                margin: "12px 0 0",
                color: "var(--green-dark, #26713a)",
                fontWeight: 600,
                fontSize: "0.875rem",
              }}
            >
              {notice}
            </p>
          )}
          <p className={styles.authHelp}>
            Ainda não tem acesso? Convites e permissões são gerenciados por um
            administrador da plataforma.
          </p>
        </div>
      </section>
    </main>
  );
}
