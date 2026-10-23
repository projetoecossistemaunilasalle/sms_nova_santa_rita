"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";

import styles from "@/components/marketing/marketing.module.css";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  type PasswordResetState,
} from "@/server/auth/password-reset-policy";
import {
  requestPasswordResetAction,
  resetPasswordAction,
} from "@/runtime/actions";

const idle: PasswordResetState = { status: "idle" };

const successStyle = {
  margin: "0 0 16px",
  color: "var(--green-dark, #26713a)",
  fontWeight: 600,
  fontSize: "0.95rem",
} as const;

const linkButtonStyle = {
  display: "inline-block",
  textAlign: "center",
  textDecoration: "none",
} as const;

export function RequestResetForm({ demo }: { demo: boolean }) {
  const [state, action, pending] = useActionState(
    requestPasswordResetAction,
    idle,
  );

  if (state.status === "sent") {
    return (
      <div style={{ marginTop: "1rem" }}>
        <p role="status" style={successStyle}>
          {demo
            ? "Demonstração: se o e-mail existisse, as instruções seriam enviadas."
            : "Se houver uma conta com esse e-mail, enviaremos um link para redefinir a senha. Verifique também a caixa de spam."}
        </p>
        <Link className={styles.submit} href="/entrar" style={linkButtonStyle}>
          Voltar para o início
        </Link>
      </div>
    );
  }

  return (
    <form className={styles.form} action={action}>
      <label className={styles.field}>
        E-mail profissional
        <input
          type="email"
          name="email"
          autoComplete="email"
          placeholder="profissional@exemplo.gov.br"
          maxLength={254}
          required
        />
      </label>
      {state.status === "error" && (
        <p role="alert" className={styles.authHelp}>
          {state.message}
        </p>
      )}
      <button className={styles.submit} type="submit" disabled={pending}>
        {pending ? "Enviando..." : "Enviar instruções"}
      </button>
    </form>
  );
}

export function ResetPasswordForm({
  token,
  demo,
}: {
  token: string;
  demo: boolean;
}) {
  const [state, action, pending] = useActionState(resetPasswordAction, idle);

  // The token now lives only in the form; drop it from the address bar and
  // history so an abandoned reset link can't be replayed from history.
  useEffect(() => {
    if (window.location.search)
      window.history.replaceState(null, "", window.location.pathname);
  }, []);

  if (state.status === "success") {
    return (
      <div style={{ marginTop: "1rem" }}>
        <p role="status" style={successStyle}>
          {demo
            ? "Demonstração: a senha seria redefinida agora."
            : "Senha redefinida. Entre no portal com a nova senha."}
        </p>
        <Link className={styles.submit} href="/entrar" style={linkButtonStyle}>
          Ir para o login
        </Link>
      </div>
    );
  }

  if (state.status === "invalid_token") {
    return <InvalidResetLink message={state.message} />;
  }

  return (
    <form className={styles.form} action={action}>
      <input type="hidden" name="token" value={token} />
      <label className={styles.field}>
        Nova senha
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={PASSWORD_MAX_LENGTH}
          aria-describedby="password-rules"
          required
        />
      </label>
      <label className={styles.field}>
        Confirme a nova senha
        <input
          type="password"
          name="confirmation"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={PASSWORD_MAX_LENGTH}
          required
        />
      </label>
      <p id="password-rules" className={styles.authHelp}>
        Use pelo menos {PASSWORD_MIN_LENGTH} caracteres.
      </p>
      {state.status === "error" && (
        <p role="alert" className={styles.authHelp}>
          {state.message}
        </p>
      )}
      <button className={styles.submit} type="submit" disabled={pending}>
        {pending ? "Salvando..." : "Redefinir senha"}
      </button>
    </form>
  );
}

export function InvalidResetLink({ message }: { message?: string }) {
  return (
    <div style={{ marginTop: "1rem" }}>
      <p role="alert" style={{ ...successStyle, color: "inherit" }}>
        {message ??
          "Este link de redefinição é inválido ou expirou. Solicite um novo link."}
      </p>
      <Link
        className={styles.submit}
        href="/entrar/recuperar"
        style={linkButtonStyle}
      >
        Solicitar novo link
      </Link>
    </div>
  );
}
