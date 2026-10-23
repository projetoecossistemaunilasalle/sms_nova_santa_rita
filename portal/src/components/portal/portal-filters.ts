export function updateFilterQuery(
  query: string,
  changes: Record<string, string>,
): string {
  const params = new URLSearchParams(query);
  for (const [key, value] of Object.entries(changes)) {
    if (!value || value === "all") params.delete(key);
    else params.set(key, value);
  }
  const result = params.toString();
  return result ? `?${result}` : "";
}

export function matchesPlayerNumber(playerNumber: number, query: string) {
  const value = query.trim();
  return (
    value === "" || (/^\d+$/.test(value) && playerNumber === Number(value))
  );
}
