"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/entrar");
  }, [router]);

  return (
    <main
      style={{ padding: "2rem", textAlign: "center", fontFamily: "sans-serif" }}
    >
      <p>Redirecionando para o portal...</p>
      <Link
        href="/entrar"
        style={{ color: "#2563eb", textDecoration: "underline" }}
      >
        Clique aqui se não for redirecionado automaticamente.
      </Link>
    </main>
  );
}
