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
}

function fmt(n: number): string {
  return Math.floor(n).toLocaleString();
}

export default function ResourceBar({ cityName, money, energy, ammo, capacity, moneyProd, energyProd, ammoProd, population, maxPopulation, onLogout }: Props) {
  return (
    <div className="flex gap-6 px-4 py-1.5 bg-[#161b22] border-b border-[#30363d] shrink-0 text-sm text-[#c9d1d9]" style={{ fontVariantNumeric: "tabular-nums" }}>
      <span className="text-[#e6b800] font-semibold tracking-wider shrink-0">{cityName}</span>
      <span className="flex items-center gap-1.5 text-[#7ee787] shrink-0 min-w-[200px]">
        <img src="/images/icons/money.png" alt="Money" className="w-4 h-4 object-contain" onError={(e) => (e.currentTarget.style.display = "none")} />
        Money: {fmt(money)} <span className="text-[#484f58]">|</span> <span className="text-[#5a9e5f] text-xs">+{fmt(moneyProd)}/h</span>
      </span>
      <span className="flex items-center gap-1.5 text-[#79c0ff] shrink-0 min-w-[200px]">
        <img src="/images/icons/energy.png" alt="Energy" className="w-4 h-4 object-contain" onError={(e) => (e.currentTarget.style.display = "none")} />
        Energy: {fmt(energy)} <span className="text-[#484f58]">|</span> <span className="text-[#4a7ab5] text-xs">+{fmt(energyProd)}/h</span>
      </span>
      <span className="flex items-center gap-1.5 text-[#e3b341] shrink-0 min-w-[200px]">
        <img src="/images/icons/ammo.png" alt="Ammo" className="w-4 h-4 object-contain" onError={(e) => (e.currentTarget.style.display = "none")} />
        Ammo: {fmt(ammo)} <span className="text-[#484f58]">|</span> <span className="text-[#a8872e] text-xs">+{fmt(ammoProd)}/h</span>
      </span>
      <span className="flex items-center gap-1.5 text-[#c9d1d9] shrink-0 min-w-[170px]">
        Population: {fmt(population)} / {fmt(maxPopulation)}
      </span>
      <span className="flex items-center gap-1.5 text-[#c9d1d9] shrink-0">
        Storage: {fmt(capacity)}
      </span>
      {onLogout && (
        <button
          onClick={onLogout}
          className="ml-auto text-xs text-[#8b949e] border border-[#30363d] rounded px-2.5 py-1 hover:border-[#f85149] hover:text-[#f85149] cursor-pointer shrink-0"
        >
          Logout
        </button>
      )}
    </div>
  );
}
