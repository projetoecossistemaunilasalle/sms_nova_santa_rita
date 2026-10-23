import Link from "next/link";

import {
  InvalidResetLink,
  ResetPasswordForm,
} from "@/components/auth/password-reset-forms";
import styles from "@/components/marketing/marketing.module.css";
import { getRuntimeMode } from "@/runtime/mode";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Redefinir senha",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const demo = getRuntimeMode() === "demo";
  const params = await searchParams;
  // Better Auth redirects here with ?error=INVALID_TOKEN when the link is
  // expired or already used; otherwise it appends ?token=<single-use token>.
  const token = single(params.token)?.trim() ?? "";
  const providerError = single(params.error);
  const usable = demo || (token.length > 0 && !providerError);

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
          <h1>Crie uma nova senha.</h1>
          <p>
            Escolha uma senha que você não use em outros serviços. O link de
            redefinição vale por uma única vez.
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

          {usable ? (
            <ResetPasswordForm token={demo ? "demo" : token} demo={demo} />
          ) : (
            <InvalidResetLink />
          )}

          <p className={styles.authHelp}>
            <Link href="/entrar">← Voltar para o login</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
