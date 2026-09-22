export function readPlayerEntryCredential(
  href: string,
  cachedCredential: string | null,
): { token: string | null; historyUrl: string; shouldResolve: boolean } {
  if (cachedCredential) {
    return {
      token: cachedCredential,
      historyUrl: "",
      shouldResolve: false,
    };
  }

  const url = new URL(href);
  const values = url.searchParams.getAll("cred");
  const token = values.length === 1 ? values[0]?.trim() || null : null;
  url.searchParams.delete("cred");

  return {
    token,
    historyUrl: `${url.pathname}${url.search}${url.hash}`,
    shouldResolve: true,
  };
}
