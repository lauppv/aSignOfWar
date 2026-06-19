import { createContext, useContext, useState } from "react";
import type { UnitName } from "@/shared/types";
import UnitInfoModal from "@/shared/ui/UnitInfoModal";

interface UnitInfoContextValue {
  openUnit: (name: UnitName) => void;
}

// { openUnit: () => {} } este doar o valoare default, pentru a nu avea erori de tip atunci cand folosim contextul in afara providerului
// In practica nu se intampla niciodata, pentru ca vom folosi contextul doar in interiorul providerului, dar TypeScript ne obliga sa dam o valoare default
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
