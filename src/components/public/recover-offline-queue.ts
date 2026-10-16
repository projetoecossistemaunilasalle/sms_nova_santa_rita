import { openGameOfflineStore } from "@/runtime/offline/sync-engine";
import { createGameOfflineTransport } from "./game-offline-transport";

export async function recoverOfflinePlayerQueue(
  credential: string,
  playerSlotId: string,
) {
  const store = await openGameOfflineStore();
  try {
    const bootstrap = await store.getBootstrap(playerSlotId);
    if (!bootstrap) return null;
    const transport = createGameOfflineTransport(
      credential,
      playerSlotId,
    ).forSession(bootstrap.class_session_id);
    return await store.sync(playerSlotId, transport);
  } finally {
    store.close();
  }
}
