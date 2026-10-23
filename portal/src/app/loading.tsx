export default function Loading() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        color: "var(--green-dark)",
        background: "var(--background)",
        fontFamily: "var(--font-display)",
        fontSize: "1rem",
      }}
      role="status"
    >
      Preparando a atividade…
    </div>
  );
}
