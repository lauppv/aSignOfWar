import { api } from "../api/client.ts";

export let GAME_SPEED = 1;

export async function loadGameSpeed(): Promise<void> {
  const cfg = await api.get<{ gameSpeed: number }>("/config");
  GAME_SPEED = cfg.gameSpeed;
}
