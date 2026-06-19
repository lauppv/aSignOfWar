import { createContext, useContext, useState } from "react";
import AllianceProfileModal from "@/features/alliance/components/AllianceProfileModal";

interface Value {
  openAlliance: (allianceId: string) => void;
}

const AllianceProfileContext = createContext<Value>({ openAlliance: () => {} });

export function useAllianceProfile() {
  return useContext(AllianceProfileContext);
}

export function AllianceProfileProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <AllianceProfileContext.Provider value={{ openAlliance: setSelected }}>
      {children}
      {selected && <AllianceProfileModal allianceId={selected} onClose={() => setSelected(null)} />}
    </AllianceProfileContext.Provider>
  );
}
