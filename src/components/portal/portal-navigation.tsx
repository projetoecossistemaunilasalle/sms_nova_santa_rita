"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon, type IconName } from "@/components/shared/icon";
import type { NavigationItemDto } from "@/application/adult-portal/types";

import styles from "./portal.module.css";
import { isPortalNavigationItemCurrent } from "./adult-portal-helpers";

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

export function PortalNavigation({ items }: { items: NavigationItemDto[] }) {
  const pathname = usePathname();
  const visibleItems: NavItem[] = items;

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
