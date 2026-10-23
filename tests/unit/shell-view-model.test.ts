import { describe, expect, it } from "vitest";

import { buildPortalShell } from "@/application/adult-portal/shell-view-model";
import type {
  ActorSnapshot,
  AdultRole,
} from "@/application/adult-portal/types";
import { RecordStatus } from "@/generated/prisma/enums";

const actor: ActorSnapshot = {
  profileId: "profile-1",
  displayName: "Pessoa",
  profileStatus: RecordStatus.ACTIVE,
  platformRole: null,
  memberships: [],
};

function hrefs(role: AdultRole): string[] {
  return buildPortalShell(actor, role).navigation.map((item) => item.href);
}

describe("portal shell game versions link", () => {
  it("is shown only to platform admins", () => {
    expect(hrefs("platform_admin")).toContain("/portal/admin/versoes-do-jogo");
    expect(hrefs("organization_admin")).not.toContain(
      "/portal/admin/versoes-do-jogo",
    );
    expect(hrefs("teacher")).not.toContain("/portal/admin/versoes-do-jogo");
  });
});
