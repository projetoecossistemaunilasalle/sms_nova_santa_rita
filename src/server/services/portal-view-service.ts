import "server-only";

import { DEV_BYPASS_ACTOR } from "@/server/auth/dev-bypass-gateway";
import type { AccessLinkRecord } from "@/server/services/access-link-service";
import { hashToken } from "@/server/security/tokens";

export type ActivityStatus = "Aberta" | "Rascunho" | "Pausada" | "Encerrada";

export type ActivitySummary = {
  id: string;
  title: string;
  module: string;
  updated: string;
  status: ActivityStatus;
  participation: number | null;
  completion: number | null;
  version: number | null;
  owner: string;
  symbol: string;
  tone: "blue" | "orange" | "aqua" | "purple";
};

export type AccessLinkSummary = {
  id: string;
  label: string;
  audience: string;
  status: ActivityStatus;
  created: string;
  lastUsed: string;
  sessions: number;
  completion: number;
  /** Nothing renders it; kept optional until a real share URL source exists. */
  url?: string;
  expires: string;
  symbol: string;
  tone: "blue" | "orange" | "aqua" | "purple";
  /** Persisted-shaped values used by the local development bypass only. */
  organizationId?: string;
  createdAt?: string;
  updatedAt?: string;
  expiresAt?: string | null;
};

/** Canonical organization ids used by the mock fixtures. Keep in sync with seed data. */
export const ORGANIZATION_IDS = {
  VICTOR_AGGENS: "0b0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a",
  REDE_MUNICIPAL: "1b1b1b1b-1b1b-4b1b-9b1b-1b1b1b1b1b1b",
} as const;

const activities: ActivitySummary[] = [
  {
    id: "habitos-saudaveis",
    title: "Missões do Caramelito",
    module: "Experiência GameMaker",
    updated: "Hoje, 10:32",
    status: "Aberta",
    participation: 126,
    completion: 82,
    version: 1,
    owner: "Adriana Martins",
    symbol: "folha",
    tone: "blue",
  },
];

const accessLinks: AccessLinkSummary[] = [
  {
    id: "habitos-saudaveis",
    label: "Link principal",
    audience: "Todas as turmas · EMEF Victor Aggens",
    status: "Aberta",
    created: "Hoje, 10:32",
    lastUsed: "Hoje, 10:32",
    sessions: 126,
    completion: 82,
    url: "https://missoes.nsr.rs.gov.br/atividade/7FQ-29M",
    expires: "Sem expiração",
    symbol: "link",
    tone: "blue",
    organizationId: ORGANIZATION_IDS.VICTOR_AGGENS,
    createdAt: "2026-08-23T13:32:00.000-03:00",
    updatedAt: "2026-08-23T13:32:00.000-03:00",
    expiresAt: null,
  },
  {
    id: "turma-5b",
    label: "Turma 5B",
    audience: "Turma 5B · EMEF Victor Aggens",
    status: "Aberta",
    created: "Ontem, 16:40",
    lastUsed: "Hoje, 09:18",
    sessions: 42,
    completion: 76,
    url: "https://missoes.nsr.rs.gov.br/atividade/2KF-81P",
    expires: "30 ago. 2026",
    symbol: "link",
    tone: "aqua",
    organizationId: ORGANIZATION_IDS.VICTOR_AGGENS,
    createdAt: "2026-08-22T19:40:00.000-03:00",
    updatedAt: "2026-08-27T12:18:00.000-03:00",
    expiresAt: "2026-08-30T23:59:59.999-03:00",
  },
];

export const professionals = [
  {
    initials: "AM",
    name: "Adriana Martins",
    email: "adriana.martins@novasantarita.rs.gov.br",
    role: "Gestora de acessos",
    status: "Ativa",
    scope: "EMEF Victor Aggens",
    organizationId: ORGANIZATION_IDS.VICTOR_AGGENS,
  },
  {
    initials: "LR",
    name: "Lucas Ribeiro",
    email: "lucas.ribeiro@novasantarita.rs.gov.br",
    role: "Gestor de acessos",
    status: "Ativa",
    scope: "EMEF Victor Aggens",
    organizationId: ORGANIZATION_IDS.VICTOR_AGGENS,
  },
  {
    initials: "CF",
    name: "Carla Freitas",
    email: "carla.freitas@novasantarita.rs.gov.br",
    role: "Visualizadora escolar",
    status: "Ativa",
    scope: "Rede municipal",
    organizationId: ORGANIZATION_IDS.REDE_MUNICIPAL,
  },
  {
    initials: "RS",
    name: "Rafael Souza",
    email: "rafael.souza@novasantarita.rs.gov.br",
    role: "Administrador",
    status: "Convite pendente",
    scope: "Plataforma",
    organizationId: null as string | null,
  },
] as const;

