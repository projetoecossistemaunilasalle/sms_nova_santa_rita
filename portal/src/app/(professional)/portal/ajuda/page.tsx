import { PageHeader } from "@/components/portal/page-header";
import styles from "@/components/portal/portal.module.css";
import { Icon, type IconName } from "@/components/shared/icon";

export const metadata = { title: "Ajuda" };

const topics: Array<[string, string, IconName]> = [
  [
    "Organizações e equipe",
    "Administradores da plataforma criam organizações e vinculam seus administradores. Dentro de cada organização, a equipe recebe vínculos de administrador ou profissional; na demonstração local, os perfis usam dados fictícios isolados por sessão no servidor.",
    "building",
  ],
  [
    "Criar contas",
    "Em Equipe, abra “Criar conta ou vincular perfil”. Administradores da plataforma podem criar administradores de organização ou profissionais. Administradores de organização criam apenas profissionais nas organizações sob sua gestão. O perfil Profissional atende educadores e equipes do PSE. Para contas reais, compartilhe as credenciais por um canal seguro; o portal não envia convites automaticamente.",
    "users",
  ],
  [
    "Turmas e profissionais",
    "Administradores de organização criam turmas e atribuem profissionais a elas. Profissionais enxergam apenas as turmas ativas atribuídas ao seu vínculo e não precisam montar a estrutura da escola.",
    "school",
  ],
  [
    "Jogadores numerados",
    "Cada turma usa números de jogador (Jogador 01, Jogador 02…) em vez de cadastro infantil: nenhum nome, e-mail ou senha de criança. Os números seguem a sequência da turma e nunca são reutilizados.",
    "users",
  ],
  [
    "Reimprimir ou trocar um cartão QR",
    "Abra a turma e busque o número do jogador. Use “Exibir QR deste jogador” para reimprimir o mesmo cartão. Use “Trocar QR” apenas quando precisar invalidar o código anterior; o número e o progresso são mantidos. Para imprimir a turma inteira, limpe a busca e use “Exibir QR codes da turma”.",
    "shield",
  ],
  [
    "Sessões de turma",
    "O profissional inicia e encerra a sessão da turma. Antes do início, jogadores com QR válido veem uma tela de espera; depois do encerramento, novas entradas deixam de ser aceitas.",
    "play",
  ],
  [
    "Resultados e tempo ativo",
    "Resultados e tempo ativo são registrados pelo jogo e aceitos pelo servidor. Os totais aparecem por turma e por número de jogador, sem identificar crianças individualmente.",
    "chart",
  ],
  [
    "Perfis na demonstração",
    "No modo demonstração, o seletor “Perfil demonstrado” alterna entre administrador da plataforma, administrador da organização e profissional para comparar os acessos de cada função. Use “Restaurar demo” para voltar aos dados de exemplo.",
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
