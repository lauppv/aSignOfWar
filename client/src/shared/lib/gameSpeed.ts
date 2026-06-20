// The game speed multiplier, fetched from the server at boot. It controls how
// fast everything runs: resource production, construction time, travel time.
// Stored as module-level state (not React state) because it's read by pure functions
// in gameConfig that have no access to React context. Set once, never changes during a session.
import { api } from "@/shared/api/client";

export let GAME_SPEED = 1;

export async function loadGameSpeed(): Promise<void> {
  const cfg = await api.get<{ gameSpeed: number }>("/config");
  GAME_SPEED = cfg.gameSpeed;
}
