import { createContext, useContext, useState } from "react";
import PlayerProfileModal from "../components/PlayerProfileModal.tsx";

interface Value {
  openPlayer: (userId: string) => void;
}

const PlayerProfileContext = createContext<Value>({ openPlayer: () => {} });

export function usePlayerProfile() {
  return useContext(PlayerProfileContext);
}

export function PlayerProfileProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <PlayerProfileContext.Provider value={{ openPlayer: setSelected }}>
      {children}
      {selected && <PlayerProfileModal userId={selected} onClose={() => setSelected(null)} />}
    </PlayerProfileContext.Provider>
  );
}
