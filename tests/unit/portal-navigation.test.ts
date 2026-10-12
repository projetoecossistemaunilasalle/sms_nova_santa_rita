import { describe, expect, it } from "vitest";

import {
  isPortalNavigationItemCurrent,
  matchesPortalSearch,
} from "@/components/portal/adult-portal-helpers";

const overview = {
  href: "/portal",
  label: "Visão geral",
  exact: true,
};

describe("portal navigation active state", () => {
  it("normalizes a trailing slash on the overview route", () => {
    expect(isPortalNavigationItemCurrent("/portal/", overview)).toBe(true);
  });

  it("normalizes the configured base path before matching", () => {
    expect(
      isPortalNavigationItemCurrent(
        "/SMS_Portal/portal/",
        overview,
        "/SMS_Portal",
      ),
    ).toBe(true);
  });

  it("does not mark overview active on a nested portal route", () => {
    expect(isPortalNavigationItemCurrent("/portal/turmas/3a/", overview)).toBe(
      false,
    );
  });

  it("keeps results selected through class and player drill-down", () => {
    const results = { href: "/portal/resultados", label: "Resultados" };
    for (const route of [
      "/portal/resultados",
      "/portal/resultados/class-1",
      "/portal/resultados/class-1/players/player-7/",
    ]) {
      expect(isPortalNavigationItemCurrent(route, results)).toBe(true);
    }
  });

  it("matches route segments rather than partial prefixes", () => {
    expect(
      isPortalNavigationItemCurrent("/portal/turmas-arquivadas", {
        href: "/portal/turmas",
        label: "Turmas",
      }),
    ).toBe(false);
  });

  it("matches nested results under a configured base path", () => {
    expect(
      isPortalNavigationItemCurrent(
        "/SMS_Portal/portal/resultados/class-1/players/7",
        { href: "/portal/resultados", label: "Resultados" },
        "/SMS_Portal",
      ),
    ).toBe(true);
  });
});

describe("portal directory search", () => {
  it("ignores accents, case and surrounding spaces", () => {
    expect(matchesPortalSearch("  sao JOAO ", "Escola São João")).toBe(true);
  });

  it("matches words across class and organization names", () => {
    expect(matchesPortalSearch("3º escola", "3º A", "Escola Municipal")).toBe(
      true,
    );
  });

  it("includes all entries for an empty search and excludes unrelated entries", () => {
    expect(matchesPortalSearch("", "3º A")).toBe(true);
    expect(matchesPortalSearch("4º", "3º A")).toBe(false);
  });
});
