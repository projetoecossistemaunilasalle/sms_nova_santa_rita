export function inlineScripts(html: string): string[];
export function inlineScriptHashes(html: string): string[];
export function assertNoCollisions(
  entries: string[],
  ownedEntries: string[],
  existingEntries: string[],
): void;
export function bundleLanding(
  dist: string,
  publicRoot: string,
  stateRoot: string,
): void;
