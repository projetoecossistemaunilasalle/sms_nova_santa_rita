import type { Metadata } from "next";
import type { ReactNode } from "react";

import { PublicShell } from "@/components/public/public-shell";

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
  return <PublicShell>{children}</PublicShell>;
}
