import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { PortalShell } from "@/components/portal/portal-shell";
import { getAuthGateway } from "@/server/auth/gateway";

export const metadata: Metadata = {
  title: "Portal",
  robots: { index: false, follow: false },
};

// The portal renders per request because the session is request-scoped.
export const dynamic = "force-dynamic";

export default async function ProfessionalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getAuthGateway().getSession();

  if (!session) {
    redirect("/entrar");
  }

  return <PortalShell session={session}>{children}</PortalShell>;
}
