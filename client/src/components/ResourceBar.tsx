interface Props {
  money: number;
  energy: number;
  ammo: number;
  capacity: number;
  population: number;
  maxPopulation: number;
}

function fmt(n: number): string {
  return Math.floor(n).toLocaleString();
}

export default function ResourceBar({ money, energy, ammo, capacity, population, maxPopulation }: Props) {
  return (
    <div className="flex gap-6 px-4 py-1.5 bg-[#161b22] border-b border-[#30363d] shrink-0 flex-wrap text-sm text-[#c9d1d9]">
      <span className="flex items-center gap-1.5">
        <img src="/images/icons/money.png" alt="Money" className="w-4 h-4 object-contain" onError={(e) => (e.currentTarget.style.display = "none")} />
        {fmt(money)} / {fmt(capacity)}
      </span>
      <span className="flex items-center gap-1.5">
        <img src="/images/icons/energy.png" alt="Energy" className="w-4 h-4 object-contain" onError={(e) => (e.currentTarget.style.display = "none")} />
        {fmt(energy)} / {fmt(capacity)}
      </span>
      <span className="flex items-center gap-1.5">
        <img src="/images/icons/ammo.png" alt="Ammo" className="w-4 h-4 object-contain" onError={(e) => (e.currentTarget.style.display = "none")} />
        {fmt(ammo)} / {fmt(capacity)}
      </span>
      <span className="flex items-center gap-1.5 text-[#8b949e]">
        Pop: {fmt(population)} / {fmt(maxPopulation)}
      </span>
    </div>
  );
}
