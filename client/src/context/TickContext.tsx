import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// Un singur tick global (1 Hz) partajat de toate componentele cu countdown. Fara asta,
// fiecare rand de comanda, fiecare timer de recrutare, fiecare progress bar de cladire
// ar rula propriul setInterval — adica 50+ timere pe o pagina activa. Un provider,
// un rerender/sec, React diffing se ocupa de rest. Trade-off: TOTI consumatorii se
// rerandeaza in fiecare secunda chiar daca nimic nu s-a schimbat pentru ei.
// La complexitatea UI-ului actual, e neglijabil.
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
