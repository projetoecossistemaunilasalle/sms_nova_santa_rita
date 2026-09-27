import { PageHeader } from "@/components/portal/page-header";
import styles from "@/components/portal/portal.module.css";
import { Icon, type IconName } from "@/components/shared/icon";

export const metadata = { title: "Ajuda" };

const topics: Array<[string, string, IconName]> = [
  [
    "Organizações e equipe",
    "Administradores da plataforma criam organizações e vinculam seus administradores. Dentro de cada organização, a equipe recebe vínculos de administrador ou professor; na demonstração, os perfis ficam somente neste navegador.",
    "building",
  ],
  [
    "Turmas e professores",
    "Administradores de organização criam turmas e atribuem professores a elas. Professores enxergam apenas as turmas ativas atribuídas ao seu vínculo e não precisam montar a estrutura da escola.",
    "school",
  ],
  [
    "Jogadores numerados",
    "Cada turma usa números de jogador (Jogador 01, Jogador 02…) em vez de cadastro infantil: nenhum nome, e-mail ou senha de criança. Os números seguem a sequência da turma e nunca são reutilizados.",
    "users",
  ],
  [
    "Credenciais QR",
    "Ao criar jogadores, o portal gera cartões QR prontos para impressão. Cada jogador tem um único QR ativo; em “Trocar QR”, o código anterior deixa de funcionar imediatamente e deve ser descartado. A entrada do jogador acontece em /jogar.",
    "shield",
  ],
  [
    "Sessões de turma",
    "O professor inicia e encerra a sessão da turma. Antes do início, jogadores com QR válido veem uma tela de espera; depois do encerramento, novas entradas deixam de ser aceitas.",
    "play",
  ],
  [
    "Resultados e tempo ativo",
    "Resultados e tempo ativo são registrados pelo jogo e aceitos pelo servidor. Os totais aparecem por turma e por número de jogador, sem identificar crianças individualmente.",
    "chart",
  ],
  [
    "Perfis na demonstração",
    "No modo demonstração, o seletor “Perfil demonstrado” alterna entre administrador da plataforma, administrador da organização e professor para comparar os acessos de cada função. Use “Restaurar demo” para voltar aos dados de exemplo.",
    "flag",
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
        {topics.map(([title, description, icon]) => (
          <article className={styles.moduleCard} key={title}>
            <div className={styles.moduleArt}>
              <span>
                <Icon name={icon} />
              </span>
            </div>
            <h2>{title}</h2>
            <p>{description}</p>
          </article>
        ))}
      </div>
    </>
  );
}
