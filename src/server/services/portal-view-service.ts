import { DEV_BYPASS_ACTOR } from "@/server/auth/dev-bypass-gateway";
import type { AccessLinkRecord } from "@/server/services/access-link-service";
import { hashToken } from "@/server/security/tokens";
import { isDemoRuntime } from "@/runtime/mode";
import { isAuthDevBypassEnabled } from "@/server/config/env";

const demoRuntime = isDemoRuntime();

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

export type ClassGroupStatus = "Ativa" | "Inativa";

export type ClassGroupSummary = {
  id: string;
  name: string;
  organizationId: string;
  organization: string;
  grade: string;
  shift: "Manhã" | "Tarde";
  schoolYear: number;
  activeLinks: number;
  sessions: number;
  completion: number;
  status: ClassGroupStatus;
  lastActivity: string;
  linkIds: string[];
};

export type MaterialStatus = "Publicado" | "Rascunho" | "Arquivado";

export type MaterialSummary = {
  id: string;
  title: string;
  summary: string;
  type: "Guia" | "Material pedagógico" | "Artigo" | "Comunicado" | "Atividade";
  theme: string;
  audience: "Professores" | "Famílias" | "Todos";
  status: MaterialStatus;
  updated: string;
  editor: string;
  accent: "blue" | "orange" | "aqua" | "purple" | "green";
  body: string;
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

const demoProfessionals = [
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

export const professionals = demoRuntime ? demoProfessionals : [];

const demoOrganizations = [
  {
    id: ORGANIZATION_IDS.VICTOR_AGGENS,
    initials: "VA",
    name: "EMEF Victor Aggens",
    type: "Escola municipal",
    members: 3,
    classGroups: 3,
    activeLinks: 4,
    participation: 168,
    status: "Ativa" as const,
  },
  {
    id: ORGANIZATION_IDS.REDE_MUNICIPAL,
    initials: "RM",
    name: "Rede municipal de ensino",
    type: "Escopo de visualização",
    members: 2,
    classGroups: 1,
    activeLinks: 1,
    participation: 38,
    status: "Ativa" as const,
  },
] as const;

export const organizations = demoRuntime ? demoOrganizations : [];

const classGroups: ClassGroupSummary[] = [
  {
    id: "3a-victor-aggens",
    name: "3º A",
    organizationId: ORGANIZATION_IDS.VICTOR_AGGENS,
    organization: "EMEF Victor Aggens",
    grade: "3º ano",
    shift: "Manhã",
    schoolYear: 2026,
    activeLinks: 1,
    sessions: 36,
    completion: 84,
    status: "Ativa",
    lastActivity: "Hoje, 08:42",
    linkIds: ["habitos-saudaveis"],
  },
  {
    id: "4a-victor-aggens",
    name: "4º A",
    organizationId: ORGANIZATION_IDS.VICTOR_AGGENS,
    organization: "EMEF Victor Aggens",
    grade: "4º ano",
    shift: "Manhã",
    schoolYear: 2026,
    activeLinks: 1,
    sessions: 48,
    completion: 79,
    status: "Ativa",
    lastActivity: "Ontem, 15:10",
    linkIds: ["habitos-saudaveis"],
  },
  {
    id: "5b-victor-aggens",
    name: "5º B",
    organizationId: ORGANIZATION_IDS.VICTOR_AGGENS,
    organization: "EMEF Victor Aggens",
    grade: "5º ano",
    shift: "Tarde",
    schoolYear: 2026,
    activeLinks: 2,
    sessions: 42,
    completion: 76,
    status: "Ativa",
    lastActivity: "Hoje, 09:18",
    linkIds: ["turma-5b", "habitos-saudaveis"],
  },
  {
    id: "5a-rede-municipal",
    name: "5º A",
    organizationId: ORGANIZATION_IDS.REDE_MUNICIPAL,
    organization: "EMEF Campos Verdes",
    grade: "5º ano",
    shift: "Manhã",
    schoolYear: 2026,
    activeLinks: 1,
    sessions: 38,
    completion: 88,
    status: "Ativa",
    lastActivity: "25 ago., 11:04",
    linkIds: ["habitos-saudaveis"],
  },
  {
    id: "4b-rede-municipal",
    name: "4º B",
    organizationId: ORGANIZATION_IDS.REDE_MUNICIPAL,
    organization: "EMEF Campos Verdes",
    grade: "4º ano",
    shift: "Tarde",
    schoolYear: 2025,
    activeLinks: 0,
    sessions: 27,
    completion: 74,
    status: "Inativa",
    lastActivity: "18 dez. 2025",
    linkIds: [],
  },
];

const materials: MaterialSummary[] = [
  {
    id: "convivencia-no-recreio",
    title: "Guia de conversa: convivência no recreio",
    summary:
      "Perguntas e combinados para mediar conversas sobre cuidado coletivo no recreio.",
    type: "Guia",
    theme: "Convivência",
    audience: "Professores",
    status: "Publicado",
    updated: "Hoje, 09:24",
    editor: "Adriana Martins",
    accent: "blue",
    body: "Comece a conversa perguntando o que torna o recreio acolhedor para todas as pessoas. Registre os combinados construídos pelo grupo e retome-os ao longo da semana.",
  },
  {
    id: "alimentacao-saudavel",
    title: "Alimentação saudável em sala",
    summary:
      "Propostas simples para conversar sobre escolhas alimentares sem julgamentos.",
    type: "Material pedagógico",
    theme: "Alimentação",
    audience: "Professores",
    status: "Publicado",
    updated: "Ontem, 16:10",
    editor: "Lucas Ribeiro",
    accent: "green",
    body: "Use alimentos presentes no cotidiano da comunidade como ponto de partida. Convide a turma a observar cores, origens e diferentes formas de preparo.",
  },
  {
    id: "vacinacao-em-familia",
    title: "Vacinação: perguntas para conversar em família",
    summary: "Um apoio para aproximar escola, famílias e equipes de saúde.",
    type: "Artigo",
    theme: "Prevenção",
    audience: "Famílias",
    status: "Publicado",
    updated: "26 ago., 14:40",
    editor: "Carla Freitas",
    accent: "aqua",
    body: "Converse com a equipe de saúde de referência para esclarecer dúvidas e verificar as orientações atualizadas do calendário de vacinação.",
  },
  {
    id: "combate-a-dengue",
    title: "Semana de combate à dengue",
    summary:
      "Comunicado para organizar ações de prevenção na escola e no entorno.",
    type: "Comunicado",
    theme: "Prevenção",
    audience: "Todos",
    status: "Rascunho",
    updated: "25 ago., 11:32",
    editor: "Adriana Martins",
    accent: "orange",
    body: "Durante a semana, cada turma poderá mapear pontos de atenção e compartilhar atitudes simples para evitar água parada.",
  },
  {
    id: "cultura-de-paz",
    title: "Cultura de paz: roteiro para roda de conversa",
    summary:
      "Uma atividade guiada para reconhecer conflitos e construir acordos coletivos.",
    type: "Atividade",
    theme: "Convivência",
    audience: "Professores",
    status: "Publicado",
    updated: "22 ago., 08:50",
    editor: "Lucas Ribeiro",
    accent: "purple",
    body: "Organize a roda em um espaço tranquilo. Convide cada pessoa a falar sobre como gostaria de ser acolhida em uma situação de conflito.",
  },
  {
    id: "saude-emocional",
    title: "Saúde emocional: sinais para acolher e conversar",
    summary:
      "Orientações iniciais para uma escuta cuidadosa no cotidiano escolar.",
    type: "Guia",
    theme: "Saúde emocional",
    audience: "Professores",
    status: "Rascunho",
    updated: "20 ago., 17:05",
    editor: "Carla Freitas",
    accent: "aqua",
    body: "Acolha sem pressionar por respostas. Escute, registre apenas o necessário e acione os fluxos de cuidado da rede quando houver necessidade.",
  },
];

const demoAuditEvents = [
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

export const auditEvents = demoRuntime ? demoAuditEvents : [];

export function getDashboardData() {
  if (!demoRuntime) {
    throw new Error("Server portal data is not connected in Slice 0.");
  }
  return {
    featured: activities[0]!,
    links: accessLinks,
    weeklyParticipation: 86,
    activeLinkCount: accessLinks.filter((link) => link.status === "Aberta")
      .length,
  };
}

export function listActivities() {
  return demoRuntime ? activities : [];
}

export function getActivity(id: string) {
  return demoRuntime
    ? activities.find((activity) => activity.id === id)
    : undefined;
}

export function listAccessLinks() {
  return demoRuntime ? accessLinks : [];
}

function demoData<T>(fixtures: T[]): T[] {
  return demoRuntime ? fixtures : [];
}

export function listClassGroups() {
  return demoData(classGroups);
}

export function getClassGroup(id: string) {
  return demoData(classGroups).find((classGroup) => classGroup.id === id);
}

export function listMaterials() {
  return demoData(materials);
}

export function getMaterial(id: string) {
  return demoData(materials).find((material) => material.id === id);
}

export function getOrganization(id: string) {
  return demoRuntime
    ? organizations.find((organization) => organization.id === id)
    : undefined;
}

export function getOrganizationDemoData(id: string) {
  if (!demoRuntime) {
    return { classGroups: [], professionals: [], links: [] };
  }
  return {
    classGroups: classGroups.filter(
      (classGroup) => classGroup.organizationId === id,
    ),
    professionals: professionals.filter(
      (professional) => professional.organizationId === id,
    ),
    links: accessLinks.filter((link) => link.organizationId === id),
  };
}

/**
 * Returns a fixture in the same shape as a persisted access link. Keeping this
 * conversion next to the portal fixtures lets the development bypass render
 * detail routes without constructing a Prisma/Neon-backed store.
 */
export function getDevBypassAccessLink(
  id: string,
): AccessLinkRecord | undefined {
  if (!demoRuntime && !isAuthDevBypassEnabled()) return undefined;
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
