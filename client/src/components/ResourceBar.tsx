import { useEffect, useRef, useState } from "react";

interface Props {
  cityName: string;
  cityPoints: number;
  money: number;
  energy: number;
  ammo: number;
  capacity: number;
  moneyProd: number;
  energyProd: number;
  ammoProd: number;
  population: number;
  maxPopulation: number;
  onLogout?: () => void;
  onSimulator?: () => void;
  onReports?: () => void;
  onMap?: () => void;
  onRankings?: () => void;
  unreadReports?: number;
  ownedCities?: { id: string; name: string; x: number; y: number }[];
  activeCityId?: string;
  onSwitchCity?: (cityId: string) => void;
}

function fmt(n: number): string {
  return Math.floor(n).toLocaleString();
}

export default function ResourceBar({ cityName, cityPoints, money, energy, ammo, capacity, moneyProd, energyProd, ammoProd, population, maxPopulation, onLogout, onSimulator, onReports, onMap, onRankings, unreadReports = 0, ownedCities, activeCityId, onSwitchCity }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [cityMenuOpen, setCityMenuOpen] = useState(false);
  const cityMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!cityMenuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (cityMenuRef.current && !cityMenuRef.current.contains(e.target as Node)) {
        setCityMenuOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setCityMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [cityMenuOpen]);

  const hasMultipleCities = (ownedCities?.length ?? 0) > 1;

  return (
    <div className="flex gap-6 px-4 py-1.5 bg-[#161b22] border-b border-[#30363d] shrink-0 text-sm text-[#c9d1d9]" style={{ fontVariantNumeric: "tabular-nums" }}>
      <span className="flex items-center gap-2 shrink-0">
        <span className="text-[#e6b800] font-semibold tracking-wider">{cityName}</span>
        {hasMultipleCities && onSwitchCity && (
          <div ref={cityMenuRef} className="relative">
            <button
              onClick={() => setCityMenuOpen((v) => !v)}
              aria-label="Switch city"
              aria-haspopup="menu"
              aria-expanded={cityMenuOpen}
              className="text-[#e6b800] hover:text-[#fff3bf] leading-none cursor-pointer text-xs px-1 border border-[#30363d] rounded hover:border-[#e6b800] transition-colors"
            >
              ▾
            </button>
            {cityMenuOpen && (
              <div className="absolute left-0 top-full mt-1 min-w-[180px] bg-[#161b22] border border-[#30363d] rounded shadow-lg z-50 overflow-hidden">
                {ownedCities!.map((c) => {
                  const isActive = c.id === activeCityId;
                  return (
                    <button
                      key={c.id}
                      onClick={() => { setCityMenuOpen(false); if (!isActive) onSwitchCity(c.id); }}
                      className={`block w-full text-left text-xs px-3 py-2 hover:bg-[#1c2129] cursor-pointer ${isActive ? "text-[#e6b800] font-semibold" : "text-[#c9d1d9]"}`}
                    >
                      {isActive ? "● " : ""}{c.name}
                      <span className="text-[#7d8590] font-mono text-[10px] ml-1">({c.x},{c.y})</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        <span className="text-xs text-[#b1bac4]">{fmt(cityPoints)} pts</span>
      </span>
      {onMap && (
        <button
          onClick={onMap}
          className="text-xs text-[#f0883e] border border-[#30363d] rounded px-2.5 py-1 hover:border-[#f0883e] hover:bg-[#1c2129] cursor-pointer shrink-0 transition-colors"
        >
          Map
        </button>
      )}
      <span className="flex items-center gap-1.5 text-[#7ee787] shrink-0 min-w-[200px]">
        <img src="/images/icons/money.png" alt="Money" className="w-4 h-4 object-contain" onError={(e) => (e.currentTarget.style.display = "none")} />
        Money: {fmt(money)} <span className="text-[#7d8590]">|</span> <span className="text-[#5a9e5f] text-xs">+{fmt(moneyProd)}/h</span>
      </span>
      <span className="flex items-center gap-1.5 text-[#79c0ff] shrink-0 min-w-[200px]">
        <img src="/images/icons/energy.png" alt="Energy" className="w-4 h-4 object-contain" onError={(e) => (e.currentTarget.style.display = "none")} />
        Energy: {fmt(energy)} <span className="text-[#7d8590]">|</span> <span className="text-[#4a7ab5] text-xs">+{fmt(energyProd)}/h</span>
      </span>
      <span className="flex items-center gap-1.5 text-[#e3b341] shrink-0 min-w-[200px]">
        <img src="/images/icons/ammo.png" alt="Ammo" className="w-4 h-4 object-contain" onError={(e) => (e.currentTarget.style.display = "none")} />
        Ammo: {fmt(ammo)} <span className="text-[#7d8590]">|</span> <span className="text-[#a8872e] text-xs">+{fmt(ammoProd)}/h</span>
      </span>
      <span className="flex items-center gap-1.5 text-[#c9d1d9] shrink-0 min-w-[170px]">
        Population: {fmt(population)} / {fmt(maxPopulation)}
      </span>
      <span className="flex items-center gap-1.5 text-[#c9d1d9] shrink-0">
        Storage: {fmt(capacity)}
      </span>
      {onReports && (
        <button
          onClick={onReports}
          className="relative text-xs text-[#f0883e] border border-[#30363d] rounded px-2.5 py-1 hover:border-[#f0883e] hover:bg-[#1c2129] cursor-pointer shrink-0 transition-colors"
        >
          Reports
          {unreadReports > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#f85149] text-white text-[10px] font-bold leading-[16px] text-center shadow">
              {unreadReports > 99 ? "99+" : unreadReports}
            </span>
          )}
        </button>
      )}
      {(onSimulator || onRankings || onLogout) && (
        <div ref={menuRef} className="relative ml-auto shrink-0">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="text-[#b1bac4] border border-[#30363d] rounded px-2 py-1 hover:border-[#c9d1d9] hover:text-[#c9d1d9] cursor-pointer leading-none text-base"
          >
            ⋮
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-36 bg-[#161b22] border border-[#30363d] rounded shadow-lg z-50 overflow-hidden">
              {onRankings && (
                <button
                  onClick={() => { setMenuOpen(false); onRankings(); }}
                  className="block w-full text-left text-xs text-[#e3b341] px-3 py-2 hover:bg-[#1c2129] cursor-pointer"
                >
                  Rankings
                </button>
              )}
              {onSimulator && (
                <button
                  onClick={() => { setMenuOpen(false); onSimulator(); }}
                  className="block w-full text-left text-xs text-[#d2a8ff] px-3 py-2 hover:bg-[#1c2129] cursor-pointer"
                >
                  Simulator
                </button>
              )}
              {(onRankings || onSimulator) && onLogout && <div className="h-px bg-[#30363d]" />}
              {onLogout && (
                <button
                  onClick={() => { setMenuOpen(false); onLogout(); }}
                  className="block w-full text-left text-xs text-[#b1bac4] px-3 py-2 hover:bg-[#1c2129] hover:text-[#f85149] cursor-pointer"
                >
                  Logout
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
