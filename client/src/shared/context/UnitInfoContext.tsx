import { createContext, useContext, useState } from "react";
import type { UnitName } from "@/shared/types";
import UnitInfoModal from "@/shared/ui/UnitInfoModal";

interface UnitInfoContextValue {
  openUnit: (name: UnitName) => void;
}

// { openUnit: () => {} } is just a default value, so we don't get type errors when using the context outside the provider.
// In practice this never happens, since we only use the context inside the provider, but TypeScript forces us to give a default value.
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
