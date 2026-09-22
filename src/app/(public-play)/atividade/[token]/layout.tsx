import type { Metadata } from "next";
import type { ReactNode } from "react";

import { PublicShell } from "@/components/public/public-shell";
import { PublicState } from "@/components/public/public-state";
import { getRuntimeMode } from "@/runtime/mode";

export const metadata: Metadata = {
  title: "Atividade",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ActivityPublicLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <PublicShell>
      {getRuntimeMode() === "demo" ? (
        children
      ) : (
        <PublicState
          icon="settings"
          title="Entrada de jogadores ainda não conectada"
          description="Este ambiente não usa os links fictícios da demonstração. O acesso por jogador será habilitado em um próximo slice."
        />
      )}
    </PublicShell>
  );
}
