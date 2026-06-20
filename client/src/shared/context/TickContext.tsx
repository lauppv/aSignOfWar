import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// A single global tick (1 Hz) shared by all components with countdowns. Without this,
// every command row, every recruitment timer, every building progress bar would run
// its own setInterval — i.e. 50+ timers on an active page. One provider,
// one rerender/sec, React diffing handles the rest. Trade-off: ALL consumers
// rerender every second even if nothing changed for them.
// At the current UI complexity, that's negligible.
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
