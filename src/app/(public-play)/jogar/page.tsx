import { PlayerEntryScreen } from "@/components/public/player-entry-screen";
import { getRuntimeMode } from "@/runtime/mode";
import { resolveGameClientUrl } from "@/server/config/game-client";

export default function PlayerEntryPage() {
  const runtimeMode = getRuntimeMode();
  const gameClient =
    runtimeMode === "server"
      ? resolveGameClientUrl()
      : { status: "missing" as const };
  const gameClientUrl =
    gameClient.status === "configured" ? gameClient.url : null;

  return (
    <PlayerEntryScreen
      gameClientUrl={gameClientUrl}
      runtimeMode={runtimeMode}
    />
  );
}
