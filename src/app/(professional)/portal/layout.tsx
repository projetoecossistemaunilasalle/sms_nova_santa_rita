import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";

import { PortalShell } from "@/components/portal/portal-shell";
import { getRuntimeMode } from "@/runtime/mode";
import { getAuthGateway } from "@/server/auth/gateway";
import { getPortalShellData } from "@runtime/adult-portal";

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
  if (runtimeMode === "server") {
    await connection();
  }
  const session = await getAuthGateway().getSession();

  if (!session) {
    redirect("/entrar");
  }
  const shell = await getPortalShellData();

  return (
    <PortalShell session={session} runtimeMode={runtimeMode} shell={shell}>
      {children}
    </PortalShell>
  );
}
