"use client";

import { useSearchParams } from "next/navigation";
import { updateFilterQuery } from "./portal-filters";

export function usePortalFilters() {
  const params = useSearchParams();

  function setFilters(changes: Record<string, string>) {
    // Local filtering should survive Back/reload without a server trip per key.
    const query = updateFilterQuery(window.location.search, changes);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query}${window.location.hash}`,
    );
  }

  return { params, setFilters };
}