export const organizations = [
  {
    id: ORGANIZATION_IDS.VICTOR_AGGENS,
    initials: "VA",
    name: "EMEF Victor Aggens",
    type: "Escola municipal",
    members: 3,
    status: "Ativa" as const,
  },
  {
    id: ORGANIZATION_IDS.REDE_MUNICIPAL,
    initials: "RM",
    name: "Rede municipal de ensino",
    type: "Escopo de visualização",
    members: 2,
    status: "Ativa" as const,
  },
] as const;

export const auditEvents = [
  {
    date: "23 ago. · 10:32",
    actor: "Adriana Martins",
    action: "Criou um link de acesso",
    target: "Link principal",
    detail: "Missões do Caramelito · sem expiração",
    organizationId: ORGANIZATION_IDS.VICTOR_AGGENS,
  },
  {
    date: "22 ago. · 16:44",
    actor: "Lucas Ribeiro",
    action: "Compartilhou um link",
    target: "Turma 5B",
    detail: "QR code atualizado",
    organizationId: ORGANIZATION_IDS.VICTOR_AGGENS,
  },
  {
    date: "21 ago. · 09:18",
    actor: "Rafael Souza",
    action: "Rotacionou um link",
    target: "Link principal",
    detail: "Sessões anteriores preservadas",
    organizationId: ORGANIZATION_IDS.VICTOR_AGGENS,
  },
  {
    date: "20 ago. · 14:02",
    actor: "Adriana Martins",
    action: "Consultou resultados",
    target: "Missões do Caramelito",
    detail: "Leitura agregada",
    organizationId: ORGANIZATION_IDS.REDE_MUNICIPAL,
  },
  {
    date: "19 ago. · 11:27",
    actor: "Carla Freitas",
    action: "Atualizou a organização",
    target: "EMEF Victor Aggens",
    detail: "Acesso de visualização mantido",
    organizationId: ORGANIZATION_IDS.VICTOR_AGGENS,
  },
] as const;

export function getDashboardData() {
  return {
    featured: activities[0]!,
    links: accessLinks,
    weeklyParticipation: 86,
    activeLinkCount: accessLinks.filter((link) => link.status === "Aberta")
      .length,
  };
}

export function listActivities() {
  return activities;
}

export function getActivity(id: string) {
  return activities.find((activity) => activity.id === id);
}

export function listAccessLinks() {
  return accessLinks;
}

/**
 * Returns a fixture in the same shape as a persisted access link. Keeping this
 * conversion next to the portal fixtures lets the development bypass render
 * detail routes without constructing a Prisma/Neon-backed store.
 */
export function getDevBypassAccessLink(
  id: string,
): AccessLinkRecord | undefined {
  const summary = accessLinks.find((link) => link.id === id);
  if (!summary) return undefined;

  const createdAt = new Date(
    summary.createdAt ?? "2026-08-23T13:32:00.000-03:00",
  );
  const updatedAt = new Date(
    summary.updatedAt ?? summary.createdAt ?? createdAt.toISOString(),
  );

  return {
    id: summary.id,
    organizationId: summary.organizationId ?? ORGANIZATION_IDS.VICTOR_AGGENS,
    createdById: DEV_BYPASS_ACTOR.profileId,
    label: summary.label,
    audience: summary.audience,
    tokenHash: hashToken(`dev-bypass-fixture:${summary.id}`),
    expiresAt:
      summary.expiresAt === undefined || summary.expiresAt === null
        ? null
        : new Date(summary.expiresAt),
    revokedAt: null,
    pausedAt: null,
    createdAt,
    updatedAt,
  };
}
