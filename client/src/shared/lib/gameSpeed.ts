// Multiplicatorul de viteza al jocului, preluat de pe server la boot. Controleaza cat
// de rapid merge totul: productie resurse, timp constructie, timp calatorie.
// Stocat ca state la nivel de modul (nu React state) pentru ca e citit de functii pure
// din gameConfig care nu au acces la React context. Setat o data, nu se schimba in sesiune.
import { api } from "@/shared/api/client";

export let GAME_SPEED = 1;

export async function loadGameSpeed(): Promise<void> {
  const cfg = await api.get<{ gameSpeed: number }>("/config");
  GAME_SPEED = cfg.gameSpeed;
}
