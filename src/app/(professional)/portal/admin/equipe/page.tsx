import { PageHeader } from "@/components/portal/page-header";
import styles from "@/components/portal/portal.module.css";
import { StatusBadge } from "@/components/portal/status-badge";
import { Icon } from "@/components/shared/icon";
import { professionals } from "@/server/services/portal-view-service";

export const metadata = { title: "Equipe" };

export default function TeamAdminPage() {
  return (
    <>
      <PageHeader
        eyebrow="Acessos profissionais"
        title="Equipe e permissões"
        description="Convide profissionais, limite o escopo organizacional e revogue acessos do piloto."
        actions={
          <button className={styles.button} type="button">
            <Icon name="plus" /> Convidar profissional
          </button>
        }
      />
      <section className={styles.summaryStrip} aria-label="Resumo da equipe">
        <article className={styles.summaryCard}>
          <p>Profissionais</p>
          <strong>{professionals.length}</strong>
        </article>
        <article className={styles.summaryCard}>
          <p>Acessos ativos</p>
          <strong>
            {
              professionals.filter(
                (professional) => professional.status === "Ativa",
              ).length
            }
          </strong>
        </article>
        <article className={styles.summaryCard}>
          <p>Convites pendentes</p>
          <strong>
            {
              professionals.filter(
                (professional) => professional.status === "Convite pendente",
              ).length
            }
          </strong>
        </article>
        <article className={styles.summaryCard}>
          <p>Organizações</p>
          <strong>
            {new Set(
              professionals
                .map((professional) => professional.organizationId)
                .filter(Boolean),
            ).size || 1}
          </strong>
        </article>
      </section>
      <div className={styles.toolbar}>
        <label className={styles.searchField}>
          <span
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              overflow: "hidden",
            }}
          >
            Buscar profissionais
          </span>
          <Icon name="search" />
          <input type="search" placeholder="Buscar nome ou e-mail" />
        </label>
        <select
          className={styles.select}
          aria-label="Organização"
          defaultValue="all"
        >
          <option value="all">Todas as organizações</option>
          <option value="victor">EMEF Victor Aggens</option>
          <option value="rede">Rede municipal</option>
        </select>
      </div>
      <div className={`${styles.adminTable} ${styles.teamTable}`}>
        <div className={styles.tableHeader}>
          <span>Profissional</span>
          <span>Perfil</span>
          <span>Escopo</span>
          <span>Estado</span>
          <span />
        </div>
        {professionals.map((professional) => (
          <div className={styles.tableRow} key={professional.email}>
            <span className={styles.tableIdentity}>
              <i className={styles.personAvatar}>{professional.initials}</i>
              <span>
                <strong>{professional.name}</strong>
                <small>{professional.email}</small>
              </span>
            </span>
            <span>{professional.role}</span>
            <span>{professional.scope}</span>
            <StatusBadge status={professional.status} />
            <button
              className={styles.iconButton}
              type="button"
              aria-label={`Gerenciar ${professional.name}`}
            >
              <Icon name="more" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
