"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import styles from "@/components/marketing/marketing.module.css";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("adriana.martins@exemplo.gov.br");
  const [password, setPassword] = useState("••••••••");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push("/portal");
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
          <h1>Prepare caminhos. Acompanhe o coletivo.</h1>
          <p>
            Um espaço de trabalho para profissionais autorizados criarem e
            compartilharem atividades.
          </p>
        </div>
      </section>
      <section className={styles.authFormWrap}>
        <div className={styles.authForm}>
          <Link className={styles.brand} href="/portal">
            <span className={styles.brandMark}>MC</span>
            <span className={styles.brandCopy}>
              <strong>Portal do profissional</strong>
              <small>Demonstração visual</small>
            </span>
          </Link>
          <h2>Entre no portal.</h2>
          <p>Esta é uma versão demonstrativa visual navegável.</p>

          <form className={styles.form} onSubmit={handleSubmit}>
            <label className={styles.field}>
              E-mail profissional
              <input
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="profissional@exemplo.gov.br"
              />
            </label>
            <label className={styles.field}>
              Senha
              <input
                type="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Sua senha"
              />
            </label>
            <div className={styles.formRow}>
              <label>
                <input type="checkbox" name="remember" defaultChecked /> Manter
                acesso neste dispositivo
              </label>
              <Link href="/entrar/recuperar">Esqueci minha senha</Link>
            </div>
            <button className={styles.submit} type="submit">
              Entrar na demonstração
            </button>
          </form>

          <p className={styles.authHelp}>
            Ambiente de visualização. Clique em &quot;Entrar na
            demonstração&quot; para navegar por todas as telas do portal.
          </p>
        </div>
      </section>
    </main>
  );
}
