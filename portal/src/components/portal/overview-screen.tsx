"use client";

import Link from "next/link";

import type { PortalOverviewDto } from "@/application/adult-portal/types";
import type { RuntimeMode } from "@/runtime/mode";
import { RecordStatus } from "@/generated/prisma/enums";
import { Icon } from "@/components/shared/icon";

import { recordStatusLabel } from "./adult-portal-helpers";
import { PageHeader } from "./page-header";
import { PortalState } from "./portal-state";
import { StatusBadge } from "./status-badge";
import styles from "./portal.module.css";

export function OverviewScreen({
  initial,
}: {
  initial: PortalOverviewDto;
  runtimeMode: RuntimeMode;
}) {
  const {
    effectiveRole: role,
    organizations,
    classes,
    teamMemberCount,
  } = initial;
  const activeClasses = classes.filter(
    (item) => item.status === RecordStatus.ACTIVE,
  );
  const nextHref =
    role === "platform_admin"
      ? "/portal/admin/organizacoes"
      : role === "teacher" && activeClasses.length === 1
        ? `/portal/turmas/${activeClasses[0]!.id}`
        : "/portal/turmas";

  if (!role) {
    return (
      <PortalState
        icon="lock"
        title="Este perfil não possui acesso ativo"
        description="Peça ao administrador para verificar seu vínculo profissional."
      />
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Visão geral"
        title={
          role === "teacher"
            ? "Vamos preparar a próxima sessão?"
            : "Tudo pronto para começar?"
        }
        description={
          role === "platform_admin"
            ? "Organize as unidades e seus responsáveis para receber as turmas."
            : role === "organization_admin"
              ? "Mantenha equipe, turmas e atribuições prontas para o trabalho dos profissionais."
              : "Acesse sua turma, prepare os cartões e libere a entrada no jogo."
        }
        actions={
          <Link className={styles.button} href={nextHref}>
            <Icon name={role === "platform_admin" ? "building" : "school"} />
            {role === "platform_admin"
              ? "Gerenciar organizações"
              : role === "teacher" && activeClasses.length === 1
                ? `Abrir turma ${activeClasses[0]!.name}`
                : "Ver turmas"}
          </Link>
        }
      />
      <ol className={styles.journeySteps} aria-label="Como preparar o trabalho">
        {(role === "platform_admin"
          ? [
              ["Organizações", "Cadastre as unidades da rede."],
              ["Administradores", "Vincule um responsável a cada unidade."],
              ["Acompanhamento", "Confira a estrutura de cada organização."],
            ]
          : role === "organization_admin"
            ? [
                ["Equipe", "Vincule os profissionais à organização."],
                ["Turmas", "Crie a turma e atribua seus profissionais."],
                ["Acessos", "Prepare os jogadores e seus cartões QR."],
              ]
            : [
                [
                  "Prepare os cartões",
                  "Use os mesmos números a cada encontro.",
                ],
                ["Inicie a sessão", "Os jogadores entram pelo QR no tablet."],
                ["Acompanhe", "Consulte a participação em Resultados."],
              ]
        ).map(([title, description]) => (
          <li key={title}>
            <strong>{title}</strong>
            <span>{description}</span>
          </li>
        ))}
      </ol>
      {role !== "teacher" && (
        <section
          className={styles.summaryStrip}
          aria-label="Resumo operacional"
        >
          {role === "platform_admin" ? (
            <>
              <article className={styles.summaryCard}>
                <p>Organizações</p>
                <strong>{organizations.length}</strong>
                <small>
                  {
                    organizations.filter(
                      (item) => item.status === RecordStatus.ACTIVE,
                    ).length
                  }{" "}
                  ativas
                </small>
              </article>
              <article className={styles.summaryCard}>
                <p>Vínculos da equipe</p>
                <strong>{teamMemberCount}</strong>
                <small>Em toda a plataforma</small>
              </article>
            </>
          ) : (
            <>
              <article className={styles.summaryCard}>
                <p>Suas turmas</p>
                <strong>{classes.length}</strong>
                <small>No seu escopo ativo</small>
              </article>
              <article className={styles.summaryCard}>
                <p>Turmas ativas</p>
                <strong>
                  {
                    classes.filter(
                      (item) => item.status === RecordStatus.ACTIVE,
                    ).length
                  }
                </strong>
                <small>Disponíveis agora</small>
              </article>
              {role === "organization_admin" && (
                <article className={styles.summaryCard}>
                  <p>Equipe</p>
                  <strong>{teamMemberCount}</strong>
                  <small>Vínculos no seu escopo</small>
                </article>
              )}
            </>
          )}
        </section>
      )}
      {role === "platform_admin" ? (
        organizations.length === 0 ? (
          <PortalState
            headingLevel={2}
            icon="building"
            title="Nenhuma organização criada"
            description="Cadastre uma organização e vincule o administrador responsável."
            actions={
              <Link className={styles.button} href="/portal/admin/organizacoes">
                Criar organização
              </Link>
            }
          />
        ) : (
          <section>
            <div className={styles.sectionHeader}>
              <h2>Organizações no escopo</h2>
              <Link
                className={styles.textLink}
                href="/portal/admin/organizacoes"
              >
                Gerenciar
              </Link>
            </div>
            <div className={styles.dashboardCompactList}>
              {organizations.slice(0, 4).map((organization) => (
                <Link
                  href={`/portal/admin/organizacoes/${organization.id}`}
                  key={organization.id}
                >
                  <span className={styles.directoryIcon}>
                    <Icon name="building" />
                  </span>
                  <span>
                    <strong>{organization.name}</strong>
                    <small>{organization.type}</small>
                  </span>
                  <StatusBadge
                    status={recordStatusLabel(organization.status)}
                  />
                  <Icon name="chevron" />
                </Link>
              ))}
            </div>
          </section>
        )
      ) : classes.length === 0 ? (
        <PortalState
          headingLevel={2}
          icon="school"
          title={
            role === "teacher"
              ? "Nenhuma turma atribuída"
              : "Nenhuma turma criada"
          }
          description={
            role === "teacher"
              ? "Peça ao administrador da organização para atribuir uma turma ativa."
              : "Crie a primeira turma na área de turmas."
          }
          actions={
            <Link
              className={styles.buttonSecondary}
              href={role === "teacher" ? "/portal/ajuda" : "/portal/turmas"}
            >
              {role === "teacher"
                ? "Como obter acesso a uma turma"
                : "Criar turma"}
            </Link>
          }
        />
      ) : (
        <section>
          <div className={styles.sectionHeader}>
            <h2>Turmas disponíveis</h2>
            <Link className={styles.textLink} href="/portal/turmas">
              Ver todas
            </Link>
          </div>
          <div className={styles.dashboardCompactList}>
            {classes.slice(0, 4).map((classGroup) => (
              <Link
                href={`/portal/turmas/${classGroup.id}`}
                key={classGroup.id}
              >
                <span className={styles.directoryIcon}>
                  <Icon name="school" />
                </span>
                <span>
                  <strong>{classGroup.name}</strong>
                  <small>{classGroup.organizationName}</small>
                </span>
                <StatusBadge status={recordStatusLabel(classGroup.status)} />
                <Icon name="chevron" />
              </Link>
            ))}
          </div>
        </section>
      )}
      <section className={styles.followUpBand}>
        <div>
          <h2>Depois da sessão</h2>
          <p>Veja quem participou e o tempo ativo registrado por jogador.</p>
        </div>
        <Link className={styles.textLink} href="/portal/resultados">
          Consultar resultados <Icon name="arrow" />
        </Link>
      </section>
    </>
  );
}
