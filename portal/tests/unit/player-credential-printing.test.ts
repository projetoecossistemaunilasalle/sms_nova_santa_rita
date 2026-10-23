import { describe, expect, it } from "vitest";

import type { IssuedCredentialDto } from "@/application/player-access/types";
import {
  cardsForPlayerCredentialBatch,
  playerCredentialBatchKey,
  printablePlayerCredentials,
} from "@/components/portal/player-credential-printing";

const initialCredentials: IssuedCredentialDto[] = [
  { playerSlotId: "slot-a", playerNumber: 1, token: "old-token-a" },
  { playerSlotId: "slot-b", playerNumber: 2, token: "token-b" },
];

describe("player credential printing", () => {
  it("removes a rotated player's old card without hiding other slots", () => {
    expect(
      printablePlayerCredentials(initialCredentials, new Set(["slot-a"])),
    ).toEqual([initialCredentials[1]]);
  });

  it("changes the print batch identity when the same slot gets a new token", () => {
    const rotatedCredentials = [
      { ...initialCredentials[0]!, token: "new-token-a" },
      initialCredentials[1]!,
    ];

    expect(playerCredentialBatchKey(rotatedCredentials)).not.toBe(
      playerCredentialBatchKey(initialCredentials),
    );
    expect(playerCredentialBatchKey(rotatedCredentials)).toBe(
      playerCredentialBatchKey(rotatedCredentials),
    );
  });

  it("never exposes QR cards generated for a previous credential batch", () => {
    const oldKey = playerCredentialBatchKey(initialCredentials);
    const newKey = playerCredentialBatchKey([
      { ...initialCredentials[0]!, token: "new-token-a" },
      initialCredentials[1]!,
    ]);
    const staleCards = [{ playerSlotId: "slot-a", qrDataUrl: "old-qr" }];

    expect(
      cardsForPlayerCredentialBatch(newKey, {
        key: oldKey,
        cards: staleCards,
      }),
    ).toEqual([]);
    expect(
      cardsForPlayerCredentialBatch(oldKey, {
        key: oldKey,
        cards: staleCards,
      }),
    ).toBe(staleCards);
  });
});
