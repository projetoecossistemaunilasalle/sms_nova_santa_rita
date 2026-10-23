import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";

import { PortalShell } from "@/components/portal/portal-shell";
import { getRuntimeMode } from "@/runtime/mode";
import { getAuthGateway } from "@/server/auth/gateway";
import { getPortalShellData } from "@/runtime/readers";
import { findMockDatabase } from "@/server/mock/session";
import { RecordStatus } from "@/generated/prisma/enums";
import { getAdultPortalService } from "@/server/services/adult-portal-container";

export const metadata: Metadata = {
  title: "Portal",
  robots: { index: false, follow: false },
};

export default async function ProfessionalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const runtimeMode = getRuntimeMode();
  await connection();
  const session = await getAuthGateway().getSession();

  if (!session) {
    redirect("/entrar");
  }
  const shell = await getPortalShellData();
  const mock = runtimeMode === "demo" ? await findMockDatabase() : null;
  const mockPortal = mock ? await getAdultPortalService() : null;
  const mockWorkspace = mock
    ? {
        activeProfileId: mock.state.activeProfileId,
        resetVersion: mock.resetVersion,
        profiles: await Promise.all(
          mock.state.profiles
            .filter((profile) => profile.status === RecordStatus.ACTIVE)
            .map(async ({ id, displayName }) => ({
              id,
              displayName,
              roleLabel: (await mockPortal!.getShell(id)).roleLabel,
            })),
        ),
      }
    : undefined;

  return (
    <PortalShell session={session} shell={shell} mockWorkspace={mockWorkspace}>
      {children}
    </PortalShell>
  );
}
