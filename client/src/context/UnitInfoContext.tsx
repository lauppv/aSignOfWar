import { createContext, useContext, useState } from "react";
import type { UnitName } from "../types/index.ts";
import UnitInfoModal from "../components/UnitInfoModal.tsx";

interface UnitInfoContextValue {
  openUnit: (name: UnitName) => void;
}

const UnitInfoContext = createContext<UnitInfoContextValue>({ openUnit: () => {} });

export function useUnitInfo() {
  return useContext(UnitInfoContext);
}

export function UnitInfoProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<UnitName | null>(null);

  return (
    <UnitInfoContext.Provider value={{ openUnit: setSelected }}>
      {children}
      {selected && <UnitInfoModal name={selected} onClose={() => setSelected(null)} />}
    </UnitInfoContext.Provider>
  );
}
