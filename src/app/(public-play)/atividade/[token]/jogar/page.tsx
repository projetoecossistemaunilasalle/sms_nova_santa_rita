import Link from "next/link";

import styles from "@/components/public/public.module.css";
import { Icon } from "@/components/shared/icon";
import { listAccessLinks } from "@/server/services/portal-view-service";

export const metadata = { title: "Jogo Missões do Caramelito" };

export function generateStaticParams() {
  const tokens = ["7FQ-29M", "2KF-81P", "habitos-saudaveis", "turma-5b"];
  listAccessLinks().forEach((l) => {
    if (!tokens.includes(l.id)) tokens.push(l.id);
  });
  return tokens.map((token) => ({ token }));
}

export default async function GameLauncherPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <section className={styles.gameStage} aria-labelledby="game-title">
      <header className={styles.gameStageHeader}>
        <span className={styles.status}>Demonstração visual do jogo</span>
        <h1 id="game-title">Missões do Caramelito</h1>
        <p>Experiência interativa de hábitos saudáveis e convivência.</p>
      </header>

      <div className={styles.gameFrameCard}>
        <div
          style={{
            minHeight: "360px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
            color: "#fff",
            borderRadius: "12px",
            padding: "2rem",
            textAlign: "center",
            gap: "1.25rem",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              backgroundColor: "rgba(255, 255, 255, 0.1)",
              fontSize: "2rem",
            }}
          >
            🎮
          </span>
          <div>
            <h2
              style={{
                margin: "0 0 0.5rem",
                fontSize: "1.35rem",
                color: "#f8fafc",
              }}
            >
              Jogo Conectado via GameMaker
            </h2>
            <p
              style={{
                margin: 0,
                color: "#94a3b8",
                fontSize: "0.95rem",
                maxWidth: "450px",
              }}
            >
              Em ambiente de produção, o executável ou web canvas do GameMaker é
              carregado neste quadro de forma anônima e segura.
            </p>
          </div>
          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <Link
              href="/portal"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "0.6rem 1.2rem",
                borderRadius: "8px",
                background: "#f59e0b",
                color: "#1e293b",
                fontWeight: 600,
                textDecoration: "none",
                fontSize: "0.9rem",
              }}
            >
              Voltar ao portal profissional
            </Link>
            <Link
              href={`/atividade/${token}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "0.6rem 1.2rem",
                borderRadius: "8px",
                background: "rgba(255,255,255,0.15)",
                color: "#f8fafc",
                fontWeight: 500,
                textDecoration: "none",
                fontSize: "0.9rem",
              }}
            >
              Ver página de entrada
            </Link>
          </div>
        </div>
      </div>

      <div className={styles.gameStageFooter}>
        <p>
          <Icon name="shield" /> A atividade não pede nome, e-mail ou conta.
        </p>
        <Link className={styles.secondary} href="/portal">
          Painel do profissional <Icon name="external" />
        </Link>
      </div>
    </section>
  );
}
