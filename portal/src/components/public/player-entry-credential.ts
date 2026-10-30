import {
  forgetPlayerEntry,
  readResumablePlayerEntry,
  type PlayerEntryNavigation,
  type PlayerEntryStorage,
} from "./player-entry-resume";

export function readPlayerEntryCredential(
  href: string,
  cachedCredential: string | null,
): {
  token: string | null;
  historyUrl: string;
  shouldResolve: boolean;
  credentialMissing: boolean;
} {
  if (cachedCredential) {
    return {
      token: cachedCredential,
      historyUrl: "",
      shouldResolve: false,
      credentialMissing: false,
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
    credentialMissing: values.length === 0,
  };
}

export function readPlayerEntryWithResume(
  href: string,
  cachedCredential: string | null,
  storage: PlayerEntryStorage,
  navigation: PlayerEntryNavigation,
): ReturnType<typeof readPlayerEntryCredential> {
  const result = readPlayerEntryCredential(href, cachedCredential);
  if (!result.shouldResolve) return result;
  if (!result.credentialMissing) {
    // A new card must never fall back to the previous child's stored entry.
    forgetPlayerEntry(storage);
    return result;
  }
  return {
    ...result,
    token: readResumablePlayerEntry(storage, navigation),
  };
}
