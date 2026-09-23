"use client";

import Link from "next/link";

import type { PortalOverviewDto } from "@/application/adult-portal/types";
import type { RuntimeMode } from "@/runtime/mode";
import { RecordStatus } from "@/generated/prisma/enums";
import { Icon } from "@/components/shared/icon";

import {
  demoClasses,
  demoOrganizations,
  demoRole,
  demoScopeLabel,
  demoTeam,
  recordStatusLabel,
} from "./adult-portal-helpers";
import { PageHeader } from "./page-header";
import { PortalState } from "./portal-state";
import { StatusBadge } from "./status-badge";
import { useDemoPortalState } from "./use-demo-portal";
import styles from "./portal.module.css";

export function OverviewScreen({
  initial,
  runtimeMode,
}: {
  initial: PortalOverviewDto;
  runtimeMode: RuntimeMode;
}) {
  const demo = useDemoPortalState();
  const role = demo ? demoRole(demo) : initial.effectiveRole;
  const organizations = demo ? demoOrganizations(demo) : initial.organizations;
  const classes = demo ? demoClasses(demo) : initial.classes;
  const teamMemberCount = demo
    ? demoTeam(demo).length
    : initial.teamMemberCount;
  const roleLabel =
    role === "platform_admin"
      ? "Administrador da plataforma"
      : role === "organization_admin"
        ? "Administrador da organização"
        : "Professor";
  const scopeLabel = demo ? demoScopeLabel(demo) : initial.scopeLabel;

  if (!role) {
    return (
      <PortalState
        icon="lock"
        title="Este perfil não possui acesso ativo"
        description="Selecione um perfil demo ativo vinculado a uma organização ativa."
      />
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Visão geral"
        title={`Seu trabalho como ${roleLabel.toLowerCase()}`}
        description={
          role === "platform_admin"
            ? "Prepare organizações e seus administradores para que a estrutura V1 possa operar."
            : role === "organization_admin"
              ? "Mantenha equipe, turmas e atribuições prontas para o trabalho dos professores."
              : "Entre nas turmas ativas atribuídas ao seu vínculo."
        }
      />
      {runtimeMode === "demo" && (
        <p className={styles.demoScopeNotice}>
          Troque o perfil acima para comparar os acessos de cada função.
        </p>
      )}
      <section className={styles.roleContextBand}>
        <div>
          <span>Perfil efetivo</span>
          <strong>{roleLabel}</strong>
        </div>
        <div>
          <span>Escopo</span>
          <strong>{scopeLabel}</strong>
        </div>
        <div>
          <span>Próximo passo</span>
          <strong>
            {role === "platform_admin"
              ? "Organizações"
              : role === "organization_admin"
                ? "Estrutura de turmas"
                : "Turmas atribuídas"}
          </strong>
        </div>
      </section>
      <section className={styles.summaryStrip} aria-label="Resumo operacional">
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
              <p>Vínculos adultos</p>
              <strong>{teamMemberCount}</strong>
              <small>Em toda a plataforma</small>
            </article>
          </>
        ) : (
          <>
            <article className={styles.summaryCard}>
              <p>Turmas visíveis</p>
              <strong>{classes.length}</strong>
              <small>No seu escopo ativo</small>
            </article>
            <article className={styles.summaryCard}>
              <p>Turmas ativas</p>
              <strong>
                {
                  classes.filter((item) => item.status === RecordStatus.ACTIVE)
                    .length
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
      {role === "platform_admin" ? (
        organizations.length === 0 ? (
          <PortalState
            icon="building"
            title="Nenhuma organização criada"
            description="Crie a primeira organização para iniciar a estrutura V1."
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
            {classes
              .slice(0, 4)
              .filter((item) => !item.id.startsWith("demo-class-"))
              .map((classGroup) => (
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
      {role !== "platform_admin" && (
        <section>
          <div className={styles.sectionHeader}>
            <h2>Resultados de jogo</h2>
            <Link className={styles.textLink} href="/portal/resultados">
              Ver resultados
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
