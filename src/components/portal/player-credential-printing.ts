import type { IssuedCredentialDto } from "@/application/player-access/types";

export function cardsForPlayerCredentialBatch<T>(
  currentBatchKey: string,
  generatedBatch: { key: string; cards: T[] } | null,
): T[] {
  return generatedBatch?.key === currentBatchKey ? generatedBatch.cards : [];
}

export function printablePlayerCredentials(
  credentials: readonly IssuedCredentialDto[],
  invalidatedSlotIds: ReadonlySet<string>,
): IssuedCredentialDto[] {
  return credentials.filter(
    (credential) => !invalidatedSlotIds.has(credential.playerSlotId),
  );
}

export function playerCredentialBatchKey(
  credentials: readonly IssuedCredentialDto[],
): string {
  return JSON.stringify(
    credentials.map(({ playerSlotId, playerNumber, token }) => [
      playerSlotId,
      playerNumber,
      token,
    ]),
  );
}
