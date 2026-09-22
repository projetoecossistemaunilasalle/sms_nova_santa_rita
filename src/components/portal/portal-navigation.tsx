"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon, type IconName } from "@/components/shared/icon";
import type { NavigationItemDto } from "@/application/adult-portal/types";
import type { RuntimeMode } from "@/runtime/mode";
import {
  OrganizationRole,
  PlatformRole,
  RecordStatus,
} from "@/generated/prisma/enums";

import styles from "./portal.module.css";
import { useDemoPortalState } from "./use-demo-portal";

type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  exact?: boolean;
  mobile?: boolean;
};

function isCurrent(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  if (item.label === "Links de acesso") {
    return pathname.startsWith(item.href) && !pathname.endsWith("/resultados");
  }
  if (item.label === "Resultados") {
    return pathname.endsWith("/resultados");
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
  items,
  runtimeMode,
}: {
  items: NavigationItemDto[];
  runtimeMode: RuntimeMode;
}) {
  const pathname = usePathname();
  const demo = useDemoPortalState();

  let visibleItems: NavItem[] = items;
  if (runtimeMode === "demo" && demo) {
    const profile = demo.profiles.find(
      (item) => item.id === demo.activeProfileId,
    );
    const memberships = demo.memberships.filter(
      (item) =>
        item.profileId === demo.activeProfileId &&
        item.status === RecordStatus.ACTIVE,
    );
    const organizationAdmin = memberships.find(
      (item) => item.role === OrganizationRole.ORGANIZATION_ADMIN,
    );
    visibleItems = [
      {
        href: "/portal",
        label: "Visão geral",
        icon: "home",
        exact: true,
        mobile: true,
      },
    ];
    if (profile?.platformRole === PlatformRole.PLATFORM_ADMIN) {
      visibleItems.push(
        {
          href: "/portal/admin/organizacoes",
          label: "Organizações",
          icon: "building",
          mobile: true,
        },
        {
          href: "/portal/admin/equipe",
          label: "Equipe",
          icon: "users",
          mobile: true,
        },
      );
    } else {
      visibleItems.push({
        href: "/portal/turmas",
        label: "Turmas",
        icon: "school",
        mobile: true,
      });
      if (organizationAdmin) {
        visibleItems.push(
          {
            href: "/portal/admin/equipe",
            label: "Equipe",
            icon: "users",
            mobile: true,
          },
          {
            href: `/portal/admin/organizacoes/${organizationAdmin.organizationId}`,
            label: "Minha organização",
            icon: "building",
            mobile: true,
          },
        );
      }
    }
  }

  return (
    <nav className={styles.navigation} aria-label="Navegação do portal">
      <div className={styles.navGroup}>
        {visibleItems.map((item) => (
          <NavigationLink key={item.href} item={item} pathname={pathname} />
        ))}
      </div>
    </nav>
  );
}
