import { describe, expect, it } from "vitest";

import { isPortalNavigationItemCurrent } from "@/components/portal/adult-portal-helpers";

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
});
