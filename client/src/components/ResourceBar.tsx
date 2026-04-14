interface Props {
  cityName: string;
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
  unreadReports?: number;
}

function fmt(n: number): string {
  return Math.floor(n).toLocaleString();
}

export default function ResourceBar({ cityName, money, energy, ammo, capacity, moneyProd, energyProd, ammoProd, population, maxPopulation, onLogout, onSimulator, onReports, onMap, unreadReports = 0 }: Props) {
  return (
    <div className="flex gap-6 px-4 py-1.5 bg-[#161b22] border-b border-[#30363d] shrink-0 text-sm text-[#c9d1d9]" style={{ fontVariantNumeric: "tabular-nums" }}>
      <span className="text-[#e6b800] font-semibold tracking-wider shrink-0">{cityName}</span>
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
      {onMap && (
        <button
          onClick={onMap}
          className="text-xs text-[#7ee787] border border-[#30363d] rounded px-2.5 py-1 hover:border-[#7ee787] hover:bg-[#1c2129] cursor-pointer shrink-0 transition-colors"
        >
          Map
        </button>
      )}
      {onSimulator && (
        <button
          onClick={onSimulator}
          className="text-xs text-[#d2a8ff] border border-[#30363d] rounded px-2.5 py-1 hover:border-[#d2a8ff] hover:bg-[#1c2129] cursor-pointer shrink-0 transition-colors"
        >
          Simulator
        </button>
      )}
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
      {onLogout && (
        <button
          onClick={onLogout}
          className="ml-auto text-xs text-[#b1bac4] border border-[#30363d] rounded px-2.5 py-1 hover:border-[#f85149] hover:text-[#f85149] cursor-pointer shrink-0"
        >
          Logout
        </button>
      )}
    </div>
  );
}
