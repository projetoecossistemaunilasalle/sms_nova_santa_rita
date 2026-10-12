import { OrganizationRole, RecordStatus } from "@/generated/prisma/enums";

export function recordStatusLabel(status: RecordStatus): "Ativa" | "Inativa" {
  return status === RecordStatus.ACTIVE ? "Ativa" : "Inativa";
}

export function roleLabel(role: OrganizationRole): string {
  return role === OrganizationRole.ORGANIZATION_ADMIN
    ? "Administrador da organização"
    : "Professor";
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function isPortalNavigationItemCurrent(
  pathname: string,
  item: { href: string; label: string; exact?: boolean },
  basePath = process.env.APP_BASE_PATH ?? "",
): boolean {
  const pathWithoutBase =
    basePath && pathname.startsWith(`${basePath}/`)
      ? pathname.slice(basePath.length)
      : pathname;
  const routePath = pathWithoutBase.replace(/\/+$/, "") || "/";
  const itemPath = item.href.replace(/\/+$/, "") || "/";

  if (item.exact) return routePath === itemPath;
  return routePath === itemPath || routePath.startsWith(`${itemPath}/`);
}

export function matchesPortalSearch(
  query: string,
  ...values: string[]
): boolean {
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR");
  const terms = normalize(query).trim().split(/\s+/);
  const text = normalize(values.join(" "));
  return terms.every((term) => text.includes(term));
}
