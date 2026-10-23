import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { PublicShell } from "@/components/public/public-shell";

export const metadata: Metadata = {
  title: "Entrada do jogador",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function PlayerEntryLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <PublicShell>{children}</PublicShell>;
}
