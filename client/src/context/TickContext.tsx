import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// Un singur setInterval global pentru toata aplicatia. Componentele care au
// nevoie de "acum" pentru countdown-uri apeleaza useNow() si primesc un numar
// (Date.now()) care se actualizeaza o data pe secunda. Un singur rerender/sec
// declansat de provider se propaga catre toti consumerii — fara interval-uri
// per component.
const TickContext = createContext<number>(Date.now());

export function TickProvider({ children }: { children: ReactNode }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return <TickContext.Provider value={now}>{children}</TickContext.Provider>;
}

export function useNow(): number {
  return useContext(TickContext);
}
