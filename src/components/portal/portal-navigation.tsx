"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon, type IconName } from "@/components/shared/icon";

import styles from "./portal.module.css";

type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  exact?: boolean;
  mobile?: boolean;
};

const primaryItems: NavItem[] = [
  {
    href: "/portal",
    label: "Visão geral",
    icon: "home",
    exact: true,
    mobile: true,
  },
  {
    href: "/portal/atividades",
    label: "Links de acesso",
    icon: "flag",
    mobile: true,
  },
  {
    href: "/portal/atividades/habitos-saudaveis/resultados",
    label: "Resultados",
    icon: "chart",
    mobile: true,
  },
];

const adminItems: NavItem[] = [
  {
    href: "/portal/admin/equipe",
    label: "Equipe",
    icon: "users",
    mobile: true,
  },
  {
    href: "/portal/admin/organizacoes",
    label: "Organizações",
    icon: "building",
  },
  { href: "/portal/admin/auditoria", label: "Auditoria", icon: "history" },
];

function isCurrent(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  if (item.label === "Links de acesso") {
    return pathname.startsWith(item.href) && !pathname.endsWith("/resultados");
  }
  return pathname.startsWith(item.href);
}

function NavigationLink({
  item,
  pathname,
}: {
  item: NavItem;
  pathname: string;
}) {
  const current = isCurrent(pathname, item);

  return (
    <Link
      className={`${styles.navLink} ${current ? styles.navLinkActive : ""} ${item.mobile ? styles.mobileNavItem : styles.desktopNavItem}`}
      href={item.href}
      aria-current={current ? "page" : undefined}
    >
      <Icon name={item.icon} />
      <span>{item.label}</span>
    </Link>
  );
}

export function PortalNavigation({
  allowedAdminHrefs,
}: {
  allowedAdminHrefs?: string[];
}) {
  const pathname = usePathname();

  const visibleAdminItems =
    allowedAdminHrefs === undefined
      ? adminItems
      : adminItems.filter((item) => allowedAdminHrefs.includes(item.href));

  return (
    <nav className={styles.navigation} aria-label="Navegação do portal">
      <div className={styles.navGroup}>
        {primaryItems.map((item) => (
          <NavigationLink key={item.href} item={item} pathname={pathname} />
        ))}
      </div>
      {visibleAdminItems.length > 0 && (
        <div className={`${styles.navGroup} ${styles.adminNavGroup}`}>
          <p className={styles.navLabel}>Administração</p>
          {visibleAdminItems.map((item) => (
            <NavigationLink key={item.href} item={item} pathname={pathname} />
          ))}
        </div>
      )}
    </nav>
  );
}
