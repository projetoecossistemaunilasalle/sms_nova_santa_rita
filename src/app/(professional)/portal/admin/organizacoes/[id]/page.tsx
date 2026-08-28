import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/portal/page-header";
import { DemoActionButton } from "@/components/portal/demo-action-button";
import styles from "@/components/portal/portal.module.css";
import { StatusBadge } from "@/components/portal/status-badge";
import { Icon } from "@/components/shared/icon";
import {
  getOrganization,
  getOrganizationDemoData,
  organizations,
} from "@/server/services/portal-view-service";

export const metadata = { title: "Detalhe da organização" };

export function generateStaticParams() {
  return organizations.map((org) => ({
    id: org.id,
  }));
}

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const organization = getOrganization(id);
  if (!organization) notFound();
  const demo = getOrganizationDemoData(id);

  return (
    <>
      <PageHeader
        eyebrow="Organizações / Unidade"
        title={organization.name}
        description={`${organization.type} · Município Modelo`}
        actions={
          <>
            <DemoActionButton
              className={styles.buttonSecondary}
              message="Edição aberta apenas para a demonstração. Nenhuma alteração foi gravada."
            >
              <Icon name="edit" /> Editar organização
            </DemoActionButton>
            <Link className={styles.button} href="/portal/turmas">
              <Icon name="plus" /> Nova turma
            </Link>
          </>
        }
      />
      <section className={styles.organizationOverview}>
        <div className={styles.organizationSeal}>{organization.initials}</div>
        <div>
          <StatusBadge status={organization.status} />
          <h2>Uma visão da unidade</h2>
          <p>
            Equipe, turmas e participação coletiva reunidas em um só contexto.
          </p>
        </div>
        <dl>
          <div>
            <dt>Profissionais</dt>
            <dd>{organization.members}</dd>
          </div>
          <div>
            <dt>Turmas</dt>
            <dd>{organization.classGroups}</dd>
          </div>
          <div>
            <dt>Links ativos</dt>
            <dd>{organization.activeLinks}</dd>
          </div>
          <div>
            <dt>Sessões</dt>
            <dd>{organization.participation}</dd>
          </div>
        </dl>
      </section>

      <div className={styles.organizationDetailGrid}>
        <section className={styles.detailPanel}>
          <div className={styles.sectionHeader}>
            <h2>Turmas</h2>
            <Link className={styles.textLink} href="/portal/turmas">
              Ver todas
            </Link>
          </div>
          <div className={styles.compactDirectory}>
            {demo.classGroups.map((classGroup) => (
              <Link
                href={`/portal/turmas/${classGroup.id}`}
                key={classGroup.id}
              >
                <span className={styles.directoryIcon}>
                  <Icon name="school" />
                </span>
                <span>
                  <strong>{classGroup.name}</strong>
                  <small>
                    {classGroup.grade} · {classGroup.shift}
                  </small>
                </span>
                <span>
                  <strong>{classGroup.sessions}</strong>
                  <small>sessões</small>
                </span>
                <Icon name="chevron" />
              </Link>
            ))}
          </div>
        </section>
        <section className={styles.detailPanel}>
          <div className={styles.sectionHeader}>
            <h2>Profissionais vinculados</h2>
            <Link className={styles.textLink} href="/portal/admin/equipe">
              Gerenciar
            </Link>
          </div>
          <div className={styles.peopleStack}>
            {demo.professionals.map((professional) => (
              <article key={professional.email}>
                <span className={styles.personAvatar}>
                  {professional.initials}
                </span>
                <span>
                  <strong>{professional.name}</strong>
                  <small>{professional.role}</small>
                </span>
                <StatusBadge status={professional.status} />
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className={styles.organizationParticipation}>
        <div>
          <p className={styles.eyebrow}>Participação coletiva</p>
          <h2>Atividade recente nos links</h2>
          <p>
            Resumo demonstrativo sem cadastro ou histórico individual de
            estudantes.
          </p>
        </div>
        <div className={styles.organizationBars} aria-hidden="true">
          {[42, 58, 46, 71, 64, 88, 76].map((height, index) => (
            <span key={`${height}-${index}`} style={{ height: `${height}%` }} />
          ))}
        </div>
        <strong>
          {organization.participation}
          <small> sessões agregadas</small>
        </strong>
      </section>
    </>
  );
}
