"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon, type IconName } from "@/components/shared/icon";
import type { NavigationItemDto } from "@/application/adult-portal/types";
import type { RuntimeMode } from "@/runtime/mode";
import { OrganizationRole, RecordStatus } from "@/generated/prisma/enums";

import styles from "./portal.module.css";
import {
  demoRole,
  isPortalNavigationItemCurrent,
} from "./adult-portal-helpers";
import { useDemoPortalState } from "./use-demo-portal";

type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  exact?: boolean;
  mobile?: boolean;
};

function NavigationLink({
  item,
  pathname,
}: {
  item: NavItem;
  pathname: string;
}) {
  const current = isPortalNavigationItemCurrent(pathname, item);

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
    const role = demoRole(demo);
    visibleItems = [
      {
        href: "/portal",
        label: "Visão geral",
        icon: "home",
        exact: true,
        mobile: true,
      },
    ];
    if (role === "platform_admin") {
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
    } else if (role) {
      visibleItems.push({
        href: "/portal/turmas",
        label: "Turmas",
        icon: "school",
        mobile: true,
      });
      if (role === "organization_admin") {
        const organizationAdmin = demo.memberships.find(
          (membership) =>
            membership.profileId === demo.activeProfileId &&
            membership.status === RecordStatus.ACTIVE &&
            membership.role === OrganizationRole.ORGANIZATION_ADMIN &&
            demo.organizations.some(
              (organization) =>
                organization.id === membership.organizationId &&
                organization.status === RecordStatus.ACTIVE,
            ),
        );
        if (!organizationAdmin) return null;
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
      visibleItems.push({
        href: "/portal/resultados",
        label: "Resultados",
        icon: "chart",
        mobile: true,
      });
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
