"use client";

import { useSearchParams } from "next/navigation";

import styles from "@/components/marketing/marketing.module.css";

export function SignInError() {
  const error = useSearchParams().get("error");
  if (!error) return null;

  return (
    <p role="alert" className={styles.authHelp}>
      Não foi possível autenticar. Verifique os dados e tente novamente.
    </p>
  );
}
