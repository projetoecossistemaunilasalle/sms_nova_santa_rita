export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
        color: "var(--text-muted)",
        background: "var(--background)",
        fontFamily: "var(--font-body)",
        textAlign: "center",
      }}
    >
      <p>
        <strong>404</strong>
        <br />
        Página não encontrada.
      </p>
    </main>
  );
}
