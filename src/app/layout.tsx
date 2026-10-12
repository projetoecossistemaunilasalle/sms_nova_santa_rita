import type { Metadata } from "next";
import type { ReactNode } from "react";
import { connection } from "next/server";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Missões do Caramelito",
    template: "%s | Missões do Caramelito",
  },
  description:
    "Acesso às atividades educativas do projeto Missões do Caramelito.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  // Render HTML with the proxy's per-request CSP nonce, including sign-in.
  await connection();
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
