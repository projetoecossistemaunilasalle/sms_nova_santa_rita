import { PageHeader } from "@/components/portal/page-header";
import styles from "@/components/portal/portal.module.css";
import { Icon } from "@/components/shared/icon";

export const metadata = { title: "Ajuda" };

const topics = [
  [
    "Links de acesso",
    "Crie um link por turma ou grupo e compartilhe por QR code ou mensagem.",
  ],
  [
    "Resultados coletivos",
    "Acompanhe sessões e conclusão sem identificar participantes individualmente.",
  ],
  [
    "Status e validade",
    "Pause, reabra, encerre ou defina a expiração de um acesso sem perder resultados.",
  ],
  [
    "Acesso anônimo",
    "O jogo abre pelo link personalizado e não pede conta, nome ou e-mail.",
  ],
];

export default function HelpPage() {
  return (
    <>
      <PageHeader
        eyebrow="Central de ajuda"
        title="Como podemos orientar?"
        description="Respostas rápidas para os fluxos principais do portal."
      />
      <div className={styles.moduleGrid}>
        {topics.map(([title, description]) => (
          <article className={styles.moduleCard} key={title}>
            <div className={styles.moduleArt}>
              <span>
                <Icon name="flag" />
              </span>
            </div>
            <h2>{title}</h2>
            <p>{description}</p>
            <span className={styles.textLink}>Abrir orientação</span>
          </article>
        ))}
      </div>
    </>
  );
}
