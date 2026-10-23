const signInPath = `${process.env.APP_BASE_PATH ?? ""}/entrar/`;

export default function HomePage() {
  return (
    <main style={{ padding: "2rem", textAlign: "center" }}>
      <meta httpEquiv="refresh" content={`0;url=${signInPath}`} />
      <p>Redirecionando para o portal...</p>
      <a href={signInPath}>
        Clique aqui se não for redirecionado automaticamente.
      </a>
    </main>
  );
}
