import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";

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
  // Per-request CSP nonce: proxy generates it and sets
  // `Content-Security-Policy: script-src 'nonce-...'` on the request so
  // Next can extract it via getScriptNonceFromHeader() and stamp every
  // inline script (e.g. self.__next_f.push) that would otherwise be blocked
  // by `script-src 'self'` alone (2 inline scripts with 0 nonce on /entrar).
  // Reading headers() opts this root layout into dynamic rendering and makes
  // the nonce available for any custom <Script nonce={nonce}> usage;
  // framework scripts are stamped automatically.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  void nonce;

  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
