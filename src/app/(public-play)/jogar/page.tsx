import { PlayerEntryScreen } from "@/components/public/player-entry-screen";
import { getRuntimeMode } from "@/runtime/mode";

export default function PlayerEntryPage() {
  return <PlayerEntryScreen runtimeMode={getRuntimeMode()} />;
}
